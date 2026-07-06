"""
Self-hosted email+password authentication with JWT tokens.

Replaces Firebase Auth. Users live in our own Postgres `users` table; we issue
and verify our own JWTs. The get_current_user dependency returns the same
{"uid", "email"} shape the rest of the app already expects, so downstream code
(API keys, Gmail OAuth, campaigns) is unchanged — "uid" is now the string form
of the local user id instead of a Firebase uid.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import JWT_ALGORITHM, JWT_EXPIRE_HOURS, JWT_SECRET
from db import get_session
from models import AuthToken, User

bearer_scheme = HTTPBearer(description="MailFlow login token (JWT)")


# ----------------------------------------------------------------- passwords
# Use bcrypt directly (passlib 1.7 is incompatible with bcrypt 4.x). bcrypt only
# hashes the first 72 bytes, so we truncate explicitly to avoid a ValueError on
# long passwords.

def hash_password(plain: str) -> str:
    pw = plain.encode("utf-8")[:72]
    return bcrypt.hashpw(pw, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8")[:72], hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ----------------------------------------------------------------- tokens

def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


# ----------------------------------------------------------------- dependency

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Verify the JWT and return {"uid", "email"}.

    Kept as a dict (not the ORM object) so existing callers that do
    user["uid"] / user["email"] keep working without changes.
    """
    try:
        payload = decode_access_token(credentials.credentials)
        uid = payload.get("sub")
        if not uid:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # Confirm the user still exists (handles deleted accounts / stale tokens).
    result = await session.execute(select(User).where(User.id == int(uid)))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="User no longer exists")

    return {"uid": str(user.id), "email": user.email}


# ----------------------------------------------------------- one-time tokens

def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def create_auth_token(
    session: AsyncSession, user_id: int, kind: str, ttl_hours: int
) -> str:
    """Create a single-use token of `kind` ('verify'|'reset'); return the raw value."""
    raw = secrets.token_urlsafe(32)
    token = AuthToken(
        user_id=user_id,
        token_hash=_hash_token(raw),
        kind=kind,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=ttl_hours),
    )
    session.add(token)
    await session.commit()
    return raw


async def consume_auth_token(session: AsyncSession, raw: str, kind: str) -> User | None:
    """Validate + burn a token. Returns the owning User, or None if invalid.

    Invalid = unknown, wrong kind, already used, or expired.
    """
    result = await session.execute(
        select(AuthToken).where(
            AuthToken.token_hash == _hash_token(raw), AuthToken.kind == kind
        )
    )
    token = result.scalar_one_or_none()
    if token is None or token.used:
        return None

    expires = token.expires_at
    if expires.tzinfo is None:  # SQLite returns naive datetimes
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        return None

    token.used = True  # single-use
    user = (
        await session.execute(select(User).where(User.id == token.user_id))
    ).scalar_one_or_none()
    await session.commit()
    return user
