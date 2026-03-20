"""
MailFlow — FastAPI Backend
==========================
Handles email sending via Gmail API, campaign management, and Google Sheets logging using user OAuth tokens.

RUN:
  uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional, List
import pandas as pd
import time
import io
import os
import base64
import json
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import gspread
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials as UserCredentials
import firebase_admin
from firebase_admin import credentials as fb_creds, auth as fb_auth
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="MailFlow API", version="1.0.0")

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

# OAuth Configuration
CLIENT_SECRET_FILE = "client_secret.json"
SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid"
]
REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/gmail/callback")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

security = HTTPBearer()

def get_google_client_config():
    """Returns Google Client Config from env or file."""
    env_json = os.getenv("GOOGLE_CLIENT_SECRET_JSON")
    if env_json:
        # Strip potential single or double quotes at ends
        env_json = env_json.strip().strip("'").strip('"')
        try:
            return json.loads(env_json)
        except Exception as e:
            print(f"ERROR: Failed to parse GOOGLE_CLIENT_SECRET_JSON: {e}")

    if os.path.exists(CLIENT_SECRET_FILE):
        with open(CLIENT_SECRET_FILE, "r") as f:
            return json.load(f)
    return None

# Firebase Admin SDK
firebase_initialized = False
try:
    if not firebase_admin._apps:
        fb_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        if fb_json:
            fb_json = fb_json.strip().strip("'").strip('"')
            try:
                cred_dict = json.loads(fb_json)
                cred = fb_creds.Certificate(cred_dict)
                firebase_admin.initialize_app(cred)
                firebase_initialized = True
                print("DEBUG: Firebase Admin initialized from environment variable.")
            except Exception as e:
                print(f"ERROR: Failed to parse/initialize Firebase from JSON: {e}")
        
        if not firebase_initialized and os.path.exists("firebase_service_account.json"):
            cred = fb_creds.Certificate("firebase_service_account.json")
            firebase_admin.initialize_app(cred)
            firebase_initialized = True
            print("DEBUG: Firebase Admin initialized from file.")

    if not firebase_admin._apps and not firebase_initialized:
        print("WARNING: Firebase Admin NOT initialized. Authentication will fail.")
except Exception as e:
    print(f"ERROR: Firebase initialization failure: {e}")



# ============================================================
#  IN-MEMORY STORES
# ============================================================
user_tokens = {}  # { uid: credentials_dict }
campaigns = {}    # { campaign_id: status_dict }
auth_verifiers = {} # { state: verifier }

# ============================================================
#  HELPERS
# ============================================================

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        decoded = fb_auth.verify_id_token(token)
        return decoded
    except Exception as e:
        print(f"DEBUG: Firebase auth error: {e}")
        raise HTTPException(
            status_code=401, 
            detail=f"Authentication failed: {str(e)}"
        )

def get_user_creds(uid: str):
    if uid not in user_tokens:
        return None
    creds = UserCredentials.from_authorized_user_info(user_tokens[uid], SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(GoogleRequest())
        user_tokens[uid] = json.loads(creds.to_json())
    return creds

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
    sheet_name: Optional[str] = "Email Campaign Log"

class SheetCreateRequest(BaseModel):
    name: str

# ============================================================
#  GOOGLE SHEETS LOGGER
# ============================================================

def get_sheet(sheet_name: str, uid: str):
    creds = get_user_creds(uid)
    if not creds:
        return None

    try:
        client = gspread.authorize(creds)
        try:
            spreadsheet = client.open(sheet_name)
        except gspread.SpreadsheetNotFound:
            # Create new spreadsheet if not found
            spreadsheet = client.create(sheet_name)
        
        sheet = spreadsheet.sheet1
        headers = ["Timestamp", "Campaign", "Recipient Name", "Email",
                   "Company", "Subject", "Status", "Error"]
        
        # Check if headers exist, if not insert them
        if sheet.row_count == 0 or (sheet.cell(1, 1).value != "Timestamp"):
            sheet.insert_row(headers, 1)
        return sheet
    except Exception as e:
        print(f"Sheets error for user {uid}: {e}")
        return None

def log_row(sheet, campaign, name, email, company, subject, status, error=""):
    if sheet:
        try:
            sheet.append_row([
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                campaign, name, email, company, subject, status, error
            ])
        except Exception as e:
            print(f"Logging error: {e}")

# ============================================================
#  EMAIL SENDER (GMAIL API)
# ============================================================

def send_campaign_task(campaign_id: str, contacts: list, config: CampaignRequest, uid: str):
    campaigns[campaign_id] = {"status": "running", "sent": 0, "failed": 0, "total": len(contacts)}
    sheet = get_sheet(config.sheet_name, uid)

    creds = get_user_creds(uid)
    if not creds:
        campaigns[campaign_id]["status"] = "error: Google account not connected"
        return

    service = build("gmail", "v1", credentials=creds)

    for i, row in enumerate(contacts):
        if campaigns[campaign_id].get("cancelled"):
            break
        if campaigns[campaign_id]["sent"] >= config.daily_limit:
            break

        name    = row.get("name", "there")
        email   = row.get("email", "").strip()
        company = row.get("company", "your company")

        if not email:
            continue

        try:
            subject = config.subject.format(name=name, company=company)
            body    = config.body.format(name=name, company=company)

            msg = MIMEMultipart()
            msg["Subject"] = subject
            msg["From"]    = f"{config.sender_name} <{config.sender_email}>"
            msg["To"]      = email
            msg.attach(MIMEText(body, "plain"))

            raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
            service.users().messages().send(userId="me", body={"raw": raw}).execute()

            campaigns[campaign_id]["sent"] += 1
            log_row(sheet, config.campaign_name, name, email, company, subject, "Sent")

        except Exception as e:
            campaigns[campaign_id]["failed"] += 1
            log_row(sheet, config.campaign_name, name, email, company, "", "Failed", str(e))

        time.sleep(config.delay_seconds)

    campaigns[campaign_id]["status"] = "completed"

# ============================================================
#  GOOGLE OAUTH ROUTES
# ============================================================

@app.get("/auth/gmail/url")
def get_auth_url(uid: str):
    config = get_google_client_config()
    if not config:
        raise HTTPException(status_code=500, detail="Google Client configuration missing")
    
    flow = Flow.from_client_config(
        config,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI
    )
    # Important: access_type='offline' is needed to get a refresh_token
    auth_url, _ = flow.authorization_url(prompt='consent', state=uid, access_type='offline')
    
    # Store the code verifier for PKCE
    print(f"DEBUG: Storing verifier for uid={uid}")
    auth_verifiers[uid] = flow.code_verifier
    
    return {"url": auth_url}

@app.get("/auth/gmail/callback")
def auth_callback(state: str, code: str):
    config = get_google_client_config()
    if not config:
        raise HTTPException(status_code=500, detail="Google Client configuration missing")

    flow = Flow.from_client_config(
        config,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI
    )
    
    # Restore the code verifier for PKCE
    print(f"DEBUG: Callback received state={state}")
    if state in auth_verifiers:
        print(f"DEBUG: Found verifier for state={state}")
        flow.code_verifier = auth_verifiers.pop(state)
    else:
        print(f"DEBUG: NO verifier found for state={state}. Available: {list(auth_verifiers.keys())}")
        
    try:
        flow.fetch_token(code=code)
    except Exception as e:
        print(f"DEBUG: fetch_token error: {e}")
        raise e
        
    creds = flow.credentials
    user_tokens[state] = json.loads(creds.to_json())
    print(f"DEBUG: Token stored for uid={state}. Total tokens: {len(user_tokens)}")
    return RedirectResponse(url=f"{FRONTEND_URL}/?page=settings")

@app.get("/auth/gmail/status")
def google_status(user=Depends(get_current_user)):
    uid = user["uid"]
    connected = uid in user_tokens
    email = user_tokens[uid].get("email", "Connected") if connected else None
    return {"connected": connected, "email": email}

@app.delete("/auth/gmail/disconnect")
def google_disconnect(user=Depends(get_current_user)):
    uid = user["uid"]
    if uid in user_tokens:
        del user_tokens[uid]
    return {"message": "Google account disconnected"}

# ============================================================
#  SHEETS ROUTES
# ============================================================

@app.get("/sheets/list")
def list_sheets(user=Depends(get_current_user)):
    creds = get_user_creds(user["uid"])
    if not creds:
        raise HTTPException(status_code=400, detail="Google account not connected")
    
    try:
        service = build("drive", "v3", credentials=creds)
        # Query for spreadsheets only
        query = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
        results = service.files().list(q=query, pageSize=50, fields="files(id, name)").execute()
        return results.get("files", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/sheets/create")
def create_sheet(req: SheetCreateRequest, user=Depends(get_current_user)):
    creds = get_user_creds(user["uid"])
    if not creds:
        raise HTTPException(status_code=400, detail="Google account not connected")
    
    try:
        service = build("sheets", "v4", credentials=creds)
        spreadsheet = {'properties': {'title': req.name}}
        spreadsheet = service.spreadsheets().create(body=spreadsheet, fields='spreadsheetId,properties/title').execute()
        
        # Initialize headers
        client = gspread.authorize(creds)
        sheet = client.open_by_key(spreadsheet['spreadsheetId']).sheet1
        headers = ["Timestamp", "Campaign", "Recipient Name", "Email",
                   "Company", "Subject", "Status", "Error"]
        sheet.insert_row(headers, 1)
        
        return {"id": spreadsheet['spreadsheetId'], "name": spreadsheet['properties']['title']}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
#  CAMPAIGN ROUTES
# ============================================================

@app.get("/")
def root():
    return {"message": "MailFlow API is running"}

@app.post("/campaign/start")
async def start_campaign(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    campaign: CampaignRequest = Depends(),
    user=Depends(get_current_user)
):
    uid = user["uid"]
    if uid not in user_tokens:
        raise HTTPException(status_code=400, detail="Please connect your Google account first in Settings.")

    contents = await file.read()
    try:
        df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid CSV file")

    if not {"name", "email"}.issubset(df.columns):
        raise HTTPException(status_code=400, detail="CSV must have 'name' and 'email' columns")

    df = df.fillna("")
    contacts = df.to_dict(orient="records")

    campaign_id = f"{uid}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    background_tasks.add_task(send_campaign_task, campaign_id, contacts, campaign, uid)

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
        if k.startswith(user["uid"])
    }
    return user_campaigns
