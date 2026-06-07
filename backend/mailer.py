"""
System mailer for transactional auth emails (verification + password reset).

Delivery backends, in order of preference:
  1. Resend (HTTPS API) — used when RESEND_API_KEY is set. Works on hosts that
     block outbound SMTP (e.g. Hugging Face Spaces).
  2. SMTP (e.g. Gmail with an App Password) — when SMTP_USER/SMTP_PASSWORD are set.
  3. Console fallback — logs the message so auth flows work locally with zero setup.

This is MailFlow's *own* sender (verification/reset), separate from the user-facing
email API in providers.py / the per-user SMTP sending path.
"""

from __future__ import annotations

import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import (
    SMTP_FROM,
    SMTP_FROM_NAME,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USER,
    resend_configured,
    smtp_configured,
)


def send_email(to_email: str, subject: str, html: str, text: str | None = None) -> bool:
    """Send a system email. Returns True if sent, False if it only logged/failed.

    Never raises — auth endpoints should not 500 because mail delivery hiccuped.
    """
    # 1. Prefer Resend (HTTPS) — works where outbound SMTP is blocked.
    if resend_configured():
        if _send_via_resend(to_email, subject, html, text):
            return True
        # If Resend failed, fall through to SMTP/console rather than silently drop.

    # 2. SMTP (Gmail App Password, etc.).
    if smtp_configured():
        return _send_via_smtp(to_email, subject, html, text)

    # 3. Dev/console fallback: print so the link can be grabbed from the logs.
    print("=" * 70)
    print(f"[MAILER:console-fallback] No mailer configured — would send email:")
    print(f"  To:      {to_email}")
    print(f"  Subject: {subject}")
    print(f"  Body:    {text or _strip_tags(html)}")
    print("=" * 70)
    return False


def _send_via_resend(to_email: str, subject: str, html: str, text: str | None) -> bool:
    """Send through the Resend HTTP API (reuses providers.ResendProvider)."""
    from providers import ResendProvider, ProviderError

    try:
        provider = ResendProvider.from_config()
        # Empty from_email/from_name -> provider uses its configured RESEND_FROM.
        provider.send(
            from_name=SMTP_FROM_NAME or "MailFlow",
            from_email="",
            to_email=to_email,
            subject=subject,
            text=text or _strip_tags(html),
            html=html,
        )
        print(f"[MAILER:resend] Sent '{subject}' to {to_email}")
        return True
    except ProviderError as e:
        print(f"[MAILER:resend] ERROR sending to {to_email}: {e}")
        return False
    except Exception as e:
        print(f"[MAILER:resend] ERROR sending to {to_email}: {e}")
        return False


def _send_via_smtp(to_email: str, subject: str, html: str, text: str | None) -> bool:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM}>"
    msg["To"] = to_email
    msg.attach(MIMEText(text or _strip_tags(html), "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.starttls(context=context)
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, [to_email], msg.as_string())
        print(f"[MAILER:smtp] Sent '{subject}' to {to_email}")
        return True
    except Exception as e:
        print(f"[MAILER:smtp] ERROR sending to {to_email}: {e}")
        return False


def _strip_tags(html: str) -> str:
    """Very small HTML-to-text for the plain-text part / console fallback."""
    import re

    text = re.sub(r"<br\s*/?>", "\n", html)
    text = re.sub(r"</p>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    return text.strip()


# ----------------------------------------------------------------- templates

def _button_email(title: str, body: str, link: str, button: str) -> str:
    return f"""\
<div style="font-family:sans-serif;max-width:480px;margin:auto;color:#222">
  <h2 style="color:#6366f1">{title}</h2>
  <p>{body}</p>
  <p style="margin:28px 0">
    <a href="{link}" style="background:#6366f1;color:#fff;padding:12px 22px;
       border-radius:8px;text-decoration:none;display:inline-block">{button}</a>
  </p>
  <p style="font-size:13px;color:#666">Or paste this link into your browser:<br>
    <a href="{link}">{link}</a></p>
  <p style="font-size:12px;color:#999">If you didn't request this, you can ignore this email.</p>
</div>"""


def send_verification_email(to_email: str, link: str) -> bool:
    html = _button_email(
        "Verify your email",
        "Welcome to MailFlow! Confirm your email address to unlock sending.",
        link,
        "Verify email",
    )
    return send_email(to_email, "Verify your MailFlow email", html)


def send_reset_email(to_email: str, link: str) -> bool:
    html = _button_email(
        "Reset your password",
        "We received a request to reset your MailFlow password. This link expires in 1 hour.",
        link,
        "Reset password",
    )
    return send_email(to_email, "Reset your MailFlow password", html)
