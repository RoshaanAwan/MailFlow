import { useState, useEffect } from "react";
import { auth } from "../App";
import "./Settings.css";

const API = import.meta.env.VITE_API_URL || "/api";

/* --- Professional SVG Icons --- */
const Icons = {
  Account: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  ),
  Mail: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg>
  ),
  Security: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
  ),
};

export default function Settings({ user }) {
  const [quota, setQuota] = useState(null);

  const [newPass, setNewPass]             = useState("");
  const [currentPass, setCurrentPass]     = useState("");
  const [passMsg, setPassMsg]             = useState("");

  const authHeader = async () => ({ Authorization: `Bearer ${await auth.currentUser.getIdToken()}` });

  useEffect(() => { fetchQuota(); }, []);

  const fetchQuota = async () => {
    try {
      const res  = await fetch(`${API}/v1/quota`, { headers: await authHeader() });
      const data = await res.json();
      if (res.ok) setQuota(data);
    } catch (e) {
      console.error("Quota fetch failed", e);
    }
  };

  const changePassword = async () => {
    if (!currentPass || !newPass) return;
    try {
      const res = await fetch(`${API}/auth/change-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body:    JSON.stringify({ current_password: currentPass, new_password: newPass }),
      });
      const data = await res.json();
      if (res.ok) {
        setPassMsg("Password updated successfully.");
        setCurrentPass(""); setNewPass("");
      } else {
        setPassMsg("Failed: " + (data.detail || "Could not update password"));
      }
    } catch (e) {
      setPassMsg("Failed: " + e.message);
    }
  };

  return (
    <div className="settings-container">
      <header className="settings-header">
        <h1 className="settings-title">System Settings</h1>
        <p className="settings-subtitle">Manage your account.</p>
      </header>

      {/* --- Identity --- */}
      <section className="settings-card">
        <div className="card-head">
          <span className="card-icon"><Icons.Account /></span>
          <span className="card-label">Account</span>
        </div>
        <div className="info-row">
          <span className="info-key">Email</span>
          <span className="info-val">{user.email}</span>
        </div>
        <div className="info-row">
          <span className="info-key">User ID</span>
          <span className="info-val">{user.uid}</span>
        </div>
      </section>

      {/* --- Sending (shared, nothing to connect) --- */}
      <section className="settings-card">
        <div className="card-head">
          <span className="card-icon"><Icons.Mail /></span>
          <span className="card-label">Sending</span>
        </div>
        <p className="settings-subtitle" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
          Sending is built in — no setup required. Emails go out through MailFlow's
          delivery service, and replies come straight back to <strong>{user.email}</strong>.
        </p>
        {quota && (
          <div className="info-row">
            <span className="info-key">Daily quota</span>
            <span className="info-val">
              {quota.used} / {quota.limit} used · {quota.remaining} left today
            </span>
          </div>
        )}
        {quota && !quota.sender_ready && (
          <div className="msg-err" style={{ marginTop: "0.75rem" }}>
            ⚠ The delivery service is not configured yet (admin setup needed).
          </div>
        )}
      </section>

      {/* --- Security --- */}
      <section className="settings-card">
        <div className="card-head">
          <span className="card-icon"><Icons.Security /></span>
          <span className="card-label">Change Password</span>
        </div>
        <div className="form-group">
          <label className="field-label">Current password</label>
          <input className="field-input" type="password" value={currentPass}
            onChange={e=>setCurrentPass(e.target.value)} placeholder="••••••••" />
        </div>
        <div className="form-group">
          <label className="field-label">New password</label>
          <input className="field-input" type="password" value={newPass}
            onChange={e=>setNewPass(e.target.value)} placeholder="••••••••" />
        </div>
        <button className="btn-primary" onClick={changePassword}>Update Password</button>
        {passMsg && <div className={passMsg.includes("success") ? "msg-ok" : "msg-err"}>{passMsg}</div>}
      </section>
    </div>
  );
}
