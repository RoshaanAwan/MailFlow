"""
MailFlow configuration loader.

Loads settings from environment variables (and a local .env for development).
Auth is self-hosted (JWT); sending uses each user's own SMTP account.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent


def _load_dotenv() -> None:
    load_dotenv(BACKEND_DIR / ".env")
    load_dotenv()


_load_dotenv()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Browser origins allowed to call this API (CORS). Set CORS_ORIGINS to a
# comma-separated list of your deployed frontend URL(s), e.g.
#   CORS_ORIGINS=https://mailflow.vercel.app,https://www.yourdomain.com
# FRONTEND_URL is always included. When this list is empty the API falls back to
# a permissive "*" (dev only); see main.py.
def _parse_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "")
    origins = [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]
    fe = FRONTEND_URL.strip().rstrip("/")
    # Only treat FRONTEND_URL as an allowed origin when it's a real deployed URL
    # (i.e. CORS_ORIGINS was set or FRONTEND_URL isn't the localhost default).
    if fe and (origins or fe != "http://localhost:3000"):
        if fe not in origins:
            origins.append(fe)
    return origins


CORS_ORIGINS = _parse_origins()

# Google OAuth — lets each user connect their own Gmail account so MailFlow sends
# email through it (via the Gmail API). Create an OAuth client (Web application)
# in Google Cloud Console, add GOOGLE_REDIRECT_URI to its authorized redirect
# URIs, and enable the Gmail API. See docs/GOOGLE_CONNECT_SETUP.md.
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
# Where Google redirects back after consent. Must EXACTLY match a redirect URI on
# the OAuth client. Defaults to this backend's /v1/google/callback.
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/v1/google/callback")


def google_oauth_configured() -> bool:
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)


# Public origin of THIS backend (scheme + host, no trailing slash), used to build
# absolute URLs for uploaded images so external email clients can load them.
# Prefer an explicit BACKEND_URL; otherwise derive it from GOOGLE_REDIRECT_URI
# (which already points at this backend); fall back to localhost for dev.
def backend_base_url() -> str:
    explicit = os.getenv("BACKEND_URL", "").strip().rstrip("/")
    if explicit:
        return explicit
    try:
        from urllib.parse import urlsplit
        parts = urlsplit(GOOGLE_REDIRECT_URI)
        if parts.scheme and parts.netloc:
            return f"{parts.scheme}://{parts.netloc}"
    except Exception:
        pass
    return "http://localhost:8000"


# Database. Defaults to a local SQLite file so the app runs with zero setup.
# In production set DATABASE_URL to a Postgres connection string, e.g. from Neon:
#   postgresql://user:pass@host/dbname
# db.py normalizes the scheme to the async driver.
DATABASE_URL = os.getenv("DATABASE_URL", "")

# Secret used to sign JWT auth tokens. MUST be set to a strong random value in
# production (e.g. `openssl rand -hex 32`). A dev default is used if unset.
JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-insecure-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "168"))  # 7 days

# Key for encrypting users' stored SMTP app passwords at rest. Generate with:
#   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# If unset, derived from JWT_SECRET so the app runs locally — but then changing
# JWT_SECRET makes stored SMTP passwords undecryptable. Set explicitly in production.
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "")

# System mailer (SMTP) — sends MailFlow's own verification + password-reset emails.
# For Gmail: SMTP_USER = the gmail address, SMTP_PASSWORD = a 16-char App Password
# (https://myaccount.google.com/apppasswords). If unset, the mailer logs links to
# the console instead of sending (dev fallback).
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "") or SMTP_USER
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "MailFlow")

# Resend (https://resend.com) — preferred delivery backend when configured.
# RESEND_FROM must be an address on a domain you've verified in Resend (SPF/DKIM),
# e.g. "MailFlow <hi@yourdomain.com>". For quick testing without a verified domain,
# Resend allows "onboarding@resend.dev" (delivers only to your own account email).
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
RESEND_FROM = os.getenv("RESEND_FROM", "onboarding@resend.dev")
RESEND_FROM_NAME = os.getenv("RESEND_FROM_NAME", "MailFlow")


def smtp_configured() -> bool:
    return bool(SMTP_USER and SMTP_PASSWORD)


def resend_configured() -> bool:
    return bool(RESEND_API_KEY)


def sender_configured() -> bool:
    """True if any delivery backend (Resend or shared SMTP) is available."""
    return resend_configured() or smtp_configured()


# Send quotas for the shared sender. One Gmail allows ~500/day total, so cap
# per-user and globally to protect the shared account from abuse/exhaustion.
PER_USER_DAILY_LIMIT = int(os.getenv("PER_USER_DAILY_LIMIT", "50"))
GLOBAL_DAILY_LIMIT = int(os.getenv("GLOBAL_DAILY_LIMIT", "450"))


def get_config_status() -> dict[str, Any]:
    """Non-secret diagnostics."""
    return {
        "env_file_exists": (BACKEND_DIR / ".env").is_file(),
        "frontend_url": FRONTEND_URL,
        "database_configured": bool(DATABASE_URL),
        "database_backend": "postgres" if DATABASE_URL else "sqlite (local fallback)",
        "jwt_secret_is_default": JWT_SECRET == "dev-only-insecure-change-me",
        "encryption_key_explicit": bool(ENCRYPTION_KEY),
        "system_mailer_configured": smtp_configured(),
        "google_oauth_configured": google_oauth_configured(),
    }


def log_startup_config() -> None:
    status = get_config_status()
    print("DEBUG: MailFlow config status:")
    print(f"  frontend_url={status['frontend_url']}")
    print(f"  database_backend={status['database_backend']}")
    print(f"  system_mailer_configured={status['system_mailer_configured']}")
    if status["jwt_secret_is_default"]:
        print("WARNING: JWT_SECRET is the insecure dev default — set a strong value in production.")
    if not status["system_mailer_configured"]:
        print("WARNING: System mailer (SMTP_USER/SMTP_PASSWORD) not set — verification/reset "
              "links will print to the console instead of being emailed.")
