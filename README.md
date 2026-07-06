# 🚀 MailFlow — Professional Email Automation SaaS

<div align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white" />
  <img src="https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white" />
</div>

---

**MailFlow** is a powerful, full-stack email automation platform designed for cold outreach and campaign management. Built with a modern tech stack (React 18 + FastAPI), it empowers users to reach their audience at scale while maintaining a personal touch.

## ✨ Core Features

*   **🔐 Self-hosted Authentication**: Email + password login/registration with **JWT** tokens, stored in your own Postgres — no third-party auth vendor.
*   **🔑 Developer Email API**: Generate API keys and send transactional email programmatically from your own systems — a SendGrid-style `POST /v1/mail/send` endpoint.
*   **📈 Email Activity Log**: Every API send is recorded (recipient, subject, status, message id) and viewable in the dashboard.
*   **📊 Lead Management**: Upload contact lists via CSV with support for custom placeholders.
*   **📧 Personalized Templates**: Craft dynamic email templates using `{name}`, `{company}`, and more tags.
*   **⚡ Automated Campaigns**: Send emails automatically through **Gmail API** with configurable daily limits and delays.
*   **📝 Live Tracking & Logging**: Keep an eye on your progress with real-time stats and automated logging to **Google Sheets**.
*   **⏹️ Mission Control**: Cancel or pause campaigns at any time from a sleek, dark-mode dashboard.

## 🔌 Email API (SendGrid-style)

Customers sign in, connect their Google account in **Settings**, then create a key on the **API Keys** page. The raw key is shown **once** — only its SHA-256 hash is stored. Use it to send email from any system:

```bash
curl -X POST https://your-api.example.com/v1/mail/send \
  -H "Authorization: Bearer mf_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "recipient@example.com",
    "subject": "Hello from MailFlow",
    "html": "<h1>It works!</h1>",
    "text": "It works!"
  }'
```

Response: `{ "id": 42, "status": "sent", "message_id": "..." }`. Provide at least one of `text` or `html`; `from_email`/`from_name` are optional (defaults to the connected account's address). Email is delivered through the key owner's connected **Gmail** account, so it's free (subject to Gmail's ~500/day limit). The delivery layer lives behind a provider interface (`backend/providers.py`) so Amazon SES, Brevo, etc. can be added later without changing the API.

**Endpoints** (dashboard endpoints use a login JWT; `/v1/mail/send` uses an API key):
| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/auth/register` | — | Create an account, returns a JWT |
| `POST` | `/auth/login` | — | Log in, returns a JWT |
| `GET` | `/auth/me` | JWT | Validate token / get current user |
| `POST` | `/auth/change-password` | JWT | Change password |
| `POST` | `/v1/keys` | JWT | Create a key (returns raw key once) |
| `GET` | `/v1/keys` | JWT | List keys (metadata only) |
| `DELETE` | `/v1/keys/{id}` | JWT | Revoke a key |
| `GET` | `/v1/logs` | JWT | Recent email activity |
| `POST` | `/v1/mail/send` | API key | Send one email |

## 🏗️ Project Architecture

```text
mailflow/
├── frontend/          # React + Vite Client
│   ├── src/
│   │   ├── pages/     # Login, Dashboard, New Campaign, Settings
│   │   └── components/# Shared UI Components
├── backend/           # FastAPI Business Logic
│   ├── main.py        # API Routes & OAuth logic
│   └── requirements.txt
└── .gitignore
```

## 🛠️ Tech Stack

*   **Frontend**: React 18, Vite
*   **Backend**: Python 3.10+, FastAPI, Pydantic, SQLAlchemy (async)
*   **Auth**: Self-hosted email/password with JWT (bcrypt hashing) — no third-party auth vendor
*   **Database**: PostgreSQL (e.g. [Neon](https://neon.tech) free tier) via `DATABASE_URL`; falls back to local SQLite for zero-setup dev
*   **Integration**: Google OAuth 2.0, Gmail API, Google Sheets API

## ⚙️ Setup & Installation

### 1. Prerequisites
*   Python 3.10+
*   Node.js (LTS)
*   A Google Cloud Project with Gmail, Sheets, and Drive APIs enabled.

### 2. Environment Variables
Copy the example file and configure credentials:

```bash
cp backend/.env.example backend/.env
```

**Local development (easiest):** the only thing you *need* is the Google OAuth client (for Gmail sending). Save it in `backend/`:
- `backend/client_secret.json` — Google OAuth Web client

Login/auth works out of the box locally (an insecure dev JWT secret is used and a local SQLite file is created automatically).

**Production / Railway / Render (recommended):** set platform env vars:

```bash
# Auth — generate with: openssl rand -hex 32  (changing it logs everyone out)
JWT_SECRET=your-strong-random-secret
# Database — Postgres connection string (e.g. from Neon)
DATABASE_URL=postgresql://user:password@host/dbname
# Google OAuth — needed for Gmail sending
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-api.example.com/auth/gmail/callback
FRONTEND_URL=https://your-app.example.com
```

Alternative for the OAuth client: use a full JSON env var (`GOOGLE_CLIENT_SECRET_JSON`) or base64-encoded value.

Frontend production env (Vercel):
```bash
VITE_API_URL=https://your-api.example.com
```

Verify backend config after deploy:
```bash
curl https://your-api.example.com/config/status
```

### 3. Quick Start
**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## 🚀 Roadmap

- [ ] Support for multiple attachments
- [ ] Advanced CSV field mapping
- [ ] Email open/click tracking analytics
- [ ] AI-powered subject line generator

## 👤 Author

**Roshaan Ali**
*   GitHub: [@RoshaanAwan](https://github.com/RoshaanAwan)
*   LinkedIn: [Roshaan Ali](https://linkedin.com/in/roshaan-awan)

---
<div align="center">
  Made with ❤️ for high-performance outreach.
</div>
