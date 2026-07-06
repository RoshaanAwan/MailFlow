"""
Async SQLAlchemy database layer for MailFlow's email API.

Uses Postgres in production (via DATABASE_URL, e.g. from Neon) and falls back to
a local SQLite file when DATABASE_URL is unset so the app runs with zero setup.

Only the new email-API features (API keys + email logs) use this database. The
legacy campaign flow continues to use the JSON store in main.py.
"""

from __future__ import annotations

from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config import DATABASE_URL

BACKEND_DIR = Path(__file__).resolve().parent
_SQLITE_FALLBACK = f"sqlite+aiosqlite:///{BACKEND_DIR / 'mailflow.db'}"

# libpq/psql query params that asyncpg does NOT accept as keyword args. Providers
# like Neon/Supabase append these to their connection strings; we strip them and
# translate SSL intent into asyncpg's connect_args instead.
_LIBPQ_ONLY_PARAMS = {"sslmode", "channel_binding", "gssencmode", "target_session_attrs"}


def _normalize_async_url(url: str) -> tuple[str, dict]:
    """Coerce a connection string to an async driver SQLAlchemy can use.

    Returns (url, connect_args). For Postgres we move libpq-only params (e.g.
    `sslmode=require`, which asyncpg rejects) out of the URL and request SSL via
    connect_args when the original URL asked for it.
    """
    if not url:
        return _SQLITE_FALLBACK, {}

    if url.startswith("sqlite"):
        if "+aiosqlite" not in url:
            url = url.replace("sqlite://", "sqlite+aiosqlite://", 1)
        return url, {}

    # Normalize the scheme to the asyncpg driver.
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

    # Split off the query string, drop libpq-only params, and decide on SSL.
    parts = urlsplit(url)
    kept, want_ssl = [], False
    for key, val in parse_qsl(parts.query, keep_blank_values=True):
        if key.lower() in _LIBPQ_ONLY_PARAMS:
            if key.lower() == "sslmode" and val.lower() in ("require", "verify-ca", "verify-full", "prefer", "allow"):
                want_ssl = True
            continue
        kept.append((key, val))

    cleaned = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(kept), parts.fragment))
    connect_args = {"ssl": True} if want_ssl else {}
    return cleaned, connect_args


ASYNC_DATABASE_URL, _CONNECT_ARGS = _normalize_async_url(DATABASE_URL)

engine = create_async_engine(ASYNC_DATABASE_URL, pool_pre_ping=True, connect_args=_CONNECT_ARGS)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db() -> None:
    """Create tables if they don't exist. Called once on startup."""
    # Import models so they're registered on Base.metadata before create_all.
    import models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncSession:
    """FastAPI dependency yielding an async DB session."""
    async with SessionLocal() as session:
        yield session
