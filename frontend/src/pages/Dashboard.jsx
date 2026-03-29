import { useState, useEffect, useMemo } from "react";
import { auth } from "../App";
import "./Dashboard.css";

const API = import.meta.env.VITE_API_URL || "/api";

/* --- Professional SVG Icons --- */
const Icons = {
  Campaigns: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"/><polyline points="14 2 14 8 20 8"/><path d="M2 15h10"/><path d="m9 18 3-3-3-3"/></svg>
  ),
  Sent: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
  ),
  Failed: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
  ),
  Active: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
  ),
  Empty: () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  )
};

const StatCard = ({ icon, value, label, type, i }) => (
  <div className="stat-card" data-type={type} style={{ animationDelay: `${i * 0.05}s` }}>
    <div className="stat-header">
      <div className="icon-wrapper">
        {icon}
      </div>
      <div className="stat-label">{label}</div>
    </div>
    <div className="stat-content">
      <div className="stat-value">{value}</div>
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const config = {
    running:   { label: "Running Now", class: "tag-running" },
    completed: { label: "Completed",   class: "tag-completed" },
    error:     { label: "Check Errors", class: "tag-error" }
  };
  const { label, class: cls } = config[status] || { label: status, class: "" };
  return (
    <span className={`status-tag ${cls}`}>
      <span className="dot" />
      {label}
    </span>
  );
};

export default function Dashboard({ user }) {
  const [campaigns, setCampaigns] = useState({});
  const [loading, setLoading]     = useState(true);

  const fetchCampaigns = async () => {
    try {
      const token = await auth.currentUser.getIdToken();
      const res   = await fetch(`${API}/campaigns`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setCampaigns(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 5000);
    return () => clearInterval(interval);
  }, []);

  const list = useMemo(() => Object.entries(campaigns), [campaigns]);
  
  const stats = useMemo(() => {
    return {
      total:  list.length,
      sent:   list.reduce((a, [, v]) => a + (v.sent   || 0), 0),
      failed: list.reduce((a, [, v]) => a + (v.failed || 0), 0),
      active: list.filter(([, v]) => v.status === "running").length
    };
  }, [list]);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="dashboard-title-group">
          <h1 className="dashboard-title">System Overview</h1>
          <p className="dashboard-subtitle">Monitoring your automated email workflows</p>
        </div>
      </header>

      <div className="stats-grid">
        <StatCard 
          type="total"
          icon={<Icons.Campaigns />} 
          value={stats.total} 
          label="Total Campaigns" 
          i={0} 
        />
        <StatCard 
          type="sent"
          icon={<Icons.Sent />} 
          value={stats.sent.toLocaleString()} 
          label="Emails Delivered" 
          i={1} 
        />
        <StatCard 
          type="failed"
          icon={<Icons.Failed />} 
          value={stats.failed.toLocaleString()} 
          label="Failed Delivery" 
          i={2} 
        />
        <StatCard 
          type="active"
          icon={<Icons.Active />} 
          value={stats.active} 
          label="Active Tasks" 
          i={3} 
        />
      </div>

      <div className="section-container">
        <div className="section-header">
          <h2 className="section-title">Campaign Performance</h2>
        </div>
        
        {loading ? (
          <div className="empty-placeholder">
            <div className="loader"></div>
            <p className="empty-text">Retrieving real-time data...</p>
          </div>
        ) : list.length === 0 ? (
          <div className="empty-placeholder">
            <Icons.Empty />
            <p className="empty-text">No campaign data found in your account.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="campaigns-table">
              <thead>
                <tr>
                  <th>Job Identifer</th>
                  <th>Execution Status</th>
                  <th>Delivered</th>
                  <th>Failed</th>
                  <th>Total Packets</th>
                </tr>
              </thead>
              <tbody>
                {list.slice().reverse().map(([id, c]) => (
                  <tr key={id} className="campaign-row">
                    <td>
                      <div className="campaign-name-cell">
                        <span className="campaign-indicator" />
                        <code>#{id.split("_").slice(1).join("_") || id}</code>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td>{c.sent   || 0}</td>
                    <td>{c.failed || 0}</td>
                    <td>{c.total  || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


