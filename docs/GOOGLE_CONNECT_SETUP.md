# Google Connect Setup (send via each user's own Gmail)

MailFlow now sends email through each user's **own Gmail account**. A user clicks
**Settings → Connect Google Account**, authorizes once, and MailFlow sends via the
Gmail API using their stored refresh token. This works on Hugging Face Spaces
(it's all HTTPS — no outbound SMTP).

To enable it you set up **one** OAuth client in Google Cloud and give the backend
three secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.

---

## 1. Google Cloud Console — one-time setup

1. Go to **https://console.cloud.google.com** → create/select a project.
2. **APIs & Services → Library** → search **Gmail API** → **Enable**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External** → Create.
   - Fill app name, support email, developer email. Save.
   - **Scopes:** add `.../auth/gmail.send` and `.../auth/userinfo.email`.
   - **Test users:** add the Gmail address(es) you'll connect (while the app is in
     "Testing" mode, only listed test users can connect). Save.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application** ← important (not Desktop).
   - **Authorized redirect URIs → Add URI:** your backend's callback, exactly:
     ```
     https://YOUR-BACKEND-HOST/v1/google/callback
     ```
     - Local dev: `http://localhost:8000/v1/google/callback`
     - HF Space: `https://roshaanawan-mailflow-backend.hf.space/v1/google/callback`
   - Create → copy the **Client ID** and **Client Secret**.

---

## 2. Backend env vars / secrets

Set these on the backend (HF Space → Settings → Variables and secrets):

| Name | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | the OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | the OAuth client secret |
| `GOOGLE_REDIRECT_URI` | the **exact** callback URL you registered above |
| `FRONTEND_URL` | your Vercel URL (the callback redirects back here after consent) |
| `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY` | as before (Postgres + secrets) |

`GOOGLE_REDIRECT_URI` **must byte-for-byte match** a redirect URI on the OAuth
client, or Google returns `redirect_uri_mismatch`.

Restart / factory-reboot after setting secrets.

---

## 3. How the flow works (for reference)

1. User → **Settings → Connect Google Account**.
2. Frontend calls `GET /v1/google/connect` → backend returns a Google consent URL
   (with a signed `state` carrying the user id).
3. Browser goes to Google → user authorizes → Google redirects to
   `GET /v1/google/callback?code=...&state=...`.
4. Backend exchanges the code for a **refresh token**, looks up the connected Gmail
   address, stores the refresh token **encrypted** (Fernet), and redirects the
   browser back to `FRONTEND_URL/settings?google=connected`.
5. Sending (`POST /v1/mail/send` and campaigns) mints a short-lived access token
   from the refresh token and calls the Gmail API `users.messages.send`. Mail goes
   out **from the user's Gmail address**.

Disconnect: `DELETE /v1/google` removes the stored account.

---

## 4. Verify

- `GET /config/status` → `"google_oauth_configured": true`.
- Log in → **Settings** → **Connect Google Account** → authorize → you should land
  back on Settings showing your connected Gmail.
- Create an API key, then:
  ```bash
  curl -X POST https://YOUR-BACKEND-HOST/v1/mail/send \
    -H "Authorization: Bearer mf_live_YOUR_KEY" \
    -H "Content-Type: application/json" \
    -d '{"to":"someone@example.com","subject":"Hi","html":"<h1>Sent via my Gmail</h1>"}'
  ```
  Expect `{"status":"sent",...}` and the mail arrives from your Gmail address.

---

## Notes / gotchas
- **Testing mode:** only Test users can connect until you "Publish" the OAuth app.
  Publishing to everyone may require Google verification for the `gmail.send` scope.
- **"No refresh token" on reconnect:** Google only returns a refresh token the first
  time unless `prompt=consent` is used (we do). If a user hits `google=no_refresh`,
  have them remove MailFlow at https://myaccount.google.com/permissions and reconnect.
- The Gmail free sending limit is ~500 recipients/day per account.
