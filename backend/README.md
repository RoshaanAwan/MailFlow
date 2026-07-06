---
title: MailFlow Backend
emoji: 📧
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# MailFlow Backend

FastAPI backend for MailFlow — self-hosted JWT auth plus a Gmail-first email
pipeline (connect your Google account, upload a CSV, send a campaign).

This Space runs the Docker image defined by `Dockerfile` (listens on port 7860).

## Required environment variables

Set these as **Space secrets** (Settings → Variables and secrets). Do **not**
commit them to the repo.

| Variable          | Purpose                                                        |
|-------------------|----------------------------------------------------------------|
| `DATABASE_URL`    | Postgres connection string (e.g. from Neon). Falls back to SQLite if unset. |
| `JWT_SECRET`      | Signs auth tokens. Generate: `openssl rand -hex 32`.           |
| `ENCRYPTION_KEY`  | Fernet key for encrypting stored OAuth/SMTP secrets at rest.   |
| `CORS_ORIGINS`    | Your frontend URL, e.g. `https://mail-flow-kappa.vercel.app`.  |
| `FRONTEND_URL`    | Same frontend URL (used in email + OAuth redirect links).      |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client (Gmail send). |
| `GOOGLE_REDIRECT_URI` | `https://roshaanawan-mailflow-backend.hf.space/v1/google/callback` |

Optional: `SMTP_USER` / `SMTP_PASSWORD` (system mailer for verification &
password-reset emails), `RESEND_API_KEY` (alternative delivery backend).
