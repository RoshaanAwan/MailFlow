import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { verifyEmail } from "../auth";
import "./AuthAction.css";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage("No verification token found in the link.");
      return;
    }
    verifyEmail(token)
      .then((msg) => { setStatus("success"); setMessage(msg); })
      .catch((e) => { setStatus("error"); setMessage(e.message); });
  }, []);

  return (
    <div className="auth-action-page">
      <div className="auth-action-card">
        <h1 className="auth-action-title">Email Verification</h1>
        {status === "verifying" && <p className="auth-action-text">Verifying your email…</p>}
        {status === "success" && (
          <>
            <div className="auth-action-icon ok">✓</div>
            <p className="auth-action-text">Your email is verified. You can now send email.</p>
            <Link className="auth-action-btn" to="/dashboard">Go to Dashboard</Link>
          </>
        )}
        {status === "error" && (
          <>
            <div className="auth-action-icon err">✕</div>
            <p className="auth-action-text">{message}</p>
            <Link className="auth-action-btn" to="/dashboard">Back to Dashboard</Link>
          </>
        )}
      </div>
    </div>
  );
}
