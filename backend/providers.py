"""
Email delivery providers.

A thin abstraction so the actual sending backend is swappable. Today the only
implementation is GmailProvider, which sends through the user's OAuth-connected
Gmail account (reused by both the legacy campaign flow and the new email API).
To add Amazon SES, Brevo, etc. later, implement EmailProvider.send and select
the provider where it's constructed — no API/route changes needed.
"""

from __future__ import annotations

import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional, Protocol


class ProviderError(Exception):
    """Raised when a provider cannot send (e.g. account not connected)."""


class EmailProvider(Protocol):
    def send(
        self,
        *,
        from_name: str,
        from_email: str,
        to_email: str,
        subject: str,
        text: Optional[str] = None,
        html: Optional[str] = None,
    ) -> str:
        """Send one email and return a provider message id. Raises on failure."""
        ...


def build_mime(
    *,
    from_name: str,
    from_email: str,
    to_email: str,
    subject: str,
    text: Optional[str],
    html: Optional[str],
    reply_to: Optional[str] = None,
) -> MIMEMultipart:
    """Build a MIME message with a text and/or HTML body."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_email}>" if from_name else from_email
    msg["To"] = to_email
    if reply_to:
        msg["Reply-To"] = reply_to
    if text:
        msg.attach(MIMEText(text, "plain"))
    if html:
        msg.attach(MIMEText(html, "html"))
    if not text and not html:
        # Always include at least one body part.
        msg.attach(MIMEText("", "plain"))
    return msg


class SharedSmtpProvider:
    """Sends all users' email through MailFlow's own shared SMTP account.

    Gmail forces the SMTP envelope/From to the authenticated account, so every
    message goes out as the shared address. The user's own address is set as
    Reply-To so replies reach them. Build via from_config().
    """

    def __init__(self, host: str, port: int, username: str, password: str, from_name: str = "MailFlow"):
        if not (host and username and password):
            raise ProviderError("System mailer (shared SMTP) is not configured")
        self.host = host
        self.port = int(port)
        self.username = username
        self.password = password
        self.shared_from_name = from_name

    @classmethod
    def from_config(cls) -> "SharedSmtpProvider":
        from config import (
            SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, SMTP_FROM_NAME,
        )
        return cls(
            host=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USER or SMTP_FROM,
            password=SMTP_PASSWORD,
            from_name=SMTP_FROM_NAME,
        )

    def _connect(self) -> smtplib.SMTP:
        context = ssl.create_default_context()
        server = smtplib.SMTP(self.host, self.port, timeout=20)
        server.starttls(context=context)
        server.login(self.username, self.password)
        return server

    def send(
        self,
        *,
        from_name: str,
        from_email: str,          # the user's address -> used as Reply-To
        to_email: str,
        subject: str,
        text: Optional[str] = None,
        html: Optional[str] = None,
    ) -> str:
        # Display name: prefer the user's chosen name, tagged so recipients know
        # it was sent via MailFlow. Actual From address must be the shared account.
        display_name = f"{from_name} via {self.shared_from_name}" if from_name else self.shared_from_name
        msg = build_mime(
            from_name=display_name,
            from_email=self.username,        # Gmail requires From == auth user
            to_email=to_email,
            subject=subject,
            text=text,
            html=html,
            reply_to=from_email or None,     # replies go to the actual user
        )
        try:
            server = self._connect()
            try:
                server.sendmail(self.username, [to_email], msg.as_string())
            finally:
                server.quit()
        except ProviderError:
            raise
        except Exception as e:
            raise ProviderError(f"Send failed: {e}") from e
        return msg.get("Message-ID", "")
