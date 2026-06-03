"""
MailFlow — FastAPI Backend
==========================
Self-hosted auth (JWT) + email sending via each user's own SMTP account
(e.g. Gmail App Password). Campaign management and a SendGrid-style email API.

RUN:
  uvicorn main:app --reload --port 8000
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, BackgroundTasks, Request, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import pandas as pd
import time
import io
import uuid
from datetime import datetime, timezone

from config import (
    FRONTEND_URL,
    GLOBAL_DAILY_LIMIT,
    PER_USER_DAILY_LIMIT,
    get_config_status,
    log_startup_config,
    smtp_configured,
)
from providers import SharedSmtpProvider, ProviderError
from db import get_session, init_db
from models import ApiKey, EmailLog, User
from api_keys import generate_api_key, get_api_key_user
from auth import (
    consume_auth_token,
    create_access_token,
    create_auth_token,
    get_current_user,
    hash_password,
    verify_password,
)
from mailer import send_reset_email, send_verification_email

VERIFY_TOKEN_TTL_HOURS = 24
RESET_TOKEN_TTL_HOURS = 1
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession


@asynccontextmanager
async def lifespan(app: FastAPI):
    log_startup_config()
    await init_db()
    yield


app = FastAPI(title="MailFlow API", version="1.0.0", lifespan=lifespan)

# Allow React frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"DEBUG: Request {request.method} {request.url}")
    response = await call_next(request)
    print(f"DEBUG: Response status {response.status_code}")
    return response

# In-memory campaign status. (Campaigns are fire-and-forget background tasks;
# status is transient and does not need to survive a restart.)
campaigns = {}    # { campaign_id: status_dict }

# ============================================================
#  HELPERS
# ============================================================

# get_current_user is provided by auth.py (self-hosted JWT), returning {"uid","email"}.

def get_shared_provider() -> Optional[SharedSmtpProvider]:
    """The single shared sender all users send through, or None if not configured."""
    if not smtp_configured():
        return None
    return SharedSmtpProvider.from_config()


async def _sent_today(session: AsyncSession, uid: Optional[str] = None) -> int:
    """Count successful sends since UTC midnight, globally or for one user."""
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    q = select(func.count(EmailLog.id)).where(
        EmailLog.status == "sent", EmailLog.created_at >= start
    )
    if uid is not None:
        q = q.where(EmailLog.uid == uid)
    return (await session.execute(q)).scalar_one()


async def check_send_quota(session: AsyncSession, uid: str) -> None:
    """Raise HTTPException(429) if the user or the global daily cap is reached."""
    if await _sent_today(session, uid) >= PER_USER_DAILY_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Daily send limit reached ({PER_USER_DAILY_LIMIT}/day). Try again tomorrow.",
        )
    if await _sent_today(session) >= GLOBAL_DAILY_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="The shared sending pool is busy right now. Please try again later.",
        )

# ============================================================
#  MODELS
# ============================================================

class CampaignRequest(BaseModel):
    campaign_name: str
    subject: str
    body: str
    sender_name: str
    sender_email: str
    delay_seconds: int = 10
    daily_limit: int = 20

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class ApiKeyCreateRequest(BaseModel):
    name: str = "API Key"

class MailSendRequest(BaseModel):
    to: EmailStr
    subject: str
    from_email: Optional[EmailStr] = None
    from_name: Optional[str] = ""
    text: Optional[str] = None
    html: Optional[str] = None

# ============================================================
#  EMAIL SENDER (SMTP)
# ============================================================

def _safe_format(template: str, name: str, company: str) -> str:
    """Fill {name}/{company}; leave any other {placeholder} intact instead of crashing."""
    class _Default(dict):
        def __missing__(self, key):
            return "{" + key + "}"
    return template.format_map(_Default(name=name, company=company))

def send_campaign_task(campaign_id: str, contacts: list, config: CampaignRequest, sender_email: str):
    campaigns[campaign_id] = {"status": "running", "sent": 0, "failed": 0, "total": len(contacts)}

    try:
        provider = get_shared_provider()
        if provider is None:
            raise ProviderError("System mailer not configured")
    except ProviderError as e:
        campaigns[campaign_id]["status"] = f"error: {e}"
        return

    for row in contacts:
        if campaigns[campaign_id].get("cancelled"):
            break
        if campaigns[campaign_id]["sent"] >= config.daily_limit:
            break

        name    = row.get("name", "there")
        email   = str(row.get("email", "")).strip()
        company = row.get("company", "your company")

        if not email:
            continue

        try:
            subject = _safe_format(config.subject, name, company)
            body    = _safe_format(config.body, name, company)

            provider.send(
                from_name=config.sender_name,
                from_email=config.sender_email,
                to_email=email,
                subject=subject,
                text=body,
            )
            campaigns[campaign_id]["sent"] += 1
        except Exception as e:
            campaigns[campaign_id]["failed"] += 1
            print(f"Campaign send error to {email}: {e}")

        time.sleep(config.delay_seconds)

    campaigns[campaign_id]["status"] = "completed"

# ============================================================
#  SENDING QUOTA (shared sender — no per-user connection needed)
# ============================================================

@app.get("/v1/quota")
async def get_quota(user=Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    """How many emails this user has sent today vs their daily limit."""
    used = await _sent_today(session, user["uid"])
    return {
        "used": used,
        "limit": PER_USER_DAILY_LIMIT,
        "remaining": max(0, PER_USER_DAILY_LIMIT - used),
        "sender_ready": smtp_configured(),
    }

# ============================================================
#  CAMPAIGN ROUTES
# ============================================================

@app.get("/")
def root():
    return {"message": "MailFlow API is running"}

@app.get("/config/status")
def config_status():
    """Non-secret diagnostics for missing configuration."""
    return get_config_status()

# ============================================================
#  AUTHENTICATION (self-hosted email + password, JWT)
# ============================================================

def _user_dict(user: User) -> dict:
    return {"uid": str(user.id), "email": user.email, "email_verified": user.email_verified}

async def _send_verification(session: AsyncSession, user: User) -> None:
    raw = await create_auth_token(session, user.id, "verify", VERIFY_TOKEN_TTL_HOURS)
    link = f"{FRONTEND_URL.rstrip('/')}/verify-email?token={raw}"
    send_verification_email(user.email, link)

@app.post("/auth/register")
async def register(req: RegisterRequest, session: AsyncSession = Depends(get_session)):
    email = req.email.lower().strip()
    if len(req.password) < 6:
        raise HTTPException(status_code=422, detail="Password must be at least 6 characters")

    existing = await session.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user = User(email=email, password_hash=hash_password(req.password))
    session.add(user)
    await session.commit()
    await session.refresh(user)

    await _send_verification(session, user)

    token = create_access_token(user)
    return {"token": token, "user": _user_dict(user)}

@app.post("/auth/login")
async def login(req: LoginRequest, session: AsyncSession = Depends(get_session)):
    email = req.email.lower().strip()
    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user)
    return {"token": token, "user": _user_dict(user)}

@app.get("/auth/me")
async def me(user=Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    """Return the current user; used by the frontend to validate a stored token."""
    db_user = (
        await session.execute(select(User).where(User.id == int(user["uid"])))
    ).scalar_one_or_none()
    if db_user is None:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return {"user": _user_dict(db_user)}

@app.post("/auth/change-password")
async def change_password(
    req: ChangePasswordRequest,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if len(req.new_password) < 6:
        raise HTTPException(status_code=422, detail="New password must be at least 6 characters")

    result = await session.execute(select(User).where(User.id == int(user["uid"])))
    db_user = result.scalar_one_or_none()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(req.current_password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    db_user.password_hash = hash_password(req.new_password)
    await session.commit()
    return {"message": "Password updated successfully"}

# ---- email verification ----

@app.post("/auth/verify-email")
async def verify_email(token: str, session: AsyncSession = Depends(get_session)):
    """Consume a verification token. Frontend posts the token from the email link."""
    user = await consume_auth_token(session, token, "verify")
    if user is None:
        raise HTTPException(status_code=400, detail="Invalid or expired verification link")
    if not user.email_verified:
        user.email_verified = True
        await session.commit()
    return {"message": "Email verified", "user": _user_dict(user)}

@app.post("/auth/resend-verification")
async def resend_verification(
    user=Depends(get_current_user), session: AsyncSession = Depends(get_session)
):
    db_user = (
        await session.execute(select(User).where(User.id == int(user["uid"])))
    ).scalar_one_or_none()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if db_user.email_verified:
        return {"message": "Email already verified"}
    await _send_verification(session, db_user)
    return {"message": "Verification email sent"}

# ---- password reset ----

@app.post("/auth/forgot-password")
async def forgot_password(
    req: ForgotPasswordRequest, session: AsyncSession = Depends(get_session)
):
    """Always returns 200 — never reveal whether an email is registered."""
    email = req.email.lower().strip()
    user = (
        await session.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if user is not None:
        raw = await create_auth_token(session, user.id, "reset", RESET_TOKEN_TTL_HOURS)
        link = f"{FRONTEND_URL.rstrip('/')}/reset-password?token={raw}"
        send_reset_email(user.email, link)
    return {"message": "If that email is registered, a reset link has been sent."}

@app.post("/auth/reset-password")
async def reset_password(
    req: ResetPasswordRequest, session: AsyncSession = Depends(get_session)
):
    if len(req.new_password) < 6:
        raise HTTPException(status_code=422, detail="Password must be at least 6 characters")
    user = await consume_auth_token(session, req.token, "reset")
    if user is None:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    user.password_hash = hash_password(req.new_password)
    await session.commit()
    return {"message": "Password reset successfully. You can now log in."}

@app.post("/campaign/start")
async def start_campaign(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    campaign_name: str = Form(...),
    subject: str = Form(...),
    body: str = Form(...),
    sender_name: str = Form(...),
    sender_email: str = Form(...),
    delay_seconds: int = Form(10),
    daily_limit: int = Form(20),
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    uid = user["uid"]
    if get_shared_provider() is None:
        raise HTTPException(status_code=503, detail="Sending is temporarily unavailable (mailer not configured).")

    campaign = CampaignRequest(
        campaign_name=campaign_name,
        subject=subject,
        body=body,
        sender_name=sender_name,
        sender_email=sender_email,
        delay_seconds=delay_seconds,
        daily_limit=daily_limit,
    )

    contents = await file.read()
    try:
        df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid CSV file")

    if not {"name", "email"}.issubset(df.columns):
        raise HTTPException(status_code=400, detail="CSV must have 'name' and 'email' columns")

    df = df.fillna("")
    contacts = df.to_dict(orient="records")

    # Cap the campaign at the user's remaining daily quota so it can't exceed limits.
    remaining = max(0, PER_USER_DAILY_LIMIT - await _sent_today(session, uid))
    campaign.daily_limit = min(campaign.daily_limit, remaining)
    if campaign.daily_limit <= 0:
        raise HTTPException(status_code=429, detail=f"Daily send limit reached ({PER_USER_DAILY_LIMIT}/day).")

    # Use UUID suffix to prevent IDs from colliding within the same second
    campaign_id = f"{uid}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"
    background_tasks.add_task(
        send_campaign_task, campaign_id, contacts, campaign, sender_email,
    )

    return {
        "campaign_id": campaign_id,
        "message": f"Campaign started — {len(contacts)} contacts queued",
        "total": len(contacts)
    }

@app.get("/campaign/{campaign_id}/status")
def campaign_status(campaign_id: str, user=Depends(get_current_user)):
    if campaign_id not in campaigns:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaigns[campaign_id]

@app.post("/campaign/{campaign_id}/cancel")
def cancel_campaign(campaign_id: str, user=Depends(get_current_user)):
    if campaign_id not in campaigns:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaigns[campaign_id]["cancelled"] = True
    return {"message": "Campaign cancelled"}

@app.get("/campaigns")
def list_campaigns(user=Depends(get_current_user)):
    user_campaigns = {
        k: v for k, v in campaigns.items()
        if k.startswith(f"{user['uid']}_")
    }
    return user_campaigns

# ============================================================
#  API KEY MANAGEMENT (dashboard / Firebase auth)
# ============================================================

def _serialize_key(k: ApiKey) -> dict:
    return {
        "id": k.id,
        "name": k.name,
        "prefix": k.prefix,
        "revoked": k.revoked,
        "created_at": k.created_at.isoformat() if k.created_at else None,
        "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
    }

@app.post("/v1/keys")
async def create_key(
    req: ApiKeyCreateRequest,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    raw, key_hash, prefix = generate_api_key()
    api_key = ApiKey(
        uid=user["uid"],
        name=(req.name or "API Key").strip()[:120] or "API Key",
        key_hash=key_hash,
        prefix=prefix,
    )
    session.add(api_key)
    await session.commit()
    await session.refresh(api_key)
    # The raw key is returned ONCE here and never stored or shown again.
    return {**_serialize_key(api_key), "key": raw}

@app.get("/v1/keys")
async def list_keys(
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(ApiKey).where(ApiKey.uid == user["uid"]).order_by(desc(ApiKey.created_at))
    )
    return [_serialize_key(k) for k in result.scalars().all()]

@app.delete("/v1/keys/{key_id}")
async def revoke_key(
    key_id: int,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.uid == user["uid"])
    )
    api_key = result.scalar_one_or_none()
    if api_key is None:
        raise HTTPException(status_code=404, detail="API key not found")
    api_key.revoked = True
    await session.commit()
    return {"message": "API key revoked"}

# ============================================================
#  EMAIL ACTIVITY LOG (dashboard / Firebase auth)
# ============================================================

@app.get("/v1/logs")
async def list_logs(
    limit: int = 50,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    limit = max(1, min(limit, 200))
    result = await session.execute(
        select(EmailLog)
        .where(EmailLog.uid == user["uid"])
        .order_by(desc(EmailLog.created_at))
        .limit(limit)
    )
    return [
        {
            "id": log.id,
            "to": log.to_email,
            "from": log.from_email,
            "subject": log.subject,
            "status": log.status,
            "error": log.error,
            "message_id": log.provider_message_id,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in result.scalars().all()
    ]

# ============================================================
#  PUBLIC EMAIL API (authenticated by API key)
# ============================================================

@app.post("/v1/mail/send")
async def send_mail(
    req: MailSendRequest,
    api_key: ApiKey = Depends(get_api_key_user),
    session: AsyncSession = Depends(get_session),
):
    """SendGrid-style endpoint. Authenticate with an API key and send one email
    through MailFlow's shared sender (the user's address is set as Reply-To)."""
    uid = api_key.uid

    # Soft email-verification gate: the key owner must have a verified email.
    owner = (
        await session.execute(select(User).where(User.id == int(uid)))
    ).scalar_one_or_none()
    if owner is None or not owner.email_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email address before sending. "
                   "Check your inbox or resend the verification email from the dashboard.",
        )

    provider = get_shared_provider()
    if provider is None:
        raise HTTPException(
            status_code=503,
            detail="Sending is temporarily unavailable (mailer not configured).",
        )

    if not req.text and not req.html:
        raise HTTPException(status_code=422, detail="Provide at least one of 'text' or 'html'.")

    # Enforce per-user + global daily quota.
    await check_send_quota(session, uid)

    # The user's own address becomes Reply-To; default it to the account email.
    from_email = req.from_email or owner.email

    log = EmailLog(
        uid=uid,
        api_key_id=api_key.id,
        to_email=str(req.to),
        from_email=str(from_email),
        subject=req.subject,
        status="failed",
    )

    try:
        message_id = provider.send(
            from_name=req.from_name or "",
            from_email=str(from_email),
            to_email=str(req.to),
            subject=req.subject,
            text=req.text,
            html=req.html,
        )
        log.status = "sent"
        log.provider_message_id = message_id
    except ProviderError as e:
        log.error = str(e)
        session.add(log)
        await session.commit()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log.error = str(e)
        session.add(log)
        await session.commit()
        raise HTTPException(status_code=502, detail=f"Send failed: {e}")

    session.add(log)
    await session.commit()
    await session.refresh(log)
    return {"id": log.id, "status": "sent", "message_id": log.provider_message_id}
