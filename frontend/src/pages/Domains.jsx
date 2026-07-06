import { useState, useEffect } from "react";
import { auth } from "../App";
import "./Domains.css";

const API = import.meta.env.VITE_API_URL || "/api";

const Icons = {
  Globe: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
  ),
  Copy: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
  ),
};

const STATUS_LABEL = {
  verified: "Verified",
  pending: "Pending",
  not_started: "Not started",
  failed: "Failed",
  temporary_failure: "Retrying",
};

function Copyable({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <span className="copyable" onClick={copy} title="Copy">
      <code>{value}</code>
      <span className="copy-icn">{copied ? "✓" : <Icons.Copy />}</span>
    </span>
  );
}

export default function Domains() {
  const [domains, setDomains]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [newName, setNewName]   = useState("");
  const [adding, setAdding]     = useState(false);
  const [error, setError]       = useState("");
  const [expanded, setExpanded] = useState(null);
  const [verifyingId, setVerifyingId] = useState(null);

  const authHeader = async () => ({ Authorization: `Bearer ${await auth.currentUser.getIdToken()}` });

  const fetchDomains = async () => {
    try {
      const res  = await fetch(`${API}/v1/domains`, { headers: await authHeader() });
      const data = await res.json();
      if (res.ok) setDomains(data);
    } catch (e) {
      console.error("Failed to load domains", e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchDomains(); }, []);

  const addDomain = async () => {
    if (!newName.trim()) return;
    setAdding(true); setError("");
    try {
      const res  = await fetch(`${API}/v1/domains`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body:    JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewName("");
        setExpanded(data.id);   // open DNS records immediately
        fetchDomains();
      } else {
        setError(data.detail || "Failed to add domain");
      }
    } catch (e) {
      setError("Network error: " + e.message);
    }
    setAdding(false);
  };

  const verifyDomain = async (id) => {
    setVerifyingId(id);
    try {
      const res = await fetch(`${API}/v1/domains/${id}/verify`, {
        method: "POST", headers: await authHeader(),
      });
      const data = await res.json();
      if (res.ok) {
        setDomains(ds => ds.map(d => d.id === id ? data : d));
      }
    } catch (e) {
      console.error("Verify failed", e);
    }
    setVerifyingId(null);
  };

  const deleteDomain = async (id) => {
    if (!window.confirm("Remove this domain? Sending from it will stop working.")) return;
    try {
      await fetch(`${API}/v1/domains/${id}`, { method: "DELETE", headers: await authHeader() });
      fetchDomains();
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  return (
    <div className="domains-container">
      <header className="domains-header">
        <h1 className="domains-title">Sending Domains</h1>
        <p className="domains-subtitle">
          Verify a domain you own, then send email from any address on it (e.g. hi@yourdomain.com).
        </p>
      </header>

      {/* Add */}
      <section className="domains-card">
        <div className="card-head">
          <span className="card-icon"><Icons.Globe /></span>
          <span className="card-label">Add a domain</span>
        </div>
        <div className="add-row">
          <input
            className="domain-input"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addDomain()}
            placeholder="yourdomain.com"
          />
          <button className="btn-add" onClick={addDomain} disabled={adding}>
            {adding ? "Adding…" : "Add Domain"}
          </button>
        </div>
        {error && <div className="msg-err">{error}</div>}
      </section>

      {/* List */}
      <section className="domains-card">
        <div className="card-head"><span className="card-label">Your domains</span></div>
        {loading ? (
          <div className="domains-empty">Loading…</div>
        ) : domains.length === 0 ? (
          <div className="domains-empty">No domains yet. Add one above to start sending from your own address.</div>
        ) : (
          <div className="domain-list">
            {domains.map(d => (
              <div key={d.id} className="domain-item">
                <div className="domain-row">
                  <div className="domain-meta">
                    <span className="domain-name">{d.name}</span>
                    <span className={`domain-status status-${d.status}`}>
                      {STATUS_LABEL[d.status] || d.status}
                    </span>
                  </div>
                  <div className="domain-actions">
                    {!d.verified && (
                      <button className="btn-sm" onClick={() => verifyDomain(d.id)} disabled={verifyingId === d.id}>
                        {verifyingId === d.id ? "Checking…" : "Verify"}
                      </button>
                    )}
                    <button className="btn-sm" onClick={() => setExpanded(expanded === d.id ? null : d.id)}>
                      {expanded === d.id ? "Hide DNS" : "DNS records"}
                    </button>
                    <button className="btn-sm btn-danger" onClick={() => deleteDomain(d.id)}>Remove</button>
                  </div>
                </div>

                {expanded === d.id && (
                  <div className="dns-records">
                    {d.verified ? (
                      <div className="dns-verified">✓ This domain is verified — you can send from it.</div>
                    ) : (
                      <p className="dns-help">
                        Add these records at your DNS provider, then click <strong>Verify</strong>.
                        Changes can take a few minutes to propagate.
                      </p>
                    )}
                    {(d.records || []).length === 0 ? (
                      <div className="dns-help">No records returned.</div>
                    ) : (
                      <table className="dns-table">
                        <thead>
                          <tr><th>Type</th><th>Name</th><th>Value</th><th>Priority</th></tr>
                        </thead>
                        <tbody>
                          {d.records.map((r, i) => (
                            <tr key={i}>
                              <td>{r.type}</td>
                              <td><Copyable value={r.name} /></td>
                              <td className="dns-value"><Copyable value={r.value} /></td>
                              <td>{r.priority ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
