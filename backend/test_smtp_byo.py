"""
Tests for the customer-owned SMTP ("bring your own SMTP") feature:
  - /v1/smtp CRUD  (save / get / delete / test)
  - /v1/smtp/test  connection check
  - /v1/mail/send  routing through the user's own SMTP when configured

These run with NO real auth and NO real SMTP connection:
  - The auth dependency is replaced with a fake verified user.
  - UserSmtpProvider.from_credential is replaced with a fake recorder, so the
    BYO send path is exercised without opening a socket. One test additionally
    checks the *real* provider's failure handling against a dead port.
  - The shared provider is faked too, so the fallback (no-SMTP) path is testable.
  - The database is the throwaway SQLite file from conftest.py.

Run:
  cd backend
  .venv/bin/python -m pytest test_smtp_byo.py -v
"""

# DATABASE_URL + schema setup is handled by conftest.py (session-scoped).

import asyncio
import pytest
from fastapi.testclient import TestClient

import main
import providers

SEED_EMAIL = "smtp-owner@example.com"
VERIFIED_DOMAIN = "verified.example.com"
SMTP_LOGIN = "sender@my-own-server.com"


class FakeUserSmtp:
    """Stand-in for UserSmtpProvider: records the last send instead of sending."""
    last_send = None
    last_credential = None

    def __init__(self, credential):
        FakeUserSmtp.last_credential = credential

    def send(self, **kwargs):
        FakeUserSmtp.last_send = kwargs
        return "byo-message-id-001"


class FakeSharedProvider:
    """Stand-in for the shared provider (fallback path)."""
    last_send = None

    def send(self, **kwargs):
        FakeSharedProvider.last_send = kwargs
        return "shared-message-id-001"


async def _seed_verified_user():
    """Create an email-verified user with one verified sending domain; return uid."""
    from db import SessionLocal
    from models import User, Domain
    from auth import hash_password

    async with SessionLocal() as s:
        u = User(email=SEED_EMAIL, password_hash=hash_password("x"), email_verified=True)
        s.add(u)
        await s.commit()
        await s.refresh(u)
        s.add(Domain(
            user_id=u.id, name=VERIFIED_DOMAIN, resend_id="rs_test",
            status="verified", records_json="[]",
        ))
        await s.commit()
        return str(u.id)


@pytest.fixture(scope="module")
def uid():
    return asyncio.run(_seed_verified_user())


@pytest.fixture(scope="module")
def client(uid):
    fake_user = {"uid": uid, "email": SEED_EMAIL}

    # Override auth -> the seeded verified user (bypasses JWT verification).
    main.app.dependency_overrides[main.get_current_user] = lambda: fake_user
    # Fake the shared provider (used by the fallback path).
    main.get_shared_provider = lambda: FakeSharedProvider()
    # Fake the BYO provider builder, so /v1/mail/send never opens a real socket.
    # Stash the GENUINE original so a test can restore it to exercise the real
    # connector (see test_real_provider_failure_is_logged_as_failed).
    providers.UserSmtpProvider._real_from_credential = providers.UserSmtpProvider.from_credential
    providers.UserSmtpProvider.from_credential = classmethod(
        lambda cls, cred: FakeUserSmtp(cred)
    )

    with TestClient(main.app) as c:
        yield c

    providers.UserSmtpProvider.from_credential = providers.UserSmtpProvider._real_from_credential
    del providers.UserSmtpProvider._real_from_credential
    main.app.dependency_overrides.clear()


@pytest.fixture
def api_key(client):
    """Create a fresh key and return its raw value."""
    res = client.post("/v1/keys", json={"name": "BYO Key"})
    assert res.status_code == 200
    return res.json()["key"]


@pytest.fixture(autouse=True)
def _reset_smtp(client):
    """Each test starts with NO saved SMTP credentials (clean slate)."""
    client.delete("/v1/smtp")
    FakeUserSmtp.last_send = None
    FakeUserSmtp.last_credential = None
    FakeSharedProvider.last_send = None
    yield
    client.delete("/v1/smtp")


VALID_SMTP = {
    "host": "smtp.my-own-server.com",
    "port": 587,
    "username": SMTP_LOGIN,
    "password": "app-password-123",
    "from_name": "My Company",
}


# ============================================================
#  /v1/smtp  CRUD
# ============================================================

def test_get_smtp_unconfigured_returns_false(client):
    res = client.get("/v1/smtp")
    assert res.status_code == 200
    assert res.json() == {"configured": False}


def test_save_smtp_returns_configured_without_password(client):
    res = client.post("/v1/smtp", json=VALID_SMTP)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["configured"] is True
    assert body["host"] == VALID_SMTP["host"]
    assert body["port"] == 587
    assert body["username"] == SMTP_LOGIN
    assert body["from_name"] == "My Company"
    # The password (plaintext or encrypted) must never be returned.
    assert "password" not in body
    assert "password_encrypted" not in body


def test_get_after_save_reflects_values_and_hides_password(client):
    client.post("/v1/smtp", json=VALID_SMTP)
    res = client.get("/v1/smtp")
    assert res.status_code == 200
    body = res.json()
    assert body["configured"] is True
    assert body["username"] == SMTP_LOGIN
    assert "password" not in body


def test_password_is_stored_encrypted_not_plaintext(client, uid):
    client.post("/v1/smtp", json=VALID_SMTP)
    # Read the row straight from the DB and confirm it is NOT the plaintext.
    from db import SessionLocal
    from models import SmtpCredential
    from sqlalchemy import select
    import crypto

    async def fetch():
        async with SessionLocal() as s:
            row = (await s.execute(
                select(SmtpCredential).where(SmtpCredential.user_id == int(uid))
            )).scalar_one()
            return row.password_encrypted

    stored = asyncio.run(fetch())
    assert stored != VALID_SMTP["password"]
    assert "app-password-123" not in stored
    # And it must decrypt back to the original (round-trip).
    assert crypto.decrypt(stored) == VALID_SMTP["password"]


def test_save_smtp_is_upsert_not_duplicate(client, uid):
    client.post("/v1/smtp", json=VALID_SMTP)
    client.post("/v1/smtp", json={**VALID_SMTP, "host": "smtp2.example.com", "port": 2525})
    res = client.get("/v1/smtp")
    assert res.json()["host"] == "smtp2.example.com"
    assert res.json()["port"] == 2525
    # Only one row should exist for this user (unique user_id).
    from db import SessionLocal
    from models import SmtpCredential
    from sqlalchemy import select, func

    async def count():
        async with SessionLocal() as s:
            return (await s.execute(
                select(func.count()).select_from(SmtpCredential)
                .where(SmtpCredential.user_id == int(uid))
            )).scalar_one()

    assert asyncio.run(count()) == 1


def test_delete_smtp_is_idempotent(client):
    # Delete when nothing is saved -> still 200.
    assert client.delete("/v1/smtp").status_code == 200
    client.post("/v1/smtp", json=VALID_SMTP)
    assert client.delete("/v1/smtp").status_code == 200
    assert client.get("/v1/smtp").json() == {"configured": False}


@pytest.mark.parametrize("bad", [
    {"port": 0},
    {"port": 70000},
    {"host": ""},
    {"password": ""},
])
def test_save_smtp_rejects_invalid_input(client, bad):
    res = client.post("/v1/smtp", json={**VALID_SMTP, **bad})
    assert res.status_code == 422, res.text


def test_save_smtp_rejects_non_email_username(client):
    res = client.post("/v1/smtp", json={**VALID_SMTP, "username": "not-an-email"})
    assert res.status_code == 422  # EmailStr rejects it


def test_smtp_endpoints_require_auth():
    """Without the auth override, the endpoints reject anonymous callers."""
    saved = dict(main.app.dependency_overrides)
    main.app.dependency_overrides.clear()
    try:
        with TestClient(main.app) as c:
            assert c.get("/v1/smtp").status_code in (401, 403)
            assert c.post("/v1/smtp", json=VALID_SMTP).status_code in (401, 403)
            assert c.delete("/v1/smtp").status_code in (401, 403)
    finally:
        # Restore exactly the overrides that were in place (the seeded fake user).
        main.app.dependency_overrides.clear()
        main.app.dependency_overrides.update(saved)


# ============================================================
#  /v1/smtp/test  connection check (uses the REAL provider)
# ============================================================

def test_smtp_test_dead_port_returns_ok_false(client):
    """A dead port should report ok:false with an error (not raise)."""
    res = client.post("/v1/smtp/test", json={
        "host": "127.0.0.1", "port": 65000,
        "username": "u@example.com", "password": "x",
    })
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is False
    assert "error" in body and body["error"]


# ============================================================
#  /v1/mail/send  routing
# ============================================================

def test_send_uses_byo_smtp_when_configured(client, api_key):
    """With SMTP saved, send goes through the user's OWN provider."""
    client.post("/v1/smtp", json=VALID_SMTP)
    res = client.post(
        "/v1/mail/send",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"from": "anything@elsewhere.com", "to": "rcpt@example.com",
              "subject": "Hi", "html": "<b>Hello</b>"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "sent"
    # The BYO provider was used, NOT the shared one.
    assert FakeUserSmtp.last_send is not None
    assert FakeSharedProvider.last_send is None
    assert FakeUserSmtp.last_send["to_email"] == "rcpt@example.com"
    assert FakeUserSmtp.last_send["html"] == "<b>Hello</b>"


def test_byo_send_allows_any_from_address(client, api_key):
    """BYO path imposes no verified-domain restriction on 'from'."""
    client.post("/v1/smtp", json=VALID_SMTP)
    res = client.post(
        "/v1/mail/send",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"from": "marketing@totally-unverified.io", "to": "rcpt@example.com",
              "subject": "Hi", "text": "x"},
    )
    assert res.status_code == 200, res.text
    assert FakeUserSmtp.last_send["from_email"] == "marketing@totally-unverified.io"


def test_byo_send_defaults_from_to_smtp_username(client, api_key):
    """If 'from' is omitted, the BYO path uses the SMTP login address."""
    client.post("/v1/smtp", json=VALID_SMTP)
    res = client.post(
        "/v1/mail/send",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"to": "rcpt@example.com", "subject": "Hi", "text": "x"},
    )
    assert res.status_code == 200, res.text
    assert FakeUserSmtp.last_send["from_email"] == SMTP_LOGIN


def test_send_without_smtp_falls_back_to_shared_domain_gate(client, api_key):
    """With NO SMTP saved, an unverified 'from' domain is rejected (fallback path)."""
    res = client.post(
        "/v1/mail/send",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"from": "hi@totally-unverified.io", "to": "rcpt@example.com",
              "subject": "Hi", "text": "x"},
    )
    assert res.status_code == 403  # shared path still enforces verified domains
    assert "verified sending domain" in res.json()["detail"].lower()


def test_send_without_smtp_uses_shared_for_verified_domain(client, api_key):
    """With NO SMTP saved, a verified-domain 'from' goes through the shared provider."""
    res = client.post(
        "/v1/mail/send",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"from": f"hi@{VERIFIED_DOMAIN}", "to": "rcpt@example.com",
              "subject": "Hi", "text": "x"},
    )
    assert res.status_code == 200, res.text
    assert FakeSharedProvider.last_send is not None
    assert FakeUserSmtp.last_send is None


def test_byo_send_still_requires_text_or_html(client, api_key):
    client.post("/v1/smtp", json=VALID_SMTP)
    res = client.post(
        "/v1/mail/send",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"from": SMTP_LOGIN, "to": "rcpt@example.com", "subject": "Hi"},
    )
    assert res.status_code == 422


def test_byo_send_records_activity_log(client, api_key):
    client.post("/v1/smtp", json=VALID_SMTP)
    client.post(
        "/v1/mail/send",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"from": SMTP_LOGIN, "to": "byo-logged@example.com",
              "subject": "Logged", "text": "x"},
    )
    logs = client.get("/v1/logs").json()
    match = [l for l in logs if l["to"] == "byo-logged@example.com"]
    assert match, "expected the BYO send to appear in the activity log"
    assert match[0]["status"] == "sent"


def test_real_provider_failure_is_logged_as_failed(client, api_key, uid):
    """
    End-to-end-ish: temporarily restore the REAL UserSmtpProvider so the send
    actually tries (and fails) to reach a dead SMTP host. The send must return
    a 4xx/5xx and write a 'failed' EmailLog row — not silently succeed.
    """
    # Save creds pointing at a dead local port.
    client.post("/v1/smtp", json={**VALID_SMTP, "host": "127.0.0.1", "port": 65000})

    fake = providers.UserSmtpProvider.from_credential
    # Swap in the genuine connector (stashed by the client fixture).
    providers.UserSmtpProvider.from_credential = providers.UserSmtpProvider._real_from_credential
    try:
        res = client.post(
            "/v1/mail/send",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"from": SMTP_LOGIN, "to": "byo-fail@example.com",
                  "subject": "Dead", "text": "x"},
        )
        assert res.status_code in (400, 502), res.text
    finally:
        # Restore the fake for the remaining tests.
        providers.UserSmtpProvider.from_credential = fake

    logs = client.get("/v1/logs").json()
    match = [l for l in logs if l["to"] == "byo-fail@example.com"]
    assert match, "expected the failed BYO send to be logged"
    assert match[0]["status"] == "failed"
    assert match[0]["error"]
