"""
Shared pytest configuration.

db.engine is created once, at import time, from DATABASE_URL. So every test
module in a pytest run must agree on the same value — set it here before any
app module is imported, and create the schema once per session.
"""

import os

# Single throwaway SQLite DB for the whole test session.
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./_test.db")

import asyncio

import pytest


@pytest.fixture(scope="session", autouse=True)
def _setup_database():
    # Start each session from a clean file, then create tables.
    if os.path.exists("_test.db"):
        os.remove("_test.db")
    from db import init_db

    asyncio.run(init_db())
    yield
    if os.path.exists("_test.db"):
        os.remove("_test.db")
