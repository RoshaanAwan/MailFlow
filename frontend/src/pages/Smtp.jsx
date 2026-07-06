import { useState, useEffect } from "react";
import { auth } from "../App";
import "./Settings.css";

const API = import.meta.env.VITE_API_URL || "/api";

const Icons = {
  Mail: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg>
  ),
};

export default function Smtp() {
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading]       = useState(true);

  const [host, setHost]         = useState("smtp.gmail.com");
  const [port, setPort]         = useState(587);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState("");

  const [saveMsg, setSaveMsg]   = useState("");
  const [testMsg, setTestMsg]   = useState("");
  const [saving, setSaving]     = useState(false);
  const [testing, setTesting]   = useState(false);

  const authHeader = async () => ({ Authorization: `Bearer ${await auth.currentUser.getIdToken()}` });

  useEffect(() => { fetchSmtp(); }, []);

  const fetchSmtp = async () => {
    try {
      const res  = await fetch(`${API}/v1/smtp`, { headers: await authHeader() });
      const data = await res.json();
      if (res.ok && data.configured) {
        setConfigured(true);
        setHost(data.host || "smtp.gmail.com");
        setPort(data.port || 587);
        setUsername(data.username || "");
        setFromName(data.from_name || "");
        // password is never returned — left blank
      }
    } catch (e) {
      console.error("SMTP fetch failed", e);
    } finally {
      setLoading(false);
    }
  };

  const body = () => ({
    host,
    port: Number(port),
    username,
    password,
    from_name: fromName,
  });

  const save = async () => {
    setSaveMsg(""); setTestMsg("");
    if (!username || (!configured && !password)) {
      setSaveMsg("Failed: username and password are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/v1/smtp`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body:    JSON.stringify(body()),
      });
      const data = await res.json();
      if (res.ok) {
        setConfigured(true);
        setPassword("");
        setSaveMsg("SMTP settings saved successfully.");
      } else {
        setSaveMsg("Failed: " + (data.detail || "Could not save SMTP settings."));
      }
    } catch (e) {
      setSaveMsg("Failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTestMsg(""); setSaveMsg("");
    if (!username) {
      setTestMsg("Enter a username to test.");
      return;
    }
    // If the password field is blank and nothing is saved yet, there's nothing
    // to test. When SMTP is already configured, the backend falls back to the
    // saved password, so a blank field is fine.
    if (!password && !configured) {
      setTestMsg("Enter a password to test (or save your settings first).");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch(`${API}/v1/smtp/test`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body:    JSON.stringify(body()),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setTestMsg("Connected successfully — credentials are valid.");
      } else {
        setTestMsg("Failed: " + (data.error || data.detail || "Could not connect."));
      }
    } catch (e) {
      setTestMsg("Failed: " + e.message);
    } finally {
      setTesting(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Remove your SMTP credentials? Sending will fall back to MailFlow's shared delivery (verified domains only).")) return;
    setSaveMsg(""); setTestMsg("");
    try {
      const res = await fetch(`${API}/v1/smtp`, { method: "DELETE", headers: await authHeader() });
      if (res.ok) {
        setConfigured(false);
        setHost("smtp.gmail.com"); setPort(587); setUsername(""); setPassword(""); setFromName("");
        setSaveMsg("SMTP credentials removed.");
      } else {
        const data = await res.json();
        setSaveMsg("Failed: " + (data.detail || "Could not remove credentials."));
      }
    } catch (e) {
      setSaveMsg("Failed: " + e.message);
    }
  };

  if (loading) return (
    <div className="settings-container">
      <p className="settings-subtitle">Loading SMTP settings…</p>
    </div>
  );

  return (
    <div className="settings-container">
      <header className="settings-header">
        <h1 className="settings-title">SMTP Settings</h1>
        <p className="settings-subtitle">
          Send through your own SMTP server. When configured, the email API sends from your
          server with the <strong>from</strong> address you provide — no domain verification required.
        </p>
      </header>

      <section className="settings-card">
        <div className="card-head">
          <span className="card-icon"><Icons.Mail /></span>
          <span className="card-label">
            Your SMTP server {configured && <em style={{ fontStyle: "normal", color: "#4caf50" }}>· configured</em>}
          </span>
        </div>

        <div className="form-group">
          <label className="field-label">Host</label>
          <input className="field-input" value={host}
            onChange={e=>setHost(e.target.value)} placeholder="smtp.gmail.com" />
        </div>
        <div className="form-group">
          <label className="field-label">Port</label>
          <input className="field-input" type="number" value={port}
            onChange={e=>setPort(e.target.value)} placeholder="587" />
        </div>
        <div className="form-group">
          <label className="field-label">Username (login &amp; from address)</label>
          <input className="field-input" type="email" value={username}
            onChange={e=>setUsername(e.target.value)} placeholder="you@example.com" />
        </div>
        <div className="form-group">
          <label className="field-label">Password</label>
          <input className="field-input" type="password" value={password}
            onChange={e=>setPassword(e.target.value)}
            placeholder={configured ? "•••••••• (leave blank to keep current)" : "App password"} />
        </div>
        <div className="form-group">
          <label className="field-label">From name (optional)</label>
          <input className="field-input" value={fromName}
            onChange={e=>setFromName(e.target.value)} placeholder="Acme Inc" />
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button className="btn-primary" onClick={test} disabled={testing}
            style={{ background: "transparent", border: "1px solid #444" }}>
            {testing ? "Testing…" : "Test connection"}
          </button>
          {configured && (
            <button className="btn-primary" onClick={remove}
              style={{ background: "transparent", border: "1px solid #5a2a2a", color: "#e07a7a" }}>
              Remove
            </button>
          )}
        </div>

        {saveMsg && <div className={saveMsg.includes("success") || saveMsg.includes("removed") || saveMsg.includes("saved") ? "msg-ok" : "msg-err"}>{saveMsg}</div>}
        {testMsg && <div className={testMsg.includes("successfully") ? "msg-ok" : "msg-err"}>{testMsg}</div>}
      </section>
    </div>
  );
}
