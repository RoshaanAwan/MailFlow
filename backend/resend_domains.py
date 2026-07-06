"""
Thin client for Resend's Domains API (https://resend.com/docs/api-reference/domains).

Used for per-customer sending domains: create a domain, fetch its DNS records +
verification status, trigger verification, and delete. Uses stdlib urllib (no extra
dependency) and sends a User-Agent so Cloudflare doesn't block datacenter requests.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request

from config import RESEND_API_KEY

_BASE = "https://api.resend.com"


class ResendError(Exception):
    pass


def _call(method: str, path: str, body: dict | None = None) -> dict:
    if not RESEND_API_KEY:
        raise ResendError("Resend is not configured (RESEND_API_KEY missing)")
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        _BASE + path,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "MailFlow/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        try:
            detail = json.loads(e.read().decode("utf-8")).get("message", str(e))
        except Exception:
            detail = str(e)
        raise ResendError(detail) from e
    except Exception as e:
        raise ResendError(str(e)) from e


def create_domain(name: str) -> dict:
    """Create a domain. Returns {id, status, records, ...}."""
    return _call("POST", "/domains", {"name": name})


def get_domain(resend_id: str) -> dict:
    """Fetch current status + records for a domain."""
    return _call("GET", f"/domains/{resend_id}")


def verify_domain(resend_id: str) -> dict:
    """Ask Resend to re-check the DNS records now."""
    return _call("POST", f"/domains/{resend_id}/verify")


def delete_domain(resend_id: str) -> dict:
    return _call("DELETE", f"/domains/{resend_id}")
