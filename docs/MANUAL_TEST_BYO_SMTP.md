# Manual Test Cases — Customer-Owned SMTP (BYO-SMTP)

Manual, step-by-step test cases for the "send through your own SMTP server" feature:
configure SMTP in the dashboard → create an API key → send mail through the API → confirm
it relayed via your own server.

These are written for a human to follow in the browser + a terminal. Each case lists
**Preconditions → Steps → Expected result**. Tick the **Pass/Fail** box as you go.

---

## 0. Setup (do once)

### 0.1 Get a test SMTP account
You need real SMTP credentials to see a true "sent". Easiest options:
- **Mailtrap** (recommended — sandbox, nothing reaches real inboxes): sign up at mailtrap.io →
  Email Testing → SMTP settings. Use host `sandbox.smtp.mailtrap.io`, port `587`, and the
  username/password it shows.
- **Gmail App Password**: host `smtp.gmail.com`, port `587`, username = your Gmail, password =
  a 16-char App Password (Google Account → Security → 2-Step Verification → App passwords).
  (This actually delivers email.)

Keep these four values handy: **host, port, username, password**.

### 0.2 Start the app
```bash
cd /home/dev-2wayclick/Project/MailFlow
./dev.sh
```
- Backend → http://localhost:8000
- Frontend → http://localhost:3000

✅ Both start without errors; opening http://localhost:3000 shows the MailFlow landing/login.

### 0.3 Have a logged-in, email-verified account
Register at the login page (or use an existing account) and verify the email.
If verification email isn't set up in your environment, mark the account verified directly:
```bash
sqlite3 /home/dev-2wayclick/Project/MailFlow/backend/mailflow.db \
  "UPDATE users SET email_verified=1 WHERE email='YOUR_LOGIN_EMAIL';"
```

---

## Part A — SMTP settings UI (`/smtp` page)

### TC-A1 — SMTP nav item appears
**Pre:** Logged in.
**Steps:** Look at the left sidebar.
**Expected:** A **SMTP** item appears in the nav (between **Domains** and **Email Activity**),
with a mail-envelope icon. Clicking it opens the SMTP Settings page at `/smtp`.
☐ Pass ☐ Fail

### TC-A2 — Empty state on first visit
**Pre:** Account has never saved SMTP.
**Steps:** Open the **SMTP** page.
**Expected:** Form shows with **Host** prefilled `smtp.gmail.com`, **Port** `587`, and empty
Username / Password / From name. The header card does **not** show a "· configured" badge.
Only **Save** and **Test connection** buttons are visible (no **Remove**).
☐ Pass ☐ Fail

### TC-A3 — Test connection BEFORE saving (valid creds)
**Pre:** On the SMTP page.
**Steps:** Enter your real host/port/username/password (from 0.1). Click **Test connection**.
**Expected:** Within a few seconds, a green message: **"Connected successfully — credentials are valid."**
Nothing was saved yet (reloading the page would still show the empty state).
☐ Pass ☐ Fail

### TC-A4 — Test connection with wrong credentials
**Pre:** On the SMTP page.
**Steps:** Enter the correct host/port but a **wrong password**. Click **Test connection**.
**Expected:** A red error message beginning **"Failed: …"** (e.g. authentication failed / connection
refused). The form is not cleared.
☐ Pass ☐ Fail

### TC-A5 — Save SMTP credentials
**Pre:** Valid creds entered (TC-A3).
**Steps:** Click **Save**.
**Expected:** Green message **"SMTP settings saved successfully."** The card header now shows a green
**"· configured"** badge. A **Remove** button appears. The password field clears.
☐ Pass ☐ Fail

### TC-A6 — Reload preserves config, never shows the password
**Pre:** SMTP saved (TC-A5).
**Steps:** Refresh the browser (or navigate away and back to **SMTP**).
**Expected:** Host, Port, Username, From name are prefilled with what you saved. The **Password
field is blank** with placeholder "•••••••• (leave blank to keep current)". The "· configured"
badge is shown.
☐ Pass ☐ Fail

### TC-A7 — Update without retyping the password
**Pre:** SMTP saved; password field blank after reload.
**Steps:** Change only **From name** (e.g. to "Support Team"). Leave password blank. Click **Save**.
**Expected:** "saved successfully." The from-name change persists on reload; sending still works
(the previously stored password is kept).
☐ Pass ☐ Fail

### TC-A8 — Validation errors
**Pre:** On the SMTP page.
**Steps:** Try each and click **Save**:
  (a) Port = `0` or `99999`
  (b) Username = `not-an-email`
  (c) Host cleared to empty
**Expected:** Each is rejected with a red **"Failed: …"** message; nothing is saved.
☐ Pass ☐ Fail

### TC-A9 — Password is stored encrypted (not plaintext)
**Pre:** SMTP saved.
**Steps:** In a terminal:
```bash
sqlite3 /home/dev-2wayclick/Project/MailFlow/backend/mailflow.db \
  "SELECT username, substr(password_encrypted,1,12) FROM smtp_credentials;"
```
**Expected:** `password_encrypted` starts with `gAAAAA` (a Fernet token) — **not** your plaintext
password.
☐ Pass ☐ Fail

---

## Part B — End-to-end send through your own SMTP

### TC-B1 — Create an API key
**Pre:** Logged in.
**Steps:** Go to **API Keys** → type a name (e.g. "manual-test") → click **Create Key**.
**Expected:** A key starting `mf_live_…` is shown once with a copy button and a "won't be shown
again" warning. Copy it.
☐ Pass ☐ Fail

### TC-B2 — Send succeeds via your SMTP (the core test)
**Pre:** SMTP saved (Part A); API key copied (TC-B1); email verified.
**Steps:** In a terminal, replace `YOUR_API_KEY` and the `from` address (use your SMTP username's
address, or any address — see TC-B4):
```bash
curl -X POST http://localhost:8000/v1/mail/send \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "you@your-smtp-domain.com",
    "from_name": "Support Team",
    "to": "recipient@example.com",
    "subject": "BYO-SMTP manual test",
    "html": "<h1>Sent via my own SMTP</h1>",
    "text": "Sent via my own SMTP"
  }'
```
**Expected:**
- HTTP 200 with body `{"id": <n>, "status": "sent", "message_id": "..."}`.
- The email appears in your SMTP provider's inbox (Mailtrap inbox, or the real recipient for Gmail).
- The **From** shows your own address/name (e.g. `Support Team <you@your-smtp-domain.com>`) —
  **not** a "via MailFlow" sender.
☐ Pass ☐ Fail

### TC-B3 — No verified domain required (key difference from shared sending)
**Pre:** SMTP saved. Your `from` domain is **not** added/verified on the **Domains** page.
**Steps:** Repeat TC-B2 using a `from` whose domain is NOT verified.
**Expected:** Still **200 "sent"** — the BYO-SMTP path does not require a verified domain.
(Contrast with Part C, where removing SMTP brings the domain requirement back.)
☐ Pass ☐ Fail

### TC-B4 — Any `from` address is accepted
**Pre:** SMTP saved.
**Steps:** Send with `"from": "anything@some-other-domain.io"`.
**Expected:** 200 "sent"; the message goes out with that From address (your SMTP server is what
ultimately governs what it accepts).
☐ Pass ☐ Fail

### TC-B5 — Omitting `from` defaults to the SMTP login
**Pre:** SMTP saved.
**Steps:** Send a body **without** a `from` field.
**Expected:** 200 "sent"; the email's From is your saved **SMTP username** address.
☐ Pass ☐ Fail

### TC-B6 — Send appears in Email Activity
**Pre:** Sent at least one email (TC-B2).
**Steps:** Open the **Email Activity** page (or `curl http://localhost:8000/v1/logs -H "Authorization: Bearer <JWT>"`).
**Expected:** The send is listed with **status = sent**, correct to/from/subject.
☐ Pass ☐ Fail

---

## Part C — Negative cases & fallback behavior

### TC-C1 — Email-verification gate
**Pre:** SMTP saved; account email **not** verified
(`UPDATE users SET email_verified=0 WHERE email='…';`).
**Steps:** Send via API key (TC-B2 body).
**Expected:** **403** — "Please verify your email address before sending…". Re-verify
(`email_verified=1`) before continuing.
☐ Pass ☐ Fail

### TC-C2 — Bad SMTP credentials → failed send + logged
**Pre:** Save SMTP with a deliberately wrong password (Part A), or point Host at an unreachable
host/port.
**Steps:** Send via API key.
**Expected:** A **4xx/5xx** error (e.g. 400 with an SMTP/connection error message). The send is
recorded in **Email Activity** with **status = failed** and an error reason.
☐ Pass ☐ Fail

### TC-C3 — Remove SMTP → falls back to shared/verified-domain rules
**Pre:** SMTP saved.
**Steps:** On the **SMTP** page click **Remove** → confirm. Then send via API key from a domain that
is **not** verified on the Domains page.
**Expected:**
- The page returns to the empty state ("SMTP credentials removed").
- The send now returns **403** — "The domain '…' is not a verified sending domain on your
  account." (Proves removing SMTP restores the shared-sending policy.)
☐ Pass ☐ Fail

### TC-C4 — Auth failures on send
**Pre:** Any.
**Steps:** Send with (a) no `Authorization` header, (b) `Bearer not-a-real-key`,
(c) `Bearer mf_live_doesnotexist00000000000000000000000`.
**Expected:** **401/403** for each — never a send.
☐ Pass ☐ Fail

### TC-C5 — Missing body content
**Pre:** SMTP saved; valid key.
**Steps:** Send with neither `text` nor `html`.
**Expected:** **422** — "Provide at least one of 'text' or 'html'."
☐ Pass ☐ Fail

---

## Sign-off

| Section | Cases | Pass | Fail | Notes |
|---|---|---|---|---|
| A — SMTP UI | A1–A9 | | | |
| B — E2E send | B1–B6 | | | |
| C — Negative/fallback | C1–C5 | | | |

Tester: ________________   Date: ____________   Build/commit: ____________
