# Using Your MailFlow API Key in Another Project

Once you've created an API key in the dashboard (**API Keys → Create Key**, looks like
`mf_live_…`), any external project can send email by calling MailFlow's send endpoint with that
key. This guide has copy-paste examples for the common stacks.

---

## The contract (read this first)

**Endpoint:** `POST /v1/mail/send`
**Base URL:** `http://localhost:8000` in local dev — replace with your deployed backend URL in prod.

**Auth:** send the key as a Bearer token:
```
Authorization: Bearer mf_live_your_key_here
```

**Request body (JSON):**

| Field | Required | Notes |
|---|---|---|
| `to` | ✅ | recipient email |
| `subject` | ✅ | |
| `from` | ✅* | sender address. *Required unless you've configured your own SMTP, in which case it defaults to your SMTP login. |
| `from_name` | optional | display name shown to the recipient |
| `html` | one of html/text required | HTML body |
| `text` | one of html/text required | plain-text body |

**Success →** HTTP `200`:
```json
{ "id": 42, "status": "sent", "message_id": "..." }
```

**Common errors:**
| Code | Meaning |
|---|---|
| `401` | Missing / malformed / unknown / revoked key |
| `403` | Email not verified, **or** sending from an unverified domain (shared-sending path only — see below) |
| `422` | Bad/missing fields (no `to`, no `from`, neither `text` nor `html`, invalid email) |
| `400` / `502` | The send was attempted but the mail server rejected it / couldn't be reached |

### Which `from` addresses are allowed?
- **If you configured your own SMTP** (dashboard → **SMTP**): you can send from any address (your
  SMTP server is the gatekeeper), and no domain verification is needed.
- **If you use MailFlow's shared sending** (no SMTP configured): the `from` domain must be added and
  **verified** on the **Domains** page first, or you'll get a `403`.

> ⚠️ **Never put your `mf_live_…` key in frontend/browser/mobile code.** It can send email on your
> behalf. Keep it server-side, in an environment variable.

---

## curl (quick check)

```bash
curl -X POST http://localhost:8000/v1/mail/send \
  -H "Authorization: Bearer $MAILFLOW_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "you@yourdomain.com",
    "from_name": "Acme Support",
    "to": "recipient@example.com",
    "subject": "Hello from MailFlow",
    "html": "<h1>It works!</h1>",
    "text": "It works!"
  }'
```

---

## Node.js

No dependencies needed (Node 18+ has global `fetch`).

```js
// mailflow.js
const MAILFLOW_URL = process.env.MAILFLOW_URL || "http://localhost:8000";
const API_KEY = process.env.MAILFLOW_API_KEY; // set in your env, never hard-code

export async function sendEmail({ from, fromName, to, subject, html, text }) {
  const res = await fetch(`${MAILFLOW_URL}/v1/mail/send`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, from_name: fromName, to, subject, html, text }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`MailFlow ${res.status}: ${data.detail || JSON.stringify(data)}`);
  }
  return data; // { id, status: "sent", message_id }
}

// usage
sendEmail({
  from: "you@yourdomain.com",
  fromName: "Acme Support",
  to: "recipient@example.com",
  subject: "Hello",
  html: "<h1>It works!</h1>",
})
  .then((r) => console.log("sent:", r))
  .catch((e) => console.error(e.message));
```

Run with: `MAILFLOW_API_KEY=mf_live_... node mailflow.js`

---

## Python

Uses [`requests`](https://pypi.org/project/requests/) (`pip install requests`).

```python
# mailflow.py
import os
import requests

MAILFLOW_URL = os.getenv("MAILFLOW_URL", "http://localhost:8000")
API_KEY = os.environ["MAILFLOW_API_KEY"]  # set in your env, never hard-code

def send_email(*, sender, to, subject, html=None, text=None, from_name=""):
    res = requests.post(
        f"{MAILFLOW_URL}/v1/mail/send",
        headers={"Authorization": f"Bearer {API_KEY}"},
        json={
            "from": sender,
            "from_name": from_name,
            "to": to,
            "subject": subject,
            "html": html,
            "text": text,
        },
        timeout=30,
    )
    if not res.ok:
        raise RuntimeError(f"MailFlow {res.status_code}: {res.json().get('detail', res.text)}")
    return res.json()  # {"id":..., "status":"sent", "message_id":...}

if __name__ == "__main__":
    print(send_email(
        sender="you@yourdomain.com",
        from_name="Acme Support",
        to="recipient@example.com",
        subject="Hello",
        html="<h1>It works!</h1>",
    ))
```

Run with: `MAILFLOW_API_KEY=mf_live_... python mailflow.py`

---

## PHP

```php
<?php
// mailflow.php
$MAILFLOW_URL = getenv('MAILFLOW_URL') ?: 'http://localhost:8000';
$API_KEY = getenv('MAILFLOW_API_KEY'); // set in your env, never hard-code

function send_email($payload) {
    global $MAILFLOW_URL, $API_KEY;
    $ch = curl_init("$MAILFLOW_URL/v1/mail/send");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer $API_KEY",
            "Content-Type: application/json",
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $data = json_decode($body, true);
    if ($code < 200 || $code >= 300) {
        throw new Exception("MailFlow $code: " . ($data['detail'] ?? $body));
    }
    return $data;
}

print_r(send_email([
    "from"      => "you@yourdomain.com",
    "from_name" => "Acme Support",
    "to"        => "recipient@example.com",
    "subject"   => "Hello",
    "html"      => "<h1>It works!</h1>",
]));
```

---

## Storing the key safely

Put the key in your project's environment, not in source code:

```bash
# .env  (add this file to .gitignore!)
MAILFLOW_API_KEY=mf_live_your_key_here
MAILFLOW_URL=http://localhost:8000
```

- **Node:** `process.env.MAILFLOW_API_KEY` (use `dotenv` or your host's env settings)
- **Python:** `os.environ["MAILFLOW_API_KEY"]`
- **PHP:** `getenv('MAILFLOW_API_KEY')`

When you deploy MailFlow, change `MAILFLOW_URL` to the deployed backend's URL.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `401 Invalid API key format` | Key must start with `mf_live_`. Check you copied it whole. |
| `401 Invalid or revoked API key` | The key was revoked in the dashboard, or mistyped. Create a new one. |
| `403 Please verify your email…` | Verify your MailFlow account's email first. |
| `403 …not a verified sending domain` | You're on shared sending — add & verify the `from` domain on **Domains**, or configure your own SMTP. |
| `422 Provide at least one of 'text' or 'html'` | Include a `html` and/or `text` body. |
| `400/502 Send failed…` | Your SMTP creds/host are wrong or unreachable — re-test them on the **SMTP** page. |
