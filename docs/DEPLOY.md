# Deploying MailFlow for Free

Stack (all free, no credit card):
- **Database** → [Neon](https://neon.tech) (serverless Postgres)
- **Backend** (FastAPI) → [Render](https://render.com)
- **Frontend** (React/Vite) → [Vercel](https://vercel.com)

Order matters: **Database → Backend → Frontend** (each step needs a value from the previous one).
Total time ~20–30 min.

> ⚠️ **Why not just deploy as-is?** Free hosts use *ephemeral disk* — the local SQLite file
> (`mailflow.db`) would be wiped on every restart, losing all users/keys. So you **must** use Neon
> Postgres in production. The code already supports it via `DATABASE_URL`.

---

## 0. Prerequisites

- Push this repo to **GitHub** (Render and Vercel deploy from a Git repo).
- Have these two secrets generated and saved somewhere safe — you'll paste them into Render:

  ```bash
  # JWT signing secret
  openssl rand -hex 32

  # Encryption key for stored SMTP passwords (Fernet)
  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
  ```

  > 🔒 Set **both** explicitly. If you skip `ENCRYPTION_KEY`, it's derived from `JWT_SECRET`, and
  > later changing `JWT_SECRET` would make every saved SMTP password undecryptable.

---

## 1. Database — Neon (Postgres)

1. Sign up at **https://neon.tech** (GitHub login is fine).
2. **Create a project** (any name, e.g. `mailflow`). Pick a region near your Render region.
3. On the project dashboard, find **Connection string** → copy the **`postgresql://…`** URI.
   It looks like:
   ```
   postgresql://user:password@ep-xxxx.region.aws.neon.tech/dbname?sslmode=require
   ```
4. **Save this string** — it's your `DATABASE_URL` for Render.

   > The backend auto-converts `postgresql://` to the async driver and creates all tables on first
   > startup, so you don't need to run any migrations manually.

---

## 2. Backend — Render (FastAPI)

You can use the included **Blueprint** (`render.yaml`) or configure manually.

### Option A — Blueprint (recommended)
1. Sign up at **https://render.com** with GitHub.
2. **New + → Blueprint** → select this repo. Render reads `render.yaml` and proposes the
   `mailflow-backend` web service.
3. Click **Apply**. The service is created but will need its secret env vars (next step).

### Option B — Manual
1. **New + → Web Service** → connect this repo.
2. Settings:
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** Free

### Set environment variables (both options)
In the service → **Environment** → add:

| Key | Value |
|---|---|
| `DATABASE_URL` | the Neon `postgresql://…` string from step 1 |
| `JWT_SECRET` | your `openssl rand -hex 32` output |
| `ENCRYPTION_KEY` | your Fernet key output |
| `CORS_ORIGINS` | *leave blank for now — you'll fill it in step 4* |
| `FRONTEND_URL` | *leave blank for now — fill in step 4* |
| `PYTHON_VERSION` | `3.11` |

Optional (so verification/password-reset emails actually send — otherwise links print to the
backend logs):

| Key | Value |
|---|---|
| `SMTP_USER` | a Gmail address |
| `SMTP_PASSWORD` | a 16-char Gmail App Password |

3. **Save** → Render builds and deploys. When it's live, copy the service URL, e.g.
   `https://mailflow-backend.onrender.com`.
4. **Smoke-test:** open `https://mailflow-backend.onrender.com/` → you should see
   `{"message":"MailFlow API is running"}`. Also check `…/config/status` shows
   `"database_backend":"postgres"`.

   > 💤 **Free tier sleeps** after 15 min idle; the first request then takes ~50s to wake. Normal.

---

## 3. Frontend — Vercel (React/Vite)

1. Sign up at **https://vercel.com** with GitHub.
2. **Add New → Project** → import this repo.
3. Configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite (auto-detected)
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `dist` (default)
4. **Environment Variables** → add:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | your Render backend URL from step 2, e.g. `https://mailflow-backend.onrender.com` |

   > No trailing slash. This is what makes the frontend call the deployed backend instead of the
   > local Vite proxy. (`vercel.json` already handles SPA routing so deep links work.)
5. **Deploy.** When done, copy your Vercel URL, e.g. `https://mailflow.vercel.app`.

---

## 4. Connect frontend ↔ backend (CORS) — don't skip

The backend must allow your Vercel domain to call it. Go back to **Render → Environment** and set:

| Key | Value |
|---|---|
| `CORS_ORIGINS` | your Vercel URL, e.g. `https://mailflow.vercel.app` |
| `FRONTEND_URL` | the same Vercel URL (used in email links) |

Save → Render redeploys. (If you later add a custom domain, append it comma-separated:
`https://mailflow.vercel.app,https://www.yourdomain.com`.)

> Until `CORS_ORIGINS` is set, the API falls back to a permissive `*` (no credentials). Setting it
> locks the API to your frontend and enables credentialed requests.

---

## 5. Verify the live app

1. Open your Vercel URL → register an account.
2. **Verify email:**
   - If you set `SMTP_USER`/`SMTP_PASSWORD` on Render, check your inbox for the link.
   - If not, open the **Render logs** (Dashboard → your service → Logs) and find the
     `verification` link printed there; open it.
3. Log in → **SMTP** page → save your own SMTP (Gmail App Password) → **Save**.
4. **API Keys** → create a key.
5. Send a test (replace the values):
   ```bash
   curl -X POST https://mailflow-backend.onrender.com/v1/mail/send \
     -H "Authorization: Bearer mf_live_YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"from":"you@gmail.com","to":"someone@example.com","subject":"Live test","html":"<h1>Deployed!</h1>"}'
   ```
   Expect `{"status":"sent",...}`. Check **Email Activity** in the dashboard too.

---

## Free-tier limits to know

| Service | Free-tier catch |
|---|---|
| **Render** | Backend sleeps after 15 min idle; ~50s cold start on the next request. 750 hrs/month. |
| **Neon** | Generous free storage; compute auto-suspends when idle (adds a small first-query delay). |
| **Vercel** | Plenty for this app; 100 GB bandwidth/month on Hobby. |

To avoid the Render cold start, you can ping the backend every ~10 min with a free uptime monitor
(e.g. UptimeRobot hitting `/`), or upgrade off the free plan.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Frontend loads but every action fails / CORS error in console | `CORS_ORIGINS` on Render doesn't match the Vercel URL exactly (scheme + no trailing slash). |
| `VITE_API_URL` changes not taking effect | Vercel bakes env vars at build time — **redeploy** after changing it. |
| Login works locally but not deployed | `VITE_API_URL` missing/wrong, or backend still waking from sleep (retry after ~1 min). |
| `database_backend: sqlite` at `/config/status` | `DATABASE_URL` not set on Render. |
| Saved SMTP passwords suddenly fail to decrypt | `JWT_SECRET` or `ENCRYPTION_KEY` was changed after data was saved. Keep them stable. |
| Build fails on Render | Check the build log; usually a dependency/Python-version mismatch — `PYTHON_VERSION=3.11` is set in `render.yaml`. |
