"""
API key generation, hashing, and the Bearer-key authentication dependency.

Keys look like:  mf_live_<43 url-safe random chars>
Only the SHA-256 hash is stored. The raw key is returned to the user exactly
once, at creation time.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from models import ApiKey

KEY_PREFIX = "mf_live_"
# Length of the visible prefix stored for display, e.g. "mf_live_a1b2c3".
DISPLAY_PREFIX_LEN = len(KEY_PREFIX) + 6

# Separate security scheme so OpenAPI shows it distinctly from Firebase auth.
api_key_scheme = HTTPBearer(description="MailFlow API key (mf_live_...)")


def generate_api_key() -> tuple[str, str, str]:
    """Return (raw_key, key_hash, display_prefix)."""
    raw = KEY_PREFIX + secrets.token_urlsafe(32)
    key_hash = hash_key(raw)
    return raw, key_hash, raw[:DISPLAY_PREFIX_LEN]


def hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def get_api_key_user(
    credentials: HTTPAuthorizationCredentials = Depends(api_key_scheme),
    session: AsyncSession = Depends(get_session),
) -> ApiKey:
    """Authenticate a request by API key and return the owning ApiKey row.

    The caller's uid is available as the returned object's `.uid`.
    """
    raw = (credentials.credentials or "").strip()
    if not raw.startswith(KEY_PREFIX):
        raise HTTPException(status_code=401, detail="Invalid API key format")

    key_hash = hash_key(raw)
    result = await session.execute(select(ApiKey).where(ApiKey.key_hash == key_hash))
    api_key = result.scalar_one_or_none()

    if api_key is None or api_key.revoked:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key")

    api_key.last_used_at = datetime.now(timezone.utc)
    await session.commit()
    return api_key
