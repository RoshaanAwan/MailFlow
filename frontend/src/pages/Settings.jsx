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
  const [google, setGoogle] = useState(null);     // { connected, email, oauth_configured }
  const [googleMsg, setGoogleMsg] = useState("");
  const [connecting, setConnecting] = useState(false);

  const [newPass, setNewPass]             = useState("");
  const [currentPass, setCurrentPass]     = useState("");
  const [passMsg, setPassMsg]             = useState("");

  const authHeader = async () => ({ Authorization: `Bearer ${await auth.currentUser.getIdToken()}` });

  useEffect(() => {
    fetchQuota();
    fetchGoogle();
    // Show the result of the OAuth round-trip (callback redirects with ?google=...).
    const params = new URLSearchParams(window.location.search);
    const g = params.get("google");
    if (g === "connected") setGoogleMsg("Google account connected successfully.");
    else if (g === "no_refresh") setGoogleMsg("Failed: Google didn't return access — try again, or remove MailFlow at myaccount.google.com/permissions and reconnect.");
    else if (g === "expired") setGoogleMsg("Failed: the connection request expired. Please try again.");
    else if (g) setGoogleMsg("Failed: could not connect your Google account.");
    if (g) window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const fetchQuota = async () => {
    try {
      const res  = await fetch(`${API}/v1/quota`, { headers: await authHeader() });
      const data = await res.json();
      if (res.ok) setQuota(data);
    } catch (e) {
      console.error("Quota fetch failed", e);
    }
  };

  const fetchGoogle = async () => {
    try {
      const res  = await fetch(`${API}/v1/google/status`, { headers: await authHeader() });
      const data = await res.json();
      if (res.ok) setGoogle(data);
    } catch (e) {
      console.error("Google status fetch failed", e);
    }
  };

  const connectGoogle = async () => {
    setGoogleMsg(""); setConnecting(true);
    try {
      const res  = await fetch(`${API}/v1/google/connect`, { headers: await authHeader() });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;   // send the browser to Google's consent screen
      } else {
        setGoogleMsg("Failed: " + (data.detail || "Could not start Google connect."));
        setConnecting(false);
      }
    } catch (e) {
      setGoogleMsg("Failed: " + e.message);
      setConnecting(false);
    }
  };

  const disconnectGoogle = async () => {
    if (!window.confirm("Disconnect your Google account? You won't be able to send until you reconnect.")) return;
    setGoogleMsg("");
    try {
      const res = await fetch(`${API}/v1/google`, { method: "DELETE", headers: await authHeader() });
      if (res.ok) { setGoogle({ connected: false, oauth_configured: google?.oauth_configured }); setGoogleMsg("Google account disconnected."); }
    } catch (e) {
      setGoogleMsg("Failed: " + e.message);
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

      {/* --- Connect Google (send through your own Gmail) --- */}
      <section className="settings-card">
        <div className="card-head">
          <span className="card-icon"><Icons.Mail /></span>
          <span className="card-label">Sending — Google Account</span>
        </div>
        <p className="settings-subtitle" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
          Connect your Google account so MailFlow sends email <strong>through your own Gmail</strong>.
          Emails go out from your address, and campaigns + the API use this connection.
        </p>

        {google && google.connected ? (
          <>
            <div className="info-row">
              <span className="info-key">Connected account</span>
              <span className="info-val">{google.email || "Google account"}</span>
            </div>
            {quota && (
              <div className="info-row">
                <span className="info-key">Daily quota</span>
                <span className="info-val">{quota.used} / {quota.limit} used · {quota.remaining} left today</span>
              </div>
            )}
            <button className="btn-primary" style={{ marginTop: "1rem", background: "transparent", border: "1px solid #5a2a2a", color: "#e07a7a" }} onClick={disconnectGoogle}>
              Disconnect
            </button>
          </>
        ) : google && !google.oauth_configured ? (
          <div className="msg-err">⚠ Google connect isn't configured on the server yet (admin setup needed).</div>
        ) : (
          <button className="btn-primary" onClick={connectGoogle} disabled={connecting}>
            {connecting ? "Redirecting…" : "Connect Google Account"}
          </button>
        )}

        {googleMsg && <div className={googleMsg.includes("success") || googleMsg.includes("connected") || googleMsg.includes("disconnected") ? "msg-ok" : "msg-err"} style={{ marginTop: "0.75rem" }}>{googleMsg}</div>}
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
