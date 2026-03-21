import { auth } from "../App";
import { signOut } from "firebase/auth";

const s = {
  sidebar: { width:220, background:"#141414", borderRight:"0.5px solid #1f1f1f", padding:"1.5rem 1rem", display:"flex", flexDirection:"column", gap:4, minHeight:"100vh" },
  logo:    { fontSize:20, fontWeight:700, color:"#f0f0f0", marginBottom:24, paddingLeft:8, letterSpacing:"-0.5px" },
  item:    { padding:"9px 12px", borderRadius:8, fontSize:14, cursor:"pointer", color:"#888", fontWeight:500, transition:"all 0.15s" },
  active:  { background:"#1f1f1f", color:"#f0f0f0" },
  bottom:  { marginTop:"auto" },
  user:    { fontSize:12, color:"#555", padding:"8px 12px", marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  signout: { padding:"9px 12px", borderRadius:8, fontSize:14, cursor:"pointer", color:"#555", fontWeight:500 },
};

const navItems = [
  { id:"dashboard",    label:"Dashboard",     icon:"▦" },
  { id:"new-campaign", label:"New campaign",  icon:"+" },
  { id:"settings",     label:"Settings",      icon:"⚙" },
];

export default function Sidebar({ page, setPage, user }) {
  return (
    <div style={s.sidebar}>
      <div style={s.logo}>✉ MailFlow</div>
      {navItems.map(item => (
        <div
          key={item.id}
          style={{ ...s.item, ...(page === item.id ? s.active : {}) }}
          onClick={() => setPage(item.id)}
        >
          <span style={{ marginRight:8, fontSize:12 }}>{item.icon}</span>
          {item.label}
        </div>
      ))}
      <div style={s.bottom}>
        <div style={{ padding: "8px 12px", display: "flex", gap: "8px", fontSize: "11px", color: "#444" }}>
          <span style={{ cursor: "pointer" }} onClick={() => setPage("privacy")}>Privacy</span>
          <span>•</span>
          <span style={{ cursor: "pointer" }} onClick={() => setPage("terms")}>Terms</span>
        </div>
        <div style={s.user}>{user.email}</div>
        <div style={s.signout} onClick={() => signOut(auth)}>Sign out</div>
      </div>
    </div>
  );
}
