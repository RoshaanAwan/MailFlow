import { useState, useEffect } from "react";
import { auth } from "../App";

const API = "http://localhost:8000";

const s = {
  title:    { fontSize:24, fontWeight:700, color:"#f0f0f0", marginBottom:6, letterSpacing:"-0.5px" },
  sub:      { fontSize:14, color:"#555", marginBottom:32 },
  grid:     { display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))", gap:12, marginBottom:32 },
  statCard: { background:"#1a1a1a", border:"0.5px solid #1f1f1f", borderRadius:12, padding:"1.25rem" },
  statNum:  { fontSize:28, fontWeight:700, color:"#f0f0f0", margin:"0 0 4px" },
  statLbl:  { fontSize:12, color:"#555", margin:0, fontWeight:500 },
  section:  { marginBottom:24 },
  secTitle: { fontSize:14, fontWeight:600, color:"#888", marginBottom:12, textTransform:"uppercase", letterSpacing:"0.05em" },
  table:    { width:"100%", borderCollapse:"collapse" },
  th:       { fontSize:12, color:"#555", fontWeight:500, textAlign:"left", padding:"8px 12px", borderBottom:"0.5px solid #1f1f1f" },
  td:       { fontSize:13, color:"#ccc", padding:"10px 12px", borderBottom:"0.5px solid #141414" },
  badge:    { display:"inline-block", padding:"2px 8px", borderRadius:4, fontSize:11, fontWeight:500 },
  empty:    { fontSize:14, color:"#444", textAlign:"center", padding:"3rem 0" },
};

const statusColor = (s) => ({
  "completed": { background:"#0d2b1a", color:"#4ade80" },
  "running":   { background:"#1a2010", color:"#86efac" },
  "error":     { background:"#2b0d0d", color:"#f87171" },
}[s] || { background:"#1f1f1f", color:"#888" });

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

  const list   = Object.entries(campaigns);
  const total  = list.reduce((a, [,v]) => a + (v.total || 0), 0);
  const sent   = list.reduce((a, [,v]) => a + (v.sent  || 0), 0);
  const failed = list.reduce((a, [,v]) => a + (v.failed|| 0), 0);
  const active = list.filter(([,v]) => v.status === "running").length;

  return (
    <div>
      <div style={s.title}>Dashboard</div>
      <div style={s.sub}>Overview of all your email campaigns</div>

      <div style={s.grid}>
        {[
          { num: list.length, lbl: "Total campaigns" },
          { num: sent,        lbl: "Emails sent" },
          { num: failed,      lbl: "Failed" },
          { num: active,      lbl: "Running now" },
        ].map((c, i) => (
          <div key={i} style={s.statCard}>
            <p style={s.statNum}>{c.num}</p>
            <p style={s.statLbl}>{c.lbl}</p>
          </div>
        ))}
      </div>

      <div style={s.section}>
        <div style={s.secTitle}>Recent campaigns</div>
        {loading ? (
          <div style={s.empty}>Loading...</div>
        ) : list.length === 0 ? (
          <div style={s.empty}>No campaigns yet — start one!</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                {["Campaign ID", "Status", "Sent", "Failed", "Total"].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map(([id, c]) => (
                <tr key={id}>
                  <td style={s.td}>{id.split("_").slice(1).join("_")}</td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, ...statusColor(c.status) }}>
                      {c.status}
                    </span>
                  </td>
                  <td style={s.td}>{c.sent   || 0}</td>
                  <td style={s.td}>{c.failed || 0}</td>
                  <td style={s.td}>{c.total  || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
