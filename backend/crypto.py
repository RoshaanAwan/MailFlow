"""
Symmetric encryption for secrets stored at rest (users' SMTP app passwords).

Uses Fernet (AES-128-CBC + HMAC). The key comes from ENCRYPTION_KEY; if unset,
it's derived deterministically from JWT_SECRET so local dev works with no extra
setup. Set ENCRYPTION_KEY explicitly in production — otherwise rotating
JWT_SECRET would make previously stored passwords undecryptable.
"""

from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from config import ENCRYPTION_KEY, JWT_SECRET


def _build_fernet() -> Fernet:
    if ENCRYPTION_KEY:
        key = ENCRYPTION_KEY.encode()
    else:
        # Derive a stable 32-byte Fernet key from JWT_SECRET.
        digest = hashlib.sha256(JWT_SECRET.encode()).digest()
        key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


_fernet = _build_fernet()


def encrypt(plaintext: str) -> str:
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt(token: str) -> str:
    try:
        return _fernet.decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Could not decrypt stored secret (key changed?)") from exc
