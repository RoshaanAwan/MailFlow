import { useState, useEffect } from "react";
import { auth } from "../App";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";

const API = import.meta.env.VITE_API_URL || "/api";

const s = {
  title:  { fontSize:24, fontWeight:700, color:"#f0f0f0", marginBottom:6, letterSpacing:"-0.5px" },
  sub:    { fontSize:14, color:"#555", marginBottom:32 },
  card:   { background:"#1a1a1a", border:"0.5px solid #1f1f1f", borderRadius:12, padding:"1.5rem", marginBottom:16 },
  secLbl: { fontSize:11, color:"#555", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:16 },
  label:  { fontSize:12, color:"#888", marginBottom:6, display:"block" },
  input:  { width:"100%", background:"#111", border:"0.5px solid #222", borderRadius:8, padding:"10px 12px", color:"#f0f0f0", fontSize:14, boxSizing:"border-box", outline:"none", marginBottom:12 },
  btn:    { padding:"9px 20px", background:"#f0f0f0", color:"#0f0f0f", border:"none", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer" },
  rbtn:   { padding:"a9px 20px", background:"transparent", color:"#f87171", border:"0.5px solid #f87171", borderRadius:8, fontSize:13, fontWeight:500, cursor:"pointer" },
  gbtn:   { padding:"11px 24px", background:"#4285F4", color:"white", border:"none", borderRadius:8, fontSize:14, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:10 },
  row:    { display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:12, marginBottom:12, borderBottom:"0.5px solid #1f1f1f" },
  key:    { fontSize:13, color:"#888" },
  val:    { fontSize:13, color:"#f0f0f0", fontWeight:500 },
  err:    { fontSize:12, color:"#f87171", marginTop:8 },
  ok:     { fontSize:12, color:"#4ade80", marginTop:8 },
  status: { padding:"12px", borderRadius:8, background:"#111", border:"0.5px solid #222", display:"flex", justifyContent:"space-between", alignItems:"center" },
  list:   { marginTop:16, display:"flex", flexDirection:"column", gap:8 },
  listItem:{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", background:"#111", border:"0.5px solid #222", borderRadius:8, fontSize:13 },
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
        console.error("Google status error detaill:", data.detail);
        // Maybe set a helpful message or stay disconnected
        setGoogleStatus({ connected: false, error: data.detail });
      }
    } catch (e) {
      console.error("Google status error:", e);
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
        alert(data.detail || "Failed to get auth URL");
      }
    } catch (e) {
      alert("Backend unreachable. Ensure FastAPI is running on port 8000.");
    }
  };

  const disconnectGoogle = async () => {
    if (!window.confirm("Disconnect Google account?")) return;
    try {
      const token = await auth.currentUser.getIdToken();
      await fetch(`${API}/auth/gmail/disconnect`, {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      setGoogleStatus({ connected: false, email: "" });
      setSheets([]);
    } catch (e) {
      alert("Failed to disconnect");
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
      console.error("Fetch sheets error:", e);
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
        setSheetMsg(`✓ Created "${data.name}"`);
        setNewSheetName("");
        fetchSheets();
      } else {
        setSheetMsg("✗ " + (data.detail || "Failed to create sheet"));
      }
    } catch (e) {
      setSheetMsg("✗ " + e.message);
    }
    setCreatingSheet(false);
  };

  const changePassword = async () => {
    try {
      const cred = EmailAuthProvider.credential(user.email, currentPass);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, newPass);
      setPassMsg("Password updated successfully!");
    } catch (e) {
      setPassMsg(e.message.replace("Firebase: ", ""));
    }
  };

  return (
    <div>
      <div style={s.title}>Settings</div>
      <div style={s.sub}>Manage your account and Google integrations</div>

      <div style={s.card}>
        <div style={s.secLbl}>Account info</div>
        <div style={s.row}>
          <span style={s.key}>Email</span>
          <span style={s.val}>{user.email}</span>
        </div>
        <div style={s.row}>
          <span style={s.key}>User ID</span>
          <span style={s.val}>{user.uid.slice(0, 12)}...</span>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.secLbl}>Google Integration</div>
        <p style={{ fontSize:13, color:"#888", marginBottom:16 }}>
          Connect your Google account to send emails via Gmail and log campaign results to your Google Sheets automatically.
        </p>
        
        {loadingStatus ? (
          <div style={s.val}>Loading...</div>
        ) : googleStatus.connected ? (
          <div>
            <div style={s.status}>
              <div>
                <div style={{ fontSize:11, color:"#555", textTransform:"uppercase" }}>Connected as</div>
                <div style={s.val}>{googleStatus.email || "Your Google Account"}</div>
              </div>
              <button style={{ ...s.rbtn, padding:"9px 20px" }} onClick={disconnectGoogle}>Disconnect</button>
            </div>

            <div style={{ marginTop:24 }}>
              <div style={s.secLbl}>Your Google Sheets</div>
              <div style={{ display:"flex", gap:10, marginBottom:16 }}>
                <input 
                  style={{ ...s.input, marginBottom:0, flex:1 }} 
                  value={newSheetName} 
                  onChange={e=>setNewSheetName(e.target.value)} 
                  placeholder="Sheet name for new campaigns" 
                />
                <button style={s.btn} onClick={createSheet} disabled={creatingSheet}>
                  {creatingSheet ? "Creating..." : "Create New Sheet"}
                </button>
              </div>
              {sheetMsg && <div style={sheetMsg.includes("✓") ? s.ok : s.err}>{sheetMsg}</div>}
              
              <div style={s.list}>
                {loadingSheets ? (
                  <div style={s.val}>Loading sheets...</div>
                ) : sheets.length > 0 ? (
                  sheets.map(sheet => (
                    <div key={sheet.id} style={s.listItem}>
                      <span>{sheet.name}</span>
                      <span style={{ fontSize:11, color:"#444" }}>{sheet.id.slice(0,8)}...</span>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize:13, color:"#444", textAlign:"center", padding:"2rem", border:"0.5px dashed #222", borderRadius:8 }}>
                    No sheets found. Create one above to get started.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <button style={{ ...s.gbtn, marginBottom: googleStatus.error ? 12 : 0 }} onClick={connectGoogle}>
              <span style={{ fontSize:18 }}>G</span> Connect Google Account
            </button>
            {googleStatus.error && (
              <div style={s.err}>
                <strong>Connection Error:</strong> {googleStatus.error}
                <p style={{ marginTop:4, fontSize:11, opacity:0.8 }}>
                  Check your backend environment variables (Firebase Service Account).
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={s.card}>
        <div style={s.secLbl}>Change password</div>
        <label style={s.label}>Current password</label>
        <input style={s.input} type="password" value={currentPass} onChange={e=>setCurrentPass(e.target.value)} placeholder="••••••••" />
        <label style={s.label}>New password</label>
        <input style={s.input} type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="••••••••" />
        <button style={s.btn} onClick={changePassword}>Update password</button>
        {passMsg && <div style={passMsg.includes("success") ? s.ok : s.err}>{passMsg}</div>}
      </div>
    </div>
  );
}
