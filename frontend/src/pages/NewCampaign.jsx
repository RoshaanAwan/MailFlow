import { useState, useEffect, useRef, useMemo } from "react";
import { auth } from "../App";
import "./NewCampaign.css";

const API = import.meta.env.VITE_API_URL || "/api";

/* --- Professional SVG Icons --- */
const Icons = {
  Details: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
  ),
  Sender: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  ),
  Template: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
  ),
  Upload: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="upload-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
  ),
  Warn: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  )
};

export default function NewCampaign({ user, setPage }) {
  const [form, setForm] = useState({
    campaign_name: "",
    subject:       "Quick idea for {company}",
    body:          `Hi {name},\n\nI build web apps and APIs for startups — recently helped a similar company cut their dev costs by 40% while shipping faster.\n\nHad a quick idea for {company} that might be worth 10 minutes of your time.\n\nWorth a chat?\n\nRoshaan Ali\nFull Stack Engineer\n+92 302 4917779\n\n---\nTo unsubscribe, reply with "unsubscribe".`,
    sender_name:   "",
    sender_email:  "",
    delay_seconds: 10,
    daily_limit:   20,
    sheet_name:    "Email Campaign Log",
  });
  
  const [file, setFile]             = useState(null);
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
    if (!gmailConnected)    return setError("Authorization required. Please connect Gmail in settings.");
    if (!file)              return setError("Required: Contacts dataset (CSV).");
    if (!form.campaign_name) return setError("Required: Unique campaign identifier.");
    if (!form.sender_email) return setError("Required: Verified sender email address.");

    setLoading(true); setError("");

    try {
      const token   = await auth.currentUser.getIdToken();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("campaign_name", form.campaign_name);
      formData.append("subject",       form.subject);
      formData.append("body",          form.body);
      formData.append("sender_name",   form.sender_name);
      formData.append("sender_email",  form.sender_email);
      formData.append("delay_seconds", form.delay_seconds);
      formData.append("daily_limit",   form.daily_limit);
      formData.append("sheet_name",    form.sheet_name);

      const res  = await fetch(`${API}/campaign/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Workflow execution failed.");

      setCampaignId(data.campaign_id);
      pollStatus(data.campaign_id, token);

    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const pollInterval = useRef(null);

  const pollStatus = (id, token) => {
    if (pollInterval.current) clearInterval(pollInterval.current);

    pollInterval.current = setInterval(async () => {
      try {
        const res  = await fetch(`${API}/campaign/${id}/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setStatus(data);
        if (data.status === "completed" || data.status?.startsWith("error")) {
          clearInterval(pollInterval.current);
          pollInterval.current = null;
        }
      } catch (e) {
        clearInterval(pollInterval.current);
        pollInterval.current = null;
      }
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, []);

  const cancelCampaign = async () => {
    if (!campaignId) return;
    const token = await auth.currentUser.getIdToken();
    await fetch(`${API}/campaign/${campaignId}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
  };

  const pct = useMemo(() => {
    if (!status) return 0;
    return Math.round((status.sent / Math.max(status.total, 1)) * 100);
  }, [status]);

  return (
    <div className="campaign-container">
      <header className="campaign-header">
        <h1 className="campaign-title">New Campaign</h1>
        <p className="campaign-subtitle">Build and deploy a personalized email automation workflow.</p>
      </header>

      {!gmailConnected && (
        <div className="warn-alert">
          <Icons.Warn />
          <div>
            <strong>Gmail authorization required.</strong> 
            <span style={{ marginLeft: 8, cursor:"pointer", textDecoration:"underline" }} onClick={()=>setPage("settings")}>
              Configure service connection →
            </span>
          </div>
        </div>
      )}

      {/* --- Step 1: Configuration --- */}
      <section className="form-section">
        <div className="section-head">
          <span className="section-icon"><Icons.Details /></span>
          <span className="section-label">Campaign Identity</span>
        </div>
        <div className="form-grid">
          <div className="form-group form-group-full">
            <label className="field-label">Identifier / Name</label>
            <input 
              className="input-field" 
              value={form.campaign_name} 
              onChange={e=>update("campaign_name", e.target.value)} 
              placeholder="e.g. Q1_Startup_Outreach_2026" 
            />
          </div>
          <div className="form-group">
            <label className="field-label">Daily Send Limit</label>
            <input 
              className="input-field" 
              type="number" 
              value={form.daily_limit} 
              onChange={e=>update("daily_limit", e.target.value)} 
            />
          </div>
          <div className="form-group">
            <label className="field-label">Interval (Seconds)</label>
            <input 
              className="input-field" 
              type="number" 
              value={form.delay_seconds} 
              onChange={e=>update("delay_seconds", e.target.value)} 
            />
          </div>
        </div>
      </section>

      {/* --- Step 2: Sender --- */}
      <section className="form-section">
        <div className="section-head">
          <span className="section-icon"><Icons.Sender /></span>
          <span className="section-label">Sender Verification</span>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="field-label">Friendly Name</label>
            <input 
              className="input-field" 
              value={form.sender_name} 
              onChange={e=>update("sender_name", e.target.value)} 
              placeholder="Roshaan Ali" 
            />
          </div>
          <div className="form-group">
            <label className="field-label">Sender Address</label>
            <input 
              className="input-field" 
              value={form.sender_email} 
              onChange={e=>update("sender_email", e.target.value)} 
              placeholder="verified@domain.com" 
            />
          </div>
        </div>
        <p className="field-hint">Address must be authorized via the connected Gmail security token.</p>
      </section>

      {/* --- Step 3: Template --- */}
      <section className="form-section">
        <div className="section-head">
          <span className="section-icon"><Icons.Template /></span>
          <span className="section-label">Payload Template</span>
        </div>
        <div className="form-group" style={{ marginBottom: "1.5rem" }}>
          <label className="field-label">Subject Vector</label>
          <input 
            className="input-field" 
            value={form.subject} 
            onChange={e=>update("subject", e.target.value)} 
          />
        </div>
        <div className="form-group">
          <label className="field-label">Email Payload (Markdown / Plain)</label>
          <textarea 
            className="input-field textarea-field" 
            value={form.body} 
            onChange={e=>update("body", e.target.value)} 
          />
          <p className="field-hint">Dynamic markers: {"{name}"}, {"{company}"}, {"{industry}"}</p>
        </div>
      </section>

      {/* --- Step 4: Audience --- */}
      <section className="form-section">
        <div className="section-head">
          <span className="section-icon"><Icons.Details /></span>
          <span className="section-label">Dataset Ingestion</span>
        </div>
        <label className="upload-area">
          <input type="file" accept=".csv" onChange={handleFile} style={{ display:"none" }} />
          <Icons.Upload />
          <span className="upload-text">
            {file ? `✓ ${file.name}` : "Drop contacts.csv or click to browser"}
          </span>
          <p className="field-hint">Headers required: name, email, company</p>
        </label>
      </section>

      {error && <div className="error-alert">Error: {error}</div>}

      <div className="action-bar">
        <button 
          className="btn-primary" 
          onClick={startCampaign} 
          disabled={loading || !gmailConnected}
        >
          {loading ? "Deploying..." : "Launch Campaign"}
          {!loading && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>}
        </button>
        {campaignId && status?.status === "running" && (
          <button className="btn-outline-error" onClick={cancelCampaign}>Terminate</button>
        )}
      </div>

      {status && (
        <div className="execution-progress">
          <div className="progress-header">
            <div className="progress-status">
              {status.status === "completed" ? "All tasks successfully completed" : 
               status.status === "running" ? "Transmitting payloads..." : 
               `Status: ${status.status}`}
            </div>
            <div className="p-stat-val">{pct}%</div>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="prog-stats">
            <div className="p-stat-item">
              <span className="p-stat-lbl">Sent</span>
              <span className="p-stat-val">{status.sent}</span>
            </div>
            <div className="p-stat-item">
              <span className="p-stat-lbl">Fail</span>
              <span className="p-stat-val" style={{ color: status.failed > 0 ? "var(--accent-error)" : "inherit" }}>
                {status.failed}
              </span>
            </div>
            <div className="p-stat-item">
              <span className="p-stat-lbl">Total</span>
              <span className="p-stat-val">{status.total}</span>
            </div>
            <div className="p-stat-item">
              <span className="p-stat-lbl">Avg Delay</span>
              <span className="p-stat-val">{form.delay_seconds}s</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

