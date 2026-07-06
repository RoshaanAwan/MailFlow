import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { resetPassword } from "../auth";
import "./AuthAction.css";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [done, setDone]         = useState(false);
  const [loading, setLoading]   = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  if (!token) {
    return (
      <div className="auth-action-page">
        <div className="auth-action-card">
          <h1 className="auth-action-title">Reset Password</h1>
          <div className="auth-action-icon err">✕</div>
          <p className="auth-action-text">Invalid reset link — no token provided.</p>
          <Link className="auth-action-btn" to="/login">Back to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-action-page">
      <div className="auth-action-card">
        <h1 className="auth-action-title">Set a New Password</h1>
        {done ? (
          <>
            <div className="auth-action-icon ok">✓</div>
            <p className="auth-action-text">Password reset! Redirecting to login…</p>
          </>
        ) : (
          <form onSubmit={submit}>
            {error && <div className="auth-action-error">{error}</div>}
            <input
              className="auth-action-input"
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <input
              className="auth-action-input"
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <button className="auth-action-btn" type="submit" disabled={loading}>
              {loading ? "Resetting…" : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
