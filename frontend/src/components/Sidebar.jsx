import { Link, useLocation } from "react-router-dom";
import { auth } from "../App";
import { signOut } from "firebase/auth";

const s = {
  sidebar: { width:220, background:"#141414", borderRight:"0.5px solid #1f1f1f", padding:"1.5rem 1rem", display:"flex", flexDirection:"column", gap:4, minHeight:"100vh" },
  logo:    { fontSize:20, fontWeight:700, color:"#f0f0f0", marginBottom:24, paddingLeft:8, letterSpacing:"-0.5px", textDecoration:"none" },
  item:    { padding:"9px 12px", borderRadius:8, fontSize:14, cursor:"pointer", color:"#888", fontWeight:500, transition:"all 0.15s", textDecoration:"none", display:"block" },
  active:  { background:"#1f1f1f", color:"#f0f0f0" },
  bottom:  { marginTop:"auto" },
  user:    { fontSize:12, color:"#555", padding:"8px 12px", marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  signout: { padding:"9px 12px", borderRadius:8, fontSize:14, cursor:"pointer", color:"#555", fontWeight:500 },
};

const navItems = [
  { path:"/",             label:"Dashboard",    icon:"▦" },
  { path:"/new-campaign", label:"New campaign",  icon:"+" },
  { path:"/settings",     label:"Settings",      icon:"⚙" },
];

export default function Sidebar({ user }) {
  const location = useLocation();

  return (
    <div style={s.sidebar}>
      <Link to="/" style={s.logo}>✉ MailFlow</Link>
      {navItems.map(item => (
        <Link
          key={item.path}
          to={item.path}
          style={{ ...s.item, ...(location.pathname === item.path ? s.active : {}) }}
        >
          <span style={{ marginRight:8, fontSize:12 }}>{item.icon}</span>
          {item.label}
        </Link>
      ))}
      <div style={s.bottom}>
        <div style={{ padding: "8px 12px", display: "flex", gap: "8px", fontSize: "11px", color: "#444" }}>
          <Link to="/privacy" style={{ color: "inherit", textDecoration: "none", cursor: "pointer" }}>Privacy</Link>
          <span>•</span>
          <Link to="/terms" style={{ color: "inherit", textDecoration: "none", cursor: "pointer" }}>Terms</Link>
        </div>
        <div style={s.user}>{user.email}</div>
        <div style={s.signout} onClick={() => signOut(auth)}>Sign out</div>
      </div>
    </div>
  );
}
