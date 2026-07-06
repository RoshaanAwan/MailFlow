import { useState, useEffect } from "react";
import { auth } from "../App";
import "./ApiKeys.css";

const API = import.meta.env.VITE_API_URL || "/api";

const Icons = {
  Key: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
  ),
  Copy: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
  ),
};

export default function ApiKeys() {
  const [keys, setKeys]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [newName, setNewName]     = useState("");
  const [creating, setCreating]   = useState(false);
  const [freshKey, setFreshKey]   = useState(null); // raw key shown once
  const [copied, setCopied]       = useState(false);
  const [error, setError]         = useState("");

  const authHeader = async () => ({
    Authorization: `Bearer ${await auth.currentUser.getIdToken()}`,
  });

  const fetchKeys = async () => {
    try {
      const res  = await fetch(`${API}/v1/keys`, { headers: await authHeader() });
      const data = await res.json();
      if (res.ok) setKeys(data);
    } catch (e) {
      console.error("Failed to load API keys", e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchKeys(); }, []);

  const createKey = async () => {
    setCreating(true); setError(""); setFreshKey(null);
    try {
      const res  = await fetch(`${API}/v1/keys`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body:    JSON.stringify({ name: newName || "API Key" }),
      });
      const data = await res.json();
      if (res.ok) {
        setFreshKey(data.key);
        setNewName("");
        fetchKeys();
      } else {
        setError(data.detail || "Failed to create key");
      }
    } catch (e) {
      setError("Network error: " + e.message);
    }
    setCreating(false);
  };

  const revokeKey = async (id) => {
    if (!window.confirm("Revoke this key? Any system using it will stop working immediately.")) return;
    try {
      const res = await fetch(`${API}/v1/keys/${id}`, {
        method:  "DELETE",
        headers: await authHeader(),
      });
      if (res.ok) fetchKeys();
    } catch (e) {
      console.error("Revoke failed", e);
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(freshKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="apikeys-container">
      <header className="apikeys-header">
        <h1 className="apikeys-title">API Keys</h1>
        <p className="apikeys-subtitle">
          Create a key and send email programmatically from your own systems.
        </p>
      </header>

      {/* Create */}
      <section className="apikeys-card">
        <div className="card-head">
          <span className="card-icon"><Icons.Key /></span>
          <span className="card-label">Create a new key</span>
        </div>
        <div className="create-row">
          <input
            className="key-input"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Key name (e.g. Production server)"
          />
          <button className="btn-create" onClick={createKey} disabled={creating}>
            {creating ? "Creating..." : "Create Key"}
          </button>
        </div>
        {error && <div className="msg-err">{error}</div>}

        {freshKey && (
          <div className="fresh-key">
            <div className="fresh-key-warn">
              ⚠ Copy this key now — for security it won't be shown again.
            </div>
            <div className="fresh-key-row">
              <code className="fresh-key-value">{freshKey}</code>
              <button className="btn-copy" onClick={copyKey}>
                <Icons.Copy /> {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* List */}
      <section className="apikeys-card">
        <div className="card-head">
          <span className="card-label">Your keys</span>
        </div>
        {loading ? (
          <div className="loading-state">Loading keys...</div>
        ) : keys.length === 0 ? (
          <div className="empty-keys">No API keys yet. Create one above to get started.</div>
        ) : (
          <div className="key-list">
            {keys.map(k => (
              <div key={k.id} className={`key-item ${k.revoked ? "revoked" : ""}`}>
                <div className="key-meta">
                  <span className="key-name">{k.name}</span>
                  <code className="key-prefix">{k.prefix}…</code>
                  <span className="key-dates">
                    Created {k.created_at ? new Date(k.created_at).toLocaleDateString() : "—"}
                    {k.last_used_at ? ` · Last used ${new Date(k.last_used_at).toLocaleString()}` : " · Never used"}
                  </span>
                </div>
                {k.revoked ? (
                  <span className="key-revoked-tag">Revoked</span>
                ) : (
                  <button className="btn-revoke" onClick={() => revokeKey(k.id)}>Revoke</button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Usage example */}
      <section className="apikeys-card">
        <div className="card-head">
          <span className="card-label">Send your first email</span>
        </div>
        <p className="apikeys-subtitle" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
          First verify a domain on the <strong>Domains</strong> page, then send from any
          address on it:
        </p>
        <pre className="code-block">{`curl -X POST ${API}/v1/mail/send \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "hi@yourdomain.com",
    "to": "recipient@example.com",
    "subject": "Hello from MailFlow",
    "html": "<h1>It works!</h1>"
  }'`}</pre>
      </section>
    </div>
  );
}
