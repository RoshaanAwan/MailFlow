import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../App";
import { onAuthStateChanged } from "firebase/auth";
import "./Landing.css";

const Icons = {
  Logo: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent-blue)" }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
  ),
  ArrowRight: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>,
  Zap: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>,
  Shield: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>,
  Layers: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 17 22 12"></polyline></svg>,
  CheckCircle: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
  Code: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
};

export default function Landing() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return unsub;
  }, []);

  const handleGetStarted = () => {
    if (user) {
      navigate("/dashboard");
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="landing-logo">
          <Icons.Logo />
          <span>MailFlow</span>
        </div>
        <div className="landing-nav-links">
          <a href="#features">Platform</a>
          <a href="#about">Features</a>
          <Link to={user ? "/dashboard" : "/login"} className="nav-login-btn">
            {user ? "Dashboard" : "Login"}
          </Link>
        </div>
      </nav>

      <header className="hero-section">
        <div className="hero-glow-1"></div>
        <div className="hero-glow-2"></div>
        
        <div className="hero-content">
          <div className="hero-badge">MailFlow Enterprise 2.0 is Live</div>
          <h1 className="hero-title">
            Outreach Infrastructure for <span className="text-gradient">Modern Startups</span>
          </h1>
          <p className="hero-subtitle">
            Connect your Gmail ecosystem, deploy automated pipelines, and scale your audience ingestion without the dev overhead. Engineered for reliability.
          </p>
          <div className="hero-buttons">
            <button className="btn-primary-glow" onClick={handleGetStarted}>
              {user ? "Return to Workspace" : "Start Building for Free"} <Icons.ArrowRight />
            </button>
          </div>
        </div>

        <div className="hero-graphic">
          <div className="abstract-dashboard">
             <div className="abs-card main-dash">
               <div className="abs-header">
                 <div className="mock-dots"><span className="dotr"></span><span className="doty"></span><span className="dotg"></span></div>
                 <div className="mock-title">Dashboard Overview</div>
               </div>
               <div className="abs-body">
                  <div className="abs-metric">
                    <span>Active Deliveries</span>
                    <h2>45,201</h2>
                  </div>
                  <div className="abs-chart">
                    <div className="bar b1"></div>
                    <div className="bar b2"></div>
                    <div className="bar b3"></div>
                    <div className="bar b4"></div>
                    <div className="bar b5"></div>
                    <div className="bar b6"></div>
                    <div className="bar b7"></div>
                  </div>
               </div>
             </div>

             <div className="abs-card float-1">
               <div className="fc-icon"><Icons.CheckCircle /></div>
               <div className="fc-text">
                 <strong>Campaign Synced</strong>
                 <span>Q3_Audience.csv mapped</span>
               </div>
             </div>

             <div className="abs-card float-2">
               <div className="status-indicator">
                 <div className="pulse-dot"></div> Live Routing
               </div>
               <div className="abs-progress-bar"><div className="abs-progress-fill"></div></div>
             </div>
          </div>
        </div>
      </header>

      <section id="features" className="features-section">
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon"><Icons.Zap /></div>
            <h3>High-Performance Routing</h3>
            <p>Bypass legacy limits. Send mass customized campaigns safely with intelligent batching algorithms and strict rate-limit guardrails ensuring 99.9% delivery rates.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><Icons.Layers /></div>
            <h3>Dynamic Parsing</h3>
            <p>Liquid syntax support for uploading massive lists. Inject unique payload data dynamically across millions of customized emails instantly.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><Icons.Shield /></div>
            <h3>Military-Grade OAuth2</h3>
            <p>Direct integration with Google APIs. Your data stays completely isolated and securely compliant with modern enterprise standards.</p>
          </div>
        </div>
      </section>
      
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="landing-logo grayscale"><Icons.Logo /> <span>MailFlow</span></div>
          <div className="footer-links">
            <Link to="/privacy">Privacy Protocol</Link>
            <Link to="/terms">Terms of Operation</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
