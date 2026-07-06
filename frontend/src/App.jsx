import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { auth, onAuthStateChanged, validateSession } from "./auth";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NewCampaign from "./pages/NewCampaign";
import ApiKeys from "./pages/ApiKeys";
import Domains from "./pages/Domains";
import Smtp from "./pages/Smtp";
import Activity from "./pages/Activity";
import Settings from "./pages/Settings";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import PrivacyPolicy from "./pages/PolicyNotice";
import TermsOfService from "./pages/TermsOfService";
import Sidebar from "./components/Sidebar";

// Re-export so existing pages that do `import { auth } from "../App"` keep working.
export { auth };

/* ── Main app shell (page-state navigation) ── */
function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to auth changes (fires immediately with the current session).
    const unsub = onAuthStateChanged((u) => setUser(u));
    // Validate any stored token against the backend (may clear an expired one).
    validateSession().finally(() => setLoading(false));
    return unsub;
  }, []);

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", fontFamily:"'DM Sans', sans-serif", color:"#888" }}>
      Loading MailFlow...
    </div>
  );

  // Enforce Authentication Redirects Declaratively
  if (!user && location.pathname !== "/login") return <Navigate to="/login" replace />;
  if (user && location.pathname === "/login") return <Navigate to="/dashboard" replace />;
  
  // Render Login page standalone if unauthenticated
  if (!user && location.pathname === "/login") return <Login />;

  // Derive Current Screen for Sidebar active state
  let page = "dashboard";
  if (location.pathname === "/campaign") page = "new-campaign";
  if (location.pathname === "/api-keys") page = "api-keys";
  if (location.pathname === "/domains") page = "domains";
  if (location.pathname === "/smtp") page = "smtp";
  if (location.pathname === "/activity") page = "activity";
  if (location.pathname === "/settings") page = "settings";

  // Shim setPage so Sidebar buttons perform real browser navigation
  const handleNavigation = (targetPage) => {
    if (targetPage === "dashboard") navigate("/dashboard");
    if (targetPage === "new-campaign") navigate("/campaign");
    if (targetPage === "api-keys") navigate("/api-keys");
    if (targetPage === "domains") navigate("/domains");
    if (targetPage === "smtp") navigate("/smtp");
    if (targetPage === "activity") navigate("/activity");
    if (targetPage === "settings") navigate("/settings");
  };

  return (
    <div className="app-container" style={{ fontFamily:"'DM Sans', sans-serif", background:"#0f0f0f", color:"#f0f0f0" }}>
      <Sidebar page={page} setPage={handleNavigation} user={user} />
      <main className="app-main">
        <Routes>
          <Route path="/dashboard" element={<Dashboard user={user} />} />
          <Route path="/campaign" element={<NewCampaign user={user} setPage={handleNavigation} />} />
          <Route path="/api-keys" element={<ApiKeys />} />
          <Route path="/domains" element={<Domains />} />
          <Route path="/smtp" element={<Smtp />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/settings" element={<Settings user={user} />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

/* ── Router: public pages get real URL routes; everything else is the app shell ── */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="*" element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  );
}