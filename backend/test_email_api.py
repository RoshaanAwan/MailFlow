"""
Tests for the MailFlow email API (API keys, /v1/mail/send, activity logs).

These run with NO real auth or Gmail credentials:
  - The auth dependency is replaced with a fake user.
  - The Gmail provider is replaced with a fake that records calls instead of
    sending real email.
  - The database uses a throwaway local SQLite file.

Run:
  cd backend
  .venv/bin/pip install pytest         # one time
  .venv/bin/python -m pytest -v
"""

# DATABASE_URL + schema setup is handled by conftest.py (session-scoped).

import asyncio
import pytest
from fastapi.testclient import TestClient

import main

SEED_EMAIL = "key-owner@example.com"


class FakeProvider:
    """Stand-in for SmtpProvider: records the last send instead of sending."""
    last_send = None
    username = SEED_EMAIL

    def send(self, **kwargs):
        FakeProvider.last_send = kwargs
        return "fake-message-id-001"


async def _seed_verified_user():
    """Create a real, email-verified user with a connected Google account; return uid."""
    from db import SessionLocal
    from models import User, GoogleAccount
    from auth import hash_password
    import crypto

    async with SessionLocal() as s:
        u = User(email=SEED_EMAIL, password_hash=hash_password("x"), email_verified=True)
        s.add(u)
        await s.commit()
        await s.refresh(u)
        s.add(GoogleAccount(
            user_id=u.id,
            google_email=SEED_EMAIL,
            refresh_token_encrypted=crypto.encrypt("fake-refresh-token"),
            from_name="",
        ))
        await s.commit()
        return str(u.id)


@pytest.fixture(scope="module")
def client():
    # Schema is created once by conftest.py's session fixture.
    uid = asyncio.run(_seed_verified_user())
    fake_user = {"uid": uid, "email": SEED_EMAIL}

    # Override auth -> the seeded verified user (bypasses JWT verification).
    main.app.dependency_overrides[main.get_current_user] = lambda: fake_user
    # Override the per-user Gmail provider -> fake (no real Gmail API call).
    async def _fake_gmail(session, uid):
        return FakeProvider()
    main.get_user_gmail_provider = _fake_gmail

    with TestClient(main.app) as c:
        yield c

    main.app.dependency_overrides.clear()


@pytest.fixture
def api_key(client):
    """Create a fresh key and return its raw value."""
    res = client.post("/v1/keys", json={"name": "Test Key"})
    assert res.status_code == 200
    return res.json()["key"]


# ---------------------------------------------------------------- key management

def test_create_key_returns_raw_key_once(client):
    res = client.post("/v1/keys", json={"name": "My Key"})
    assert res.status_code == 200
    body = res.json()
    assert body["key"].startswith("mf_live_")
    assert body["prefix"].startswith("mf_live_")
    assert body["name"] == "My Key"
    assert body["revoked"] is False


def test_list_keys_never_exposes_raw_key(client):
    client.post("/v1/keys", json={"name": "Listed Key"})
    res = client.get("/v1/keys")
    assert res.status_code == 200
    keys = res.json()
    assert len(keys) >= 1
    for k in keys:
        assert "key" not in k  # raw key must never appear in a list


# ---------------------------------------------------------------- sending email

def test_send_with_valid_key_succeeds(client, api_key):
    res = client.post(
        "/v1/mail/send",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"to": "rcpt@example.com", "subject": "Hi", "html": "<b>Hello</b>"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "sent"
    assert body["message_id"] == "fake-message-id-001"
    # The provider actually received our content.
    assert FakeProvider.last_send["to_email"] == "rcpt@example.com"
    assert FakeProvider.last_send["html"] == "<b>Hello</b>"


def test_send_defaults_from_to_connected_account(client, api_key):
    client.post(
        "/v1/mail/send",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"to": "rcpt@example.com", "subject": "Hi", "text": "x"},
    )
    assert FakeProvider.last_send["from_email"] == SEED_EMAIL


def test_send_requires_text_or_html(client, api_key):
    res = client.post(
        "/v1/mail/send",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"to": "rcpt@example.com", "subject": "Hi"},
    )
    assert res.status_code == 422


def test_send_validates_email_address(client, api_key):
    res = client.post(
        "/v1/mail/send",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"to": "not-an-email", "subject": "Hi", "text": "x"},
    )
    assert res.status_code == 422  # EmailStr rejects it


# ---------------------------------------------------------------- auth failures

def test_send_rejects_malformed_key(client):
    res = client.post(
        "/v1/mail/send",
        headers={"Authorization": "Bearer not-a-real-key"},
        json={"to": "rcpt@example.com", "subject": "Hi", "text": "x"},
    )
    assert res.status_code == 401


def test_send_rejects_unknown_key(client):
    res = client.post(
        "/v1/mail/send",
        headers={"Authorization": "Bearer mf_live_doesnotexist00000000000000000000000"},
        json={"to": "rcpt@example.com", "subject": "Hi", "text": "x"},
    )
    assert res.status_code == 401


def test_send_requires_authorization_header(client):
    res = client.post(
        "/v1/mail/send",
        json={"to": "rcpt@example.com", "subject": "Hi", "text": "x"},
    )
    assert res.status_code in (401, 403)  # missing Bearer credentials


# ---------------------------------------------------------------- revocation

def test_revoked_key_cannot_send(client):
    raw = client.post("/v1/keys", json={"name": "Doomed"}).json()
    key, key_id = raw["key"], raw["id"]

    # Works before revoke.
    ok = client.post(
        "/v1/mail/send",
        headers={"Authorization": f"Bearer {key}"},
        json={"to": "rcpt@example.com", "subject": "Hi", "text": "x"},
    )
    assert ok.status_code == 200

    # Revoke it.
    assert client.delete(f"/v1/keys/{key_id}").status_code == 200

    # Now blocked.
    blocked = client.post(
        "/v1/mail/send",
        headers={"Authorization": f"Bearer {key}"},
        json={"to": "rcpt@example.com", "subject": "Hi", "text": "x"},
    )
    assert blocked.status_code == 401


# ---------------------------------------------------------------- activity log

def test_activity_log_records_sent_email(client, api_key):
    client.post(
        "/v1/mail/send",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"to": "logged@example.com", "subject": "Logged", "text": "x"},
    )
    res = client.get("/v1/logs")
    assert res.status_code == 200
    logs = res.json()
    match = [l for l in logs if l["to"] == "logged@example.com"]
    assert match, "expected the sent email to appear in the activity log"
    assert match[0]["status"] == "sent"
    assert match[0]["message_id"] == "fake-message-id-001"


# ---------------------------------------------------------------- rate limiting

def test_daily_send_limit_returns_429(client, api_key):
    """Once the per-user daily cap is hit, /v1/mail/send returns 429."""
    # Lower the cap to whatever's already been sent today, so the next send trips it.
    used = client.get("/v1/quota").json()["used"]
    original = main.PER_USER_DAILY_LIMIT
    main.PER_USER_DAILY_LIMIT = used  # already at the cap
    try:
        res = client.post(
            "/v1/mail/send",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"to": "blocked@example.com", "subject": "Hi", "text": "x"},
        )
        assert res.status_code == 429
    finally:
        main.PER_USER_DAILY_LIMIT = original


def test_quota_endpoint(client):
    res = client.get("/v1/quota")
    assert res.status_code == 200
    data = res.json()
    assert "used" in data and "limit" in data and "remaining" in data
