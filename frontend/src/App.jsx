import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NewCampaign from "./pages/NewCampaign";
import Settings from "./pages/Settings";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Sidebar from "./components/Sidebar";

const firebaseConfig = {
  apiKey: "AIzaSyAexpdue23445DL1WeogZNeCTSXkhJvsyg",
  authDomain: "emailscript-22620.firebaseapp.com",
  projectId: "emailscript-22620",
  storageBucket: "emailscript-22620.firebasestorage.app",
  messagingSenderId: "419515048306",
  appId: "1:419515048306:web:76d13385a50feced26bdeb",
  measurementId: "G-KEV0BCXN6P"
};

const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

/* ── Main app shell (page-state navigation) ── */
function AppShell() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState("dashboard");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", fontFamily:"'DM Sans', sans-serif", color:"#888" }}>
      Loading MailFlow...
    </div>
  );

  if (!user) return <Login />;

  return (
    <div style={{ display:"flex", minHeight:"100vh", fontFamily:"'DM Sans', sans-serif", background:"#0f0f0f", color:"#f0f0f0" }}>
      <Sidebar page={page} setPage={setPage} user={user} />
      <main style={{ flex:1, padding:"2rem", overflowY:"auto" }}>
        {page === "dashboard"    && <Dashboard user={user} />}
        {page === "new-campaign" && <NewCampaign user={user} setPage={setPage} />}
        {page === "settings"     && <Settings user={user} />}
      </main>
    </div>
  );
}

/* ── Router: only /privacy and /terms get real URL routes ── */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="*" element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  );
}