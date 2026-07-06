"""
Tests for email verification + password reset flows.

Captures the links the mailer would send (by monkeypatching mailer functions),
so the full token round-trip is exercised without a real SMTP server.

Run:  cd backend && .venv/bin/python -m pytest test_auth_recovery.py -v
"""

# DATABASE_URL + schema setup is handled by conftest.py (session-scoped).

import urllib.parse

import pytest
from fastapi.testclient import TestClient

import main

# Capture emailed links instead of sending.
SENT = {"verify": None, "reset": None}


def _fake_send_verification(to_email, link):
    SENT["verify"] = link
    return True


def _fake_send_reset(to_email, link):
    SENT["reset"] = link
    return True


def _token_from(link):
    return urllib.parse.parse_qs(urllib.parse.urlparse(link).query)["token"][0]


@pytest.fixture(scope="module")
def client():
    # Schema is created once by conftest.py's session fixture.
    # Patch the names main.py imported.
    main.send_verification_email = _fake_send_verification
    main.send_reset_email = _fake_send_reset
    with TestClient(main.app) as c:
        yield c


def _register(client, email="user@example.com", pw="secret123"):
    SENT["verify"] = None
    r = client.post("/auth/register", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return r.json()


# ----------------------------------------------------------- verification

def test_new_user_is_unverified_and_gets_email(client):
    body = _register(client, "verify-me@example.com")
    assert body["user"]["email_verified"] is False
    assert SENT["verify"] is not None  # a verification email was "sent"


def test_verify_email_marks_verified(client):
    _register(client, "tv@example.com")
    token = _token_from(SENT["verify"])

    r = client.post(f"/auth/verify-email?token={token}")
    assert r.status_code == 200, r.text
    assert r.json()["user"]["email_verified"] is True


def test_verify_token_is_single_use(client):
    _register(client, "single@example.com")
    token = _token_from(SENT["verify"])
    assert client.post(f"/auth/verify-email?token={token}").status_code == 200
    # Second use fails.
    assert client.post(f"/auth/verify-email?token={token}").status_code == 400


def test_verify_with_bad_token_fails(client):
    r = client.post("/auth/verify-email?token=not-a-real-token")
    assert r.status_code == 400


# ----------------------------------------------------------- password reset

def test_forgot_password_always_200(client):
    # Unknown email still returns 200 (no account enumeration).
    r = client.post("/auth/forgot-password", json={"email": "nobody@example.com"})
    assert r.status_code == 200
    assert SENT["reset"] is None  # but no email actually queued


def test_reset_password_flow(client):
    _register(client, "reset-me@example.com", "oldpassword")
    SENT["reset"] = None
    assert client.post("/auth/forgot-password", json={"email": "reset-me@example.com"}).status_code == 200
    assert SENT["reset"] is not None
    token = _token_from(SENT["reset"])

    # Reset to a new password.
    r = client.post("/auth/reset-password", json={"token": token, "new_password": "newpassword"})
    assert r.status_code == 200, r.text

    # Old password no longer works; new one does.
    assert client.post("/auth/login", json={"email": "reset-me@example.com", "password": "oldpassword"}).status_code == 401
    assert client.post("/auth/login", json={"email": "reset-me@example.com", "password": "newpassword"}).status_code == 200


def test_reset_token_single_use(client):
    _register(client, "reset2@example.com", "oldpassword")
    SENT["reset"] = None
    client.post("/auth/forgot-password", json={"email": "reset2@example.com"})
    token = _token_from(SENT["reset"])
    assert client.post("/auth/reset-password", json={"token": token, "new_password": "newpassword"}).status_code == 200
    # Reusing the token fails.
    assert client.post("/auth/reset-password", json={"token": token, "new_password": "another1"}).status_code == 400


# ----------------------------------------------------------- send gate

def test_unverified_user_cannot_send_mail(client):
    """An API key from an unverified account is blocked at /v1/mail/send."""
    _register(client, "unverified@example.com")
    login = client.post("/auth/login", json={"email": "unverified@example.com", "password": "secret123"})
    jwt = login.json()["token"]
    key = client.post("/v1/keys", headers={"Authorization": f"Bearer {jwt}"}, json={"name": "k"}).json()["key"]

    r = client.post(
        "/v1/mail/send",
        headers={"Authorization": f"Bearer {key}"},
        json={"to": "x@example.com", "subject": "Hi", "text": "x"},
    )
    assert r.status_code == 403  # blocked: email not verified
