import { useState } from "react";
import { Link } from "react-router-dom";
import { auth } from "../App";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import "./Login.css";

/* --- Professional SVG Icons --- */
const Icons = {
  Logo: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent-blue)" }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
  ),
  Connect: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v8"/><path d="m16 6-4 4-4-4"/><rect x="2" y="10" width="20" height="12" rx="2"/><path d="M6 14h.01"/><path d="M10 14h.01"/></svg>
  ),
  Dataset: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
  ),
  Automate: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h5v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z"/></svg>
  ),
  Google: () => (
    <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c3.11 0 5.72-1.03 7.63-2.79l-3.57-2.77c-.99.66-2.26 1.05-4.06 1.05-3.11 0-5.75-2.11-6.7-4.94H1.14v2.86C3.06 20.21 7.22 23 12 23z" fill="#34A853"/><path d="M5.3 13.59c-.24-.71-.38-1.47-.38-2.26 0-.79.14-1.55.38-2.26V6.21H1.14C.41 7.64 0 9.26 0 11c0 1.74.41 3.36 1.14 4.79l4.16-3.2z" fill="#FBBC05"/><path d="M12 4.19c1.69 0 3.2.58 4.39 1.72l3.3-3.3C17.71 1.03 15.11 0 12 0 7.22 0 3.06 2.79 1.14 6.21L5.3 9.07c.95-2.83 3.59-4.88 6.7-4.88z" fill="#EA4335"/></svg>
  )
};

export default function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return setError("Required fields: Identity & Access Code.");
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
      setError("Authorization Guard Failed: " + e.message);
    }
  };

  return (
    <div className="login-page">
      {/* --- Left Side: System Flow --- */}
      <aside className="onboarding-side">
        <div className="onboarding-content">
          <div className="onboarding-logo">
            <Icons.Logo />
            <span>MailFlow</span>
          </div>
          <h1 className="onboarding-title">
            The automated <span>Email Pipeline</span> for modern startups.
          </h1>
          
          <div className="flow-steps">
            <div className="flow-step" style={{ animationDelay: "0.4s" }}>
              <div className="step-icon"><Icons.Connect /></div>
              <div className="step-text">
                <h3>Bridge Authorization</h3>
                <p>Securely connect your Gmail API with our production routing system.</p>
              </div>
            </div>
            <div className="flow-step" style={{ animationDelay: "0.5s" }}>
              <div className="step-icon"><Icons.Dataset /></div>
              <div className="step-text">
                <h3>Audience Ingestion</h3>
                <p>Upload CSV datasets and map dynamic variables for mass personalization.</p>
              </div>
            </div>
            <div className="flow-step" style={{ animationDelay: "0.6s" }}>
              <div className="step-icon"><Icons.Automate /></div>
              <div className="step-text">
                <h3>Campaign Deployment</h3>
                <p>Execute verified payloads with real-time performance analytics.</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* --- Right Side: Auth Form --- */}
      <main className="auth-side">
        <div className="auth-blob auth-blob-1"></div>
        <div className="auth-blob auth-blob-2"></div>

        <div className="auth-card">
          <div className="mobile-logo-header">
            <Icons.Logo />
            <span>MailFlow</span>
          </div>
          <div className="auth-header">
            <h2 className="auth-title">{isSignup ? "Create Identity" : "Verified Access"}</h2>
            <p className="auth-subtitle">
              {isSignup ? "Join the high-performance pipeline." : "Resume your automated workflows."}
            </p>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ animationDelay: "0.1s" }}>
              <span className="input-label">System Identity (Email)</span>
              <input 
                className="auth-input" 
                type="email" 
                value={email} 
                onChange={e=>setEmail(e.target.value)} 
                placeholder="identity@example.com" 
              />
            </div>
            <div className="form-group" style={{ animationDelay: "0.15s" }}>
              <span className="input-label">Access Code (Password)</span>
              <input 
                className="auth-input" 
                type="password" 
                value={password} 
                onChange={e=>setPassword(e.target.value)} 
                placeholder="••••••••" 
              />
            </div>
            <button className="btn-auth" type="submit" disabled={loading} style={{ animationDelay: "0.2s" }}>
              {loading ? "Verifying..." : isSignup ? "Initialize Profile" : "Grant Access"}
            </button>
          </form>

          <button className="btn-google" onClick={handleGoogle} style={{ animationDelay: "0.25s" }}>
            <Icons.Google /> Continue via Google Service
          </button>

          <footer className="auth-footer" style={{ animationDelay: "0.3s" }}>
            {isSignup ? "Already registered?" : "New to the pipeline?"}
            <span className="auth-link" onClick={()=>setIsSignup(!isSignup)}>
              {isSignup ? "Sign in" : "Initialize profile"}
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}

