import { useState, useEffect } from "react";
import { auth } from "../App";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import "./Settings.css";

const API = import.meta.env.VITE_API_URL || "/api";

/* --- Professional SVG Icons --- */
const Icons = {
  Account: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  ),
  Sheet: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
  ),
  Security: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
  ),
  Rotate: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
  )
};

export default function Settings({ user }) {
  const [googleStatus, setGoogleStatus]   = useState({ connected: false, email: "" });
  const [loadingStatus, setLoadingStatus] = useState(true);
  
  const [sheets, setSheets]               = useState([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [newSheetName, setNewSheetName]   = useState("");
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [sheetMsg, setSheetMsg]           = useState("");

  const [newPass, setNewPass]             = useState("");
  const [currentPass, setCurrentPass]     = useState("");
  const [passMsg, setPassMsg]             = useState("");

  useEffect(() => {
    fetchGoogleStatus();
  }, []);

  useEffect(() => {
    if (googleStatus.connected) {
      fetchSheets();
    }
  }, [googleStatus.connected]);

  const fetchGoogleStatus = async () => {
    try {
      const token = await auth.currentUser.getIdToken();
      const res   = await fetch(`${API}/auth/gmail/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setGoogleStatus(data);
      } else {
        setGoogleStatus({ connected: false, error: data.detail });
      }
    } catch (e) {
      console.error("Google status check failed", e);
    }
    setLoadingStatus(false);
  };

  const connectGoogle = async () => {
    try {
      const res  = await fetch(`${API}/auth/gmail/url?uid=${user.uid}`);
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        alert(data.detail || "Authentication sequence failed.");
      }
    } catch (e) {
      alert("Host unreachable. Critical communication error.");
    }
  };

  const disconnectGoogle = async () => {
    if (!window.confirm("Terminate Google Account Bridge?")) return;
    try {
      const token = await auth.currentUser.getIdToken();
      await fetch(`${API}/auth/gmail/disconnect`, {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      setGoogleStatus({ connected: false, email: "" });
      setSheets([]);
    } catch (e) {
      alert("Disconnection sequence failed.");
    }
  };

  const fetchSheets = async () => {
    setLoadingSheets(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res   = await fetch(`${API}/sheets/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setSheets(data);
    } catch (e) {
      console.error("Sheet indexed retrieval error", e);
    }
    setLoadingSheets(false);
  };

  const createSheet = async () => {
    if (!newSheetName) return;
    setCreatingSheet(true); setSheetMsg("");
    try {
      const token = await auth.currentUser.getIdToken();
      const res   = await fetch(`${API}/sheets/create`, {
        method:  "POST",
        headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body:    JSON.stringify({ name: newSheetName })
      });
      const data = await res.json();
      if (res.ok) {
        setSheetMsg(`✓ Initialized "${data.name}"`);
        setNewSheetName("");
        fetchSheets();
      } else {
        setSheetMsg("✗ Initializer Error: " + (data.detail || "Failed"));
      }
    } catch (e) {
      setSheetMsg("✗ Signal Error: " + e.message);
    }
    setCreatingSheet(false);
  };

  const changePassword = async () => {
    if (!currentPass || !newPass) return;
    try {
      const cred = EmailAuthProvider.credential(user.email, currentPass);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, newPass);
      setPassMsg("Security profile updated successfully.");
      setCurrentPass("");
      setNewPass("");
    } catch (e) {
      setPassMsg("Verification Failed: " + e.message.replace("Firebase: ", ""));
    }
  };

  return (
    <div className="settings-container">
      <header className="settings-header">
        <h1 className="settings-title">System Settings</h1>
        <p className="settings-subtitle">Manage account security and cross-platform integrations.</p>
      </header>

      {/* --- Section 1: User Identity --- */}
      <section className="settings-card">
        <div className="card-head">
          <span className="card-icon"><Icons.Account /></span>
          <span className="card-label">Verified Identity</span>
        </div>
        <div className="info-row">
          <span className="info-key">Primary Address</span>
          <span className="info-val">{user.email}</span>
        </div>
        <div className="info-row">
          <span className="info-key">Unique ID</span>
          <span className="info-val">{user.uid.slice(0, 16)}...</span>
        </div>
      </section>

      {/* --- Section 2: Google Bridge --- */}
      <section className="settings-card">
        <div className="card-head">
          <span className="card-label">Google Service Bridge</span>
        </div>
        <p className="settings-subtitle" style={{ fontSize: "0.875rem", marginBottom: "1.5rem" }}>
          Enable high-priority Gmail API routing and real-time spreadsheet data logging.
        </p>

        {loadingStatus ? (
          <div className="loading-state">Syncing service status...</div>
        ) : googleStatus.connected ? (
          <div>
            <div className="google-status-panel">
              <div className="status-info">
                <span className="status-tag">Connected Identity</span>
                <span className="status-email">{googleStatus.email || "Active Authorization"}</span>
              </div>
              <button className="btn-disconnect" onClick={disconnectGoogle}>
                Terminate Authorization
              </button>
            </div>

            {/* --- Google Sheets Section --- */}
            <div className="sheets-manager">
              <div className="card-head" style={{ marginBottom: "1.25rem" }}>
                <span className="card-icon"><Icons.Sheet /></span>
                <span className="card-label">Provisioned Sheets</span>
                <button className="btn-primary" 
                        style={{ marginLeft: "auto", padding: "0.4rem 0.8rem", fontSize: "0.75rem", background: "transparent", border:"1px solid var(--border-color)", color: "var(--text-muted)" }} 
                        onClick={fetchSheets}>
                  <Icons.Rotate />
                </button>
              </div>
              
              <div className="sheets-controls">
                <input 
                  className="sheet-input" 
                  value={newSheetName} 
                  onChange={e=>setNewSheetName(e.target.value)} 
                  placeholder="New campaign sheet identifier..." 
                />
                <button className="btn-primary" onClick={createSheet} disabled={creatingSheet}>
                  {creatingSheet ? "Initializing..." : "Provision Sheet"}
                </button>
              </div>
              {sheetMsg && <div className={sheetMsg.includes("✓") ? "msg-ok" : "msg-err"}>{sheetMsg}</div>}
              
              <div className="sheet-list" style={{ marginTop: "1rem" }}>
                {loadingSheets ? (
                  <div className="loading-state">Indexing resources...</div>
                ) : sheets.length > 0 ? (
                  sheets.map(sheet => (
                    <div key={sheet.id} className="sheet-item">
                      <div style={{ display:"flex", flexDirection:"column" }}>
                        <span className="sheet-name">{sheet.name}</span>
                        <span className="sheet-id">ID: {sheet.id.slice(0, 12)}...</span>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign:"center", padding:"3rem", border:"1px dashed var(--border-color)", borderRadius: 12, color:"var(--text-muted)", fontSize:"0.875rem" }}>
                    No initialized sheets found for this account.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: "1rem 0" }}>
            <button className="btn-google-connect" onClick={connectGoogle}>
              Authenticate with Google Systems
            </button>
            {googleStatus.error && (
              <div className="msg-err" style={{ marginTop: "1.5rem", padding: "1rem", background: "rgba(239, 68, 68, 0.05)", borderRadius: 10 }}>
                <strong>Authorization Guard Failed:</strong> {googleStatus.error}
                <p style={{ marginTop: 4, opacity: 0.7 }}>Please contact system administrator if this persists.</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* --- Section 3: Security --- */}
      <section className="settings-card">
        <div className="card-head">
          <span className="card-icon"><Icons.Security /></span>
          <span className="card-label">Security Protocol</span>
        </div>
        <div className="form-group">
          <label className="field-label">Verification Phrase (Current)</label>
          <input 
            className="field-input" 
            type="password" 
            value={currentPass} 
            onChange={e=>setCurrentPass(e.target.value)} 
            placeholder="••••••••" 
          />
        </div>
        <div className="form-group">
          <label className="field-label">New Payload Access Code</label>
          <input 
            className="field-input" 
            type="password" 
            value={newPass} 
            onChange={e=>setNewPass(e.target.value)} 
            placeholder="••••••••" 
          />
        </div>
        <button className="btn-primary" onClick={changePassword}>Update Security Profile</button>
        {passMsg && <div className={passMsg.includes("successfully") ? "msg-ok" : "msg-err"}>{passMsg}</div>}
      </section>
    </div>
  );
}

