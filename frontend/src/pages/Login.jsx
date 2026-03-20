import { useState } from "react";
import { auth } from "../App";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";

const s = {
  wrap:    { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0f0f0f", fontFamily:"'DM Sans', sans-serif" },
  card:    { background:"#1a1a1a", border:"0.5px solid #2a2a2a", borderRadius:16, padding:"2.5rem 2rem", width:"100%", maxWidth:400 },
  logo:    { fontSize:28, fontWeight:700, color:"#f0f0f0", marginBottom:8, letterSpacing:"-0.5px" },
  sub:     { fontSize:14, color:"#666", marginBottom:32 },
  label:   { fontSize:12, color:"#888", marginBottom:6, display:"block", fontWeight:500 },
  input:   { width:"100%", background:"#111", border:"0.5px solid #2a2a2a", borderRadius:8, padding:"10px 12px", color:"#f0f0f0", fontSize:14, marginBottom:16, boxSizing:"border-box", outline:"none" },
  btn:     { width:"100%", padding:"11px", background:"#f0f0f0", color:"#0f0f0f", border:"none", borderRadius:8, fontSize:14, fontWeight:600, cursor:"pointer", marginBottom:12 },
  gbtn:    { width:"100%", padding:"11px", background:"transparent", color:"#f0f0f0", border:"0.5px solid #2a2a2a", borderRadius:8, fontSize:14, fontWeight:500, cursor:"pointer", marginBottom:16 },
  toggle:  { fontSize:13, color:"#666", textAlign:"center", marginTop:8 },
  tlink:   { color:"#f0f0f0", cursor:"pointer", textDecoration:"underline" },
  err:     { fontSize:13, color:"#ff6b6b", marginBottom:12, textAlign:"center" },
};

export default function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async () => {
    setLoading(true); setError("");
    try {
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e) {
      setError(e.message.replace("Firebase: ", "").replace(/\(.*\)/, ""));
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.logo}>✉ MailFlow</div>
        <div style={s.sub}>{isSignup ? "Create your account" : "Welcome back"}</div>
        {error && <div style={s.err}>{error}</div>}
        <label style={s.label}>Email</label>
        <input style={s.input} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" />
        <label style={s.label}>Password</label>
        <input style={s.input} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&handleSubmit()} />
        <button style={s.btn} onClick={handleSubmit} disabled={loading}>
          {loading ? "Please wait..." : isSignup ? "Create account" : "Sign in"}
        </button>
        <button style={s.gbtn} onClick={handleGoogle}>Continue with Google</button>
        <div style={s.toggle}>
          {isSignup ? "Already have an account? " : "Don't have an account? "}
          <span style={s.tlink} onClick={()=>setIsSignup(!isSignup)}>
            {isSignup ? "Sign in" : "Sign up"}
          </span>
        </div>
      </div>
    </div>
  );
}
