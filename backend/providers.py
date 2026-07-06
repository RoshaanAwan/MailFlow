"""
Email delivery providers.

A thin abstraction so the actual sending backend is swappable. Implementations:
<<<<<<< HEAD
  - GmailApiProvider: sends through a user's OAuth-connected Gmail account via the
    Gmail HTTP API (works on hosts that block outbound SMTP).
  - SharedSmtpProvider: sends through MailFlow's own shared SMTP account.
To add Amazon SES, Brevo, etc. later, implement EmailProvider.send and select the
provider where it's constructed — no API/route changes needed.
=======
  - SharedSmtpProvider: sends every user's mail through MailFlow's own shared SMTP
    account (From forced to the shared address, user's address set as Reply-To).
  - ResendProvider: sends via the Resend HTTP API from a verified domain.
  - UserSmtpProvider: sends through a customer's OWN SMTP credentials (BYO-SMTP);
    From is the customer's own address, no Reply-To rewrite.
To add Amazon SES, Brevo, etc. later, implement EmailProvider.send and select
the provider where it's constructed — no API/route changes needed.
>>>>>>> ad3a596b465096fa9037e43daebb53d1bd012960
"""

from __future__ import annotations

<<<<<<< HEAD
import base64
=======
>>>>>>> ad3a596b465096fa9037e43daebb53d1bd012960
import json
import smtplib
import ssl
import urllib.error
<<<<<<< HEAD
import urllib.parse
=======
>>>>>>> ad3a596b465096fa9037e43daebb53d1bd012960
import urllib.request
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


<<<<<<< HEAD
class GmailApiProvider:
    """Sends through a user's own Gmail account via the Gmail HTTP API.

    Uses the user's stored OAuth refresh token to mint a short-lived access token,
    then calls users.messages.send. The email goes out AS the connected Gmail
    address (Gmail sets the authenticated account as the From). Works on hosts
    that block outbound SMTP, since it's all HTTPS. Build via from_refresh_token().
    """

    TOKEN_URL = "https://oauth2.googleapis.com/token"
    SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"

    def __init__(self, client_id: str, client_secret: str, refresh_token: str,
                 sender_email: str, from_name: str = ""):
        if not (client_id and client_secret and refresh_token):
            raise ProviderError("Google account is not connected")
        self.client_id = client_id
        self.client_secret = client_secret
        self.refresh_token = refresh_token
        self.sender_email = sender_email
        self.from_name = from_name

    @classmethod
    def from_refresh_token(cls, refresh_token: str, sender_email: str, from_name: str = "") -> "GmailApiProvider":
        from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
        return cls(
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
            refresh_token=refresh_token,
            sender_email=sender_email,
            from_name=from_name,
        )

    def _access_token(self) -> str:
        data = urllib.parse.urlencode({
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": self.refresh_token,
            "grant_type": "refresh_token",
        }).encode("utf-8")
        req = urllib.request.Request(self.TOKEN_URL, data=data, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                body = json.loads(resp.read().decode("utf-8"))
            return body["access_token"]
        except urllib.error.HTTPError as e:
            try:
                detail = json.loads(e.read().decode("utf-8")).get("error_description", str(e))
            except Exception:
                detail = str(e)
            raise ProviderError(f"Google auth failed (reconnect your account): {detail}") from e
        except Exception as e:
            raise ProviderError(f"Google auth failed: {e}") from e
=======
class UserSmtpProvider:
    """Sends through a customer's OWN SMTP credentials (BYO-SMTP).

    Unlike SharedSmtpProvider, there's no shared account: the From address is the
    customer's own address and there's no Reply-To rewrite or "via MailFlow" tag —
    the mail goes out as if sent directly from their server. Build via
    from_credential() from a stored SmtpCredential row (password decrypted).
    """

    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        from_email: str,
        from_name: str = "",
    ):
        if not (host and username and password):
            raise ProviderError("SMTP settings are incomplete (host, username and password are required)")
        self.host = host
        self.port = int(port)
        self.username = username
        self.password = password
        self.from_email = from_email or username
        self.from_name = from_name

    @classmethod
    def from_credential(cls, cred) -> "UserSmtpProvider":
        # Imported lazily to avoid an import cycle (mirrors from_config above).
        from crypto import decrypt

        try:
            password = decrypt(cred.password_encrypted)
        except Exception as e:
            raise ProviderError(f"Could not read stored SMTP password: {e}") from e
        return cls(
            host=cred.host,
            port=cred.port,
            username=cred.username,
            password=password,
            from_email=cred.username,  # login doubles as the From address
            from_name=cred.from_name or "",
        )

    def _connect(self) -> smtplib.SMTP:
        context = ssl.create_default_context()
        server = smtplib.SMTP(self.host, self.port, timeout=20)
        server.starttls(context=context)
        server.login(self.username, self.password)
        return server

    def verify_connection(self) -> None:
        """Connect + authenticate without sending. Raises ProviderError on failure."""
        try:
            server = self._connect()
            server.quit()
        except ProviderError:
            raise
        except Exception as e:
            raise ProviderError(f"SMTP connection failed: {e}") from e
>>>>>>> ad3a596b465096fa9037e43daebb53d1bd012960

    def send(
        self,
        *,
        from_name: str,
<<<<<<< HEAD
        from_email: str,          # ignored for the envelope; Gmail sends AS the connected account
=======
        from_email: str,          # the sender address (customer's own; any address allowed)
>>>>>>> ad3a596b465096fa9037e43daebb53d1bd012960
        to_email: str,
        subject: str,
        text: Optional[str] = None,
        html: Optional[str] = None,
    ) -> str:
<<<<<<< HEAD
        msg = build_mime(
            from_name=from_name or self.from_name,
            from_email=self.sender_email,   # Gmail forces From == authenticated account
=======
        sender = from_email or self.from_email
        msg = build_mime(
            from_name=from_name or self.from_name,
            from_email=sender,
>>>>>>> ad3a596b465096fa9037e43daebb53d1bd012960
            to_email=to_email,
            subject=subject,
            text=text,
            html=html,
        )
<<<<<<< HEAD
        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")
        token = self._access_token()
        payload = json.dumps({"raw": raw}).encode("utf-8")
        req = urllib.request.Request(
            self.SEND_URL,
            data=payload,
            method="POST",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
=======
        try:
            server = self._connect()
            try:
                server.sendmail(sender, [to_email], msg.as_string())
            finally:
                server.quit()
        except ProviderError:
            raise
        except Exception as e:
            raise ProviderError(f"Send failed: {e}") from e
        return msg.get("Message-ID", "")


class ResendProvider:
    """Sends via the Resend HTTP API (https://resend.com).

    The envelope From is RESEND_FROM (an address on a domain you've verified in
    Resend). The user's chosen name is shown in the display name and their own
    address is set as Reply-To, so replies reach them — same UX as the shared
    SMTP sender, but with proper domain-based deliverability.
    """

    API_URL = "https://api.resend.com/emails"

    def __init__(self, api_key: str, from_email: str, from_name: str = "MailFlow"):
        if not api_key:
            raise ProviderError("Resend is not configured (RESEND_API_KEY missing)")
        self.api_key = api_key
        self.from_email = from_email
        self.from_name = from_name

    @classmethod
    def from_config(cls) -> "ResendProvider":
        from config import RESEND_API_KEY, RESEND_FROM, RESEND_FROM_NAME
        return cls(api_key=RESEND_API_KEY, from_email=RESEND_FROM, from_name=RESEND_FROM_NAME)

    def send(
        self,
        *,
        from_name: str,
        from_email: str,          # the sender address (must be on a verified domain)
        to_email: str,
        subject: str,
        text: Optional[str] = None,
        html: Optional[str] = None,
    ) -> str:
        # If a from_email is supplied (per-domain sending), send AS that address.
        # Otherwise fall back to the configured shared address.
        if from_email:
            sender = f"{from_name} <{from_email}>" if from_name else from_email
        else:
            display_name = f"{from_name} via {self.from_name}" if from_name else self.from_name
            sender = f"{display_name} <{self.from_email}>"
        payload = {
            "from": sender,
            "to": [to_email],
            "subject": subject,
        }
        if html:
            payload["html"] = html
        if text:
            payload["text"] = text
        if not html and not text:
            payload["text"] = ""

        data = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            self.API_URL,
            data=data,
            method="POST",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "User-Agent": "MailFlow/1.0",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as resp:
>>>>>>> ad3a596b465096fa9037e43daebb53d1bd012960
                body = json.loads(resp.read().decode("utf-8"))
            return body.get("id", "")
        except urllib.error.HTTPError as e:
            try:
<<<<<<< HEAD
                detail = json.loads(e.read().decode("utf-8")).get("error", {}).get("message", str(e))
            except Exception:
                detail = str(e)
            raise ProviderError(f"Gmail send failed: {detail}") from e
        except Exception as e:
            raise ProviderError(f"Gmail send failed: {e}") from e
=======
                detail = json.loads(e.read().decode("utf-8")).get("message", str(e))
            except Exception:
                detail = str(e)
            raise ProviderError(f"Resend rejected the email: {detail}") from e
        except Exception as e:
            raise ProviderError(f"Resend send failed: {e}") from e
>>>>>>> ad3a596b465096fa9037e43daebb53d1bd012960
