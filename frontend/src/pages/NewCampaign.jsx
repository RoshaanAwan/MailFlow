import { useState, useEffect } from "react";
import { auth } from "../App";

const API = "http://localhost:8000";

const s = {
  title:   { fontSize:24, fontWeight:700, color:"#f0f0f0", marginBottom:6, letterSpacing:"-0.5px" },
  sub:     { fontSize:14, color:"#555", marginBottom:32 },
  card:    { background:"#1a1a1a", border:"0.5px solid #1f1f1f", borderRadius:12, padding:"1.5rem", marginBottom:16 },
  secLbl:  { fontSize:11, color:"#555", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:16 },
  grid:    { display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 },
  label:   { fontSize:12, color:"#888", marginBottom:6, display:"block" },
  input:   { width:"100%", background:"#111", border:"0.5px solid #222", borderRadius:8, padding:"10px 12px", color:"#f0f0f0", fontSize:14, boxSizing:"border-box", outline:"none" },
  textarea:{ width:"100%", background:"#111", border:"0.5px solid #222", borderRadius:8, padding:"10px 12px", color:"#f0f0f0", fontSize:13, boxSizing:"border-box", outline:"none", minHeight:160, resize:"vertical", fontFamily:"monospace", lineHeight:1.6 },
  upload:  { width:"100%", background:"#111", border:"0.5px dashed #333", borderRadius:8, padding:"1.5rem", textAlign:"center", cursor:"pointer", color:"#555", fontSize:13, boxSizing:"border-box" },
  btn:     { padding:"11px 24px", background:"#f0f0f0", color:"#0f0f0f", border:"none", borderRadius:8, fontSize:14, fontWeight:600, cursor:"pointer", marginTop:8 },
  cbtn:    { padding:"11px 24px", background:"transparent", color:"#f87171", border:"0.5px solid #f87171", borderRadius:8, fontSize:14, fontWeight:500, cursor:"pointer", marginTop:8, marginLeft:12 },
  progress:{ background:"#111", border:"0.5px solid #222", borderRadius:12, padding:"1.5rem", marginTop:16 },
  bar:     { height:6, background:"#222", borderRadius:3, overflow:"hidden", margin:"12px 0" },
  fill:    { height:"100%", background:"#f0f0f0", borderRadius:3, transition:"width 0.5s" },
  stat:    { display:"flex", gap:24, marginTop:8 },
  statItem:{ fontSize:13, color:"#888" },
  statNum: { fontWeight:600, color:"#f0f0f0" },
  err:     { fontSize:13, color:"#f87171", marginTop:8 },
  warn:    { fontSize:13, color:"#fbbf24", background:"rgba(251,191,36,0.1)", border:"0.5px solid #fbbf24", padding:"12px", borderRadius:8, marginBottom:16 },
  success: { fontSize:13, color:"#4ade80", marginTop:8 },
  hint:    { fontSize:11, color:"#444", marginTop:6 },
};

export default function NewCampaign({ user, setPage }) {
  const [form, setForm] = useState({
    campaign_name: "",
    subject:       "quick idea for {company}",
    body:          `Hi {name},\n\nI build web apps and APIs for startups — recently helped a similar company cut their dev costs by 40% while shipping faster.\n\nHad a quick idea for {company} that might be worth 10 minutes of your time.\n\nWorth a chat?\n\nRoshaan Ali\nFull Stack Engineer\n+92 302 4917779\n\n---\nTo unsubscribe, reply with "unsubscribe".`,
    sender_name:   "",
    sender_email:  "",
    delay_seconds: 10,
    daily_limit:   20,
    sheet_name:    "Email Campaign Log",
  });
  const [file, setFile]           = useState(null);
  const [campaignId, setCampaignId] = useState(null);
  const [status, setStatus]       = useState(null);
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [gmailConnected, setGmailConnected] = useState(true);

  useEffect(() => {
    checkGmail();
  }, []);

  const checkGmail = async () => {
    try {
      const token = await auth.currentUser.getIdToken();
      const res   = await fetch(`${API}/auth/gmail/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setGmailConnected(data.connected);
    } catch (e) {
      console.error("Gmail check failed");
    }
  };

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (f) setFile(f);
  };

  const startCampaign = async () => {
    if (!gmailConnected)    return setError("Please connect your Gmail account in Settings first.");
    if (!file)              return setError("Please upload a contacts CSV file.");
    if (!form.campaign_name) return setError("Please enter a campaign name.");
    if (!form.sender_email) return setError("Please enter your sender email.");

    setLoading(true); setError("");

    try {
      const token   = await auth.currentUser.getIdToken();
      const formData = new FormData();
      formData.append("file", file);

      const params = new URLSearchParams({
        campaign_name: form.campaign_name,
        subject:       form.subject,
        body:          form.body,
        sender_name:   form.sender_name,
        sender_email:  form.sender_email,
        delay_seconds: form.delay_seconds,
        daily_limit:   form.daily_limit,
        sheet_name:    form.sheet_name,
      });

      const res  = await fetch(`${API}/campaign/start?${params}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to start campaign");

      setCampaignId(data.campaign_id);
      pollStatus(data.campaign_id, token);

    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const pollStatus = async (id, token) => {
    const interval = setInterval(async () => {
      try {
        const res  = await fetch(`${API}/campaign/${id}/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setStatus(data);
        if (data.status === "completed" || data.status?.startsWith("error")) {
          clearInterval(interval);
        }
      } catch (e) {
        clearInterval(interval);
      }
    }, 2000);
  };

  const cancelCampaign = async () => {
    if (!campaignId) return;
    const token = await auth.currentUser.getIdToken();
    await fetch(`${API}/campaign/${campaignId}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
  };

  const pct = status ? Math.round((status.sent / Math.max(status.total, 1)) * 100) : 0;

  return (
    <div>
      <div style={s.title}>New campaign</div>
      <div style={s.sub}>Upload your contacts and send personalized emails via Gmail API</div>

      {!gmailConnected && (
        <div style={s.warn}>
          ⚠️ <strong>Gmail not connected.</strong> Head to <span style={{ cursor:"pointer", textDecoration:"underline" }} onClick={()=>setPage("settings")}>Settings</span> to authorize your account before starting a campaign.
        </div>
      )}

      <div style={s.card}>
        <div style={s.secLbl}>Campaign details</div>
        <div style={{ marginBottom:12 }}>
          <label style={s.label}>Campaign name</label>
          <input style={s.input} value={form.campaign_name} onChange={e=>update("campaign_name", e.target.value)} placeholder="e.g. Startup outreach March 2026" />
        </div>
        <div style={s.grid}>
          <div>
            <label style={s.label}>Daily send limit</label>
            <input style={s.input} type="number" value={form.daily_limit} onChange={e=>update("daily_limit", e.target.value)} />
          </div>
          <div>
            <label style={s.label}>Delay between emails (seconds)</label>
            <input style={s.input} type="number" value={form.delay_seconds} onChange={e=>update("delay_seconds", e.target.value)} />
          </div>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.secLbl}>Sender configuration</div>
        <div style={s.grid}>
          <div>
            <label style={s.label}>Sender name</label>
            <input style={s.input} value={form.sender_name} onChange={e=>update("sender_name", e.target.value)} placeholder="Roshaan Ali" />
          </div>
          <div>
            <label style={s.label}>Sender email</label>
            <input style={s.input} value={form.sender_email} onChange={e=>update("sender_email", e.target.value)} placeholder="you@gmail.com" />
          </div>
        </div>
        <div style={s.hint}>Ensure this email matches your connected Gmail account.</div>
      </div>

      <div style={s.card}>
        <div style={s.secLbl}>Email template</div>
        <div style={{ marginBottom:12 }}>
          <label style={s.label}>Subject line</label>
          <input style={s.input} value={form.subject} onChange={e=>update("subject", e.target.value)} />
          <div style={s.hint}>Use {"{name}"} and {"{company}"} for personalization</div>
        </div>
        <div>
          <label style={s.label}>Email body</label>
          <textarea style={s.textarea} value={form.body} onChange={e=>update("body", e.target.value)} />
        </div>
      </div>

      <div style={s.card}>
        <div style={s.secLbl}>Contacts CSV</div>
        <label style={s.upload}>
          <input type="file" accept=".csv" onChange={handleFile} style={{ display:"none" }} />
          {file ? `✓ ${file.name} selected` : "Click to upload contacts.csv"}
        </label>
        <div style={s.hint}>CSV must have columns: name, email, company</div>
      </div>

      {error && <div style={s.err}>{error}</div>}

      <button style={s.btn} onClick={startCampaign} disabled={loading || !gmailConnected}>
        {loading ? "Starting..." : "Start campaign →"}
      </button>
      {campaignId && status?.status === "running" && (
        <button style={s.cbtn} onClick={cancelCampaign}>Cancel</button>
      )}

      {status && (
        <div style={s.progress}>
          <div style={{ fontSize:14, fontWeight:600, color:"#f0f0f0", marginBottom:4 }}>
            {status.status === "completed" ? "Campaign complete!" : status.status === "running" ? "Sending..." : status.status}
          </div>
          <div style={s.bar}><div style={{ ...s.fill, width:`${pct}%` }} /></div>
          <div style={s.stat}>
            <div style={s.statItem}>Sent <span style={s.statNum}>{status.sent}</span></div>
            <div style={s.statItem}>Failed <span style={s.statNum}>{status.failed}</span></div>
            <div style={s.statItem}>Total <span style={s.statNum}>{status.total}</span></div>
            <div style={s.statItem}>Progress <span style={s.statNum}>{pct}%</span></div>
          </div>
          {status.status === "completed" && (
            <div style={{ ...s.success, marginTop:12 }}>
              All done! Check your Google Sheet for the full log.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
