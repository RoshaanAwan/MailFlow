"""
Async SQLAlchemy database layer for MailFlow's email API.

Uses Postgres in production (via DATABASE_URL, e.g. from Neon) and falls back to
a local SQLite file when DATABASE_URL is unset so the app runs with zero setup.

Only the new email-API features (API keys + email logs) use this database. The
legacy campaign flow continues to use the JSON store in main.py.
"""

from __future__ import annotations

from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config import DATABASE_URL

BACKEND_DIR = Path(__file__).resolve().parent
_SQLITE_FALLBACK = f"sqlite+aiosqlite:///{BACKEND_DIR / 'mailflow.db'}"


def _normalize_async_url(url: str) -> str:
    """Coerce a connection string to an async driver SQLAlchemy can use."""
    if not url:
        return _SQLITE_FALLBACK
    # Many providers (and SQLAlchemy docs) hand out "postgres://" or
    # "postgresql://"; the async engine needs the asyncpg driver.
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("sqlite://") and "+aiosqlite" not in url:
        return url.replace("sqlite://", "sqlite+aiosqlite://", 1)
    return url


ASYNC_DATABASE_URL = _normalize_async_url(DATABASE_URL)

engine = create_async_engine(ASYNC_DATABASE_URL, pool_pre_ping=True)
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
