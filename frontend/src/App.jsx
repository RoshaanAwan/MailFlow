import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
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

function ProtectedLayout({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div style={{ display:"flex", minHeight:"100vh", fontFamily:"'DM Sans', sans-serif", background:"#0f0f0f", color:"#f0f0f0" }}>
      <Sidebar user={user} />
      <main style={{ flex:1, padding:"2rem", overflowY:"auto" }}>
        {children}
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />

        {/* Protected routes */}
        <Route path="/" element={
          <ProtectedLayout user={user}>
            <Dashboard user={user} />
          </ProtectedLayout>
        } />
        <Route path="/new-campaign" element={
          <ProtectedLayout user={user}>
            <NewCampaign user={user} />
          </ProtectedLayout>
        } />
        <Route path="/settings" element={
          <ProtectedLayout user={user}>
            <Settings user={user} />
          </ProtectedLayout>
        } />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}