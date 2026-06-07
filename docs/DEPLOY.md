# Deploying MailFlow for Free

Stack (all free, **no credit card**):
- **Database** → [Neon](https://neon.tech) (serverless Postgres)
- **Backend** (FastAPI) → **[Hugging Face Spaces](https://huggingface.co/spaces)** (Docker) — see §2
- **Frontend** (React/Vite) → [Vercel](https://vercel.com)

> 💳 **Render needs a credit card** (even for free web services / its free Postgres). If you want to
> avoid that, use **Hugging Face Spaces** for the backend (§2) — it never asks for a card. A Render
> alternative is kept in the appendix for reference.

Order matters: **Database → Backend → Frontend** (each step needs a value from the previous one).
Total time ~20–30 min.

> ⚠️ **Why not just deploy as-is?** Free hosts use *ephemeral disk* — the local SQLite file
> (`mailflow.db`) would be wiped on every restart, losing all users/keys. So you **must** use Neon
> Postgres in production. The code already supports it via `DATABASE_URL`.

---

## 0. Prerequisites

- Push this repo to **GitHub** (Vercel deploys from a Git repo; the HF Space gets the backend code in §2.2).
- Have these two secrets generated and saved somewhere safe — you'll paste them into the backend host:

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
2. **Create a project** (any name, e.g. `mailflow`). Pick any region.
3. On the project dashboard, find **Connection string** → copy the **`postgresql://…`** URI.
   It looks like:
   ```
   postgresql://user:password@ep-xxxx.region.aws.neon.tech/dbname?sslmode=require
   ```
4. **Save this string** — it's your `DATABASE_URL` for the backend.

   > The backend auto-converts `postgresql://` to the async driver and creates all tables on first
   > startup, so you don't need to run any migrations manually.
   >
   > ⚠️ Use the **direct** connection string with `?sslmode=require`. If you copied the `-pooler`
   > host, the async driver may have trouble — prefer the non-pooler one.

---

## 2. Backend — Hugging Face Spaces (Docker)

Hugging Face Spaces runs your backend as a Docker container, **free and with no credit card**. The
repo already includes `backend/Dockerfile` (listens on port 7860, which Spaces expects).

### 2.1 Create the Space
1. Sign up / log in at **https://huggingface.co** (free).
2. Go to **https://huggingface.co/new-space**.
3. Fill in:
   - **Owner:** you · **Space name:** `mailflow-backend`
   - **License:** any (e.g. MIT)
   - **Space SDK:** **Docker** → **Blank** template
   - **Visibility:** Public (private also works on free)
4. **Create Space.** You now have an empty Space repo.

### 2.2 Add the backend code to the Space
A Space is its own Git repo. The simplest way is to push **just the `backend/` folder** into it.

```bash
# from anywhere; replace YOUR_USERNAME
git clone https://huggingface.co/spaces/YOUR_USERNAME/mailflow-backend hf-space
cp -r /home/dev-2wayclick/Project/MailFlow/backend/. hf-space/
cd hf-space
# Spaces need a README with a Docker header + app_port. Create it:
printf -- '---\ntitle: MailFlow Backend\nemoji: ✉️\ncolorFrom: indigo\ncolorTo: purple\nsdk: docker\napp_port: 7860\npinned: false\n---\n\nMailFlow FastAPI backend.\n' > README.md
git add -A
git commit -m "Deploy MailFlow backend"
git push
```

> When Git asks for a password, use a **Hugging Face access token** (Settings → Access Tokens →
> New token, role *write*), not your account password.

The Space will build the Docker image and start automatically (watch the **Logs**/**App** tab).

### 2.3 Set the secrets
In the Space → **Settings → Variables and secrets → New secret**, add:

| Name | Value |
|---|---|
| `DATABASE_URL` | the Neon `postgresql://…` string from §1 |
| `JWT_SECRET` | your `openssl rand -hex 32` output |
| `ENCRYPTION_KEY` | your Fernet key output |
| `CORS_ORIGINS` | *leave for now — fill in §4 after Vercel* |
| `FRONTEND_URL` | *leave for now — fill in §4* |

Optional (so verification / password-reset emails actually send; otherwise the links print to the
Space logs):

| Name | Value |
|---|---|
| `SMTP_USER` | a Gmail address |
| `SMTP_PASSWORD` | a 16-char Gmail App Password |

After adding secrets, **Restart** the Space (Settings → Factory reboot, or it restarts on secret
change) so they take effect.

### 2.4 Get the URL & smoke-test
Your backend URL is:
```
https://YOUR_USERNAME-mailflow-backend.hf.space
```
Open it → you should see `{"message":"MailFlow API is running"}`. Check
`…/config/status` shows `"database_backend":"postgres"`. **Save this URL** for the frontend.

> 💤 Free Spaces **sleep after ~48h of no traffic** and cold-start on the next visit (much more
> forgiving than Render's 15-min sleep).

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
   | `VITE_API_URL` | your HF Space backend URL from §2.4, e.g. `https://YOUR_USERNAME-mailflow-backend.hf.space` |

   > No trailing slash. This is what makes the frontend call the deployed backend instead of the
   > local Vite proxy. (`vercel.json` already handles SPA routing so deep links work.)
5. **Deploy.** When done, copy your Vercel URL, e.g. `https://mailflow.vercel.app`.

---

## 4. Connect frontend ↔ backend (CORS) — don't skip

The backend must allow your Vercel domain to call it. Go back to the **HF Space → Settings →
Variables and secrets** and set:

| Name | Value |
|---|---|
| `CORS_ORIGINS` | your Vercel URL, e.g. `https://mailflow.vercel.app` |
| `FRONTEND_URL` | the same Vercel URL (used in email links) |

Save → the Space restarts. (If you later add a custom domain, append it comma-separated:
`https://mailflow.vercel.app,https://www.yourdomain.com`.)

> Until `CORS_ORIGINS` is set, the API falls back to a permissive `*` (no credentials). Setting it
> locks the API to your frontend and enables credentialed requests.

---

## 5. Verify the live app

1. Open your Vercel URL → register an account.
2. **Verify email:**
   - If you set `SMTP_USER`/`SMTP_PASSWORD` on the Space, check your inbox for the link.
   - If not, open the **Space logs** (Space → Logs tab) and find the
     `verification` link printed there; open it.
3. Log in → **SMTP** page → save your own SMTP (Gmail App Password) → **Save**.
4. **API Keys** → create a key.
5. Send a test (replace the values):
   ```bash
   curl -X POST https://YOUR_USERNAME-mailflow-backend.hf.space/v1/mail/send \
     -H "Authorization: Bearer mf_live_YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"from":"you@gmail.com","to":"someone@example.com","subject":"Live test","html":"<h1>Deployed!</h1>"}'
   ```
   Expect `{"status":"sent",...}`. Check **Email Activity** in the dashboard too.

---

## Free-tier limits to know

| Service | Free-tier catch |
|---|---|
| **HF Spaces** | Free CPU Space sleeps after ~48h of no traffic; cold-starts on next visit. 2 vCPU / 16 GB. |
| **Neon** | Generous free storage; compute auto-suspends when idle (adds a small first-query delay). |
| **Vercel** | Plenty for this app; 100 GB bandwidth/month on Hobby. |

If you want zero cold starts, you can ping the backend periodically with a free uptime monitor
(e.g. UptimeRobot hitting `/`).

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Frontend loads but every action fails / CORS error in console | `CORS_ORIGINS` on the Space doesn't match the Vercel URL exactly (scheme + no trailing slash). |
| `VITE_API_URL` changes not taking effect | Vercel bakes env vars at build time — **redeploy** after changing it. |
| Login works locally but not deployed | `VITE_API_URL` missing/wrong, or backend still waking from sleep (retry after ~1 min). |
| `database_backend: sqlite` at `/config/status` | `DATABASE_URL` secret not set on the Space (or the Space didn't restart after adding it). |
| Saved SMTP passwords suddenly fail to decrypt | `JWT_SECRET` or `ENCRYPTION_KEY` was changed after data was saved. Keep them stable. |
| Space build fails | Check the Space **Logs**; usually a dependency issue. The image is `python:3.11-slim` (see `backend/Dockerfile`). |
| Space shows "Configuration error" / wrong port | The `README.md` header needs `sdk: docker` and `app_port: 7860` (created in §2.2). |

---

## Appendix — Render backend (requires a credit card)

If you'd rather use Render and don't mind the card-verification step, the repo also ships a Render
Blueprint (`render.yaml`):

1. **New + → Blueprint** → select this repo → **Apply** (creates `mailflow-backend`).
2. Or **New + → Web Service** with: Root Dir `backend`, Runtime Python 3,
   Build `pip install -r requirements.txt`, Start `uvicorn main:app --host 0.0.0.0 --port $PORT`.
3. Set the same env vars as §2.3 plus `PYTHON_VERSION=3.11`. Backend URL looks like
   `https://mailflow-backend.onrender.com`. Free tier sleeps after 15 min idle (~50s cold start).

Everything else (Neon DB §1, Vercel frontend §3, CORS §4) is identical — just substitute the Render
URL for the HF Space URL.
