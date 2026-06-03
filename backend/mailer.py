"""
System mailer for transactional auth emails (verification + password reset).

Sends via SMTP (e.g. Gmail with an App Password). If SMTP credentials aren't
configured, it falls back to logging the message to the console so the auth
flows work locally with zero setup.

This is separate from the user-facing email API (providers.py / Gmail OAuth):
this account is MailFlow's *own* sender, used before a user has connected Gmail.
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
    smtp_configured,
)


def send_email(to_email: str, subject: str, html: str, text: str | None = None) -> bool:
    """Send a system email. Returns True if sent, False if it only logged/failed.

    Never raises — auth endpoints should not 500 because mail delivery hiccuped.
    """
    if not smtp_configured():
        # Dev fallback: print so the developer can grab the link from the console.
        print("=" * 70)
        print(f"[MAILER:console-fallback] SMTP not configured — would send email:")
        print(f"  To:      {to_email}")
        print(f"  Subject: {subject}")
        print(f"  Body:    {text or _strip_tags(html)}")
        print("=" * 70)
        return False

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
        print(f"[MAILER] Sent '{subject}' to {to_email}")
        return True
    except Exception as e:
        print(f"[MAILER] ERROR sending to {to_email}: {e}")
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
