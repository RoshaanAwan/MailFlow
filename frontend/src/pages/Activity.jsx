import { useState, useEffect } from "react";
import { auth } from "../App";
import "./Activity.css";

const API = import.meta.env.VITE_API_URL || "/api";

export default function Activity() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const token = await auth.currentUser.getIdToken();
      const res   = await fetch(`${API}/v1/logs?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setLogs(data);
    } catch (e) {
      console.error("Failed to load activity", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="activity-container">
      <header className="activity-header">
        <h1 className="activity-title">Email Activity</h1>
        <p className="activity-subtitle">Every email sent through your API, newest first.</p>
      </header>

      {loading ? (
        <div className="activity-empty">Loading activity…</div>
      ) : logs.length === 0 ? (
        <div className="activity-empty">
          No emails sent yet. Use an API key to call <code>/v1/mail/send</code>.
        </div>
      ) : (
        <div className="activity-table-wrap">
          <table className="activity-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>To</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td className="cell-time">
                    {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                  </td>
                  <td>{log.to}</td>
                  <td className="cell-subject" title={log.subject}>{log.subject || "—"}</td>
                  <td>
                    <span className={`status-pill ${log.status === "sent" ? "ok" : "fail"}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="cell-detail" title={log.error || log.message_id || ""}>
                    {log.status === "failed" ? (log.error || "Failed") : (log.message_id || "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
