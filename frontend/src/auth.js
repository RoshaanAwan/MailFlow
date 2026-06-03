/*
 * Self-hosted JWT auth client (replaces Firebase Auth).
 *
 * Stores the JWT + user in localStorage and exposes an `auth` object shaped
 * like the bits of the Firebase SDK the app used, so pages need minimal changes:
 *   - auth.currentUser            -> { uid, email } | null
 *   - auth.currentUser.getIdToken() -> Promise<string>  (returns the stored JWT)
 *   - onAuthStateChanged(cb)      -> subscribe to login/logout, returns unsubscribe
 *   - signOut()                   -> clear session
 *   - login(email, pw) / register(email, pw)
 */

const API = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "mailflow_token";
const USER_KEY = "mailflow_user";

let _token = localStorage.getItem(TOKEN_KEY);
let _user = JSON.parse(localStorage.getItem(USER_KEY) || "null");
const _listeners = new Set();

function _notify() {
  for (const cb of _listeners) cb(auth.currentUser);
}

function _setSession(token, user) {
  _token = token;
  _user = user;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  _notify();
}

function _clearSession() {
  _token = null;
  _user = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  _notify();
}

/* A Firebase-like `auth` object. currentUser is null when logged out. */
export const auth = {
  get currentUser() {
    if (!_user) return null;
    return {
      uid: _user.uid,
      email: _user.email,
      email_verified: _user.email_verified,
      // Firebase returns a fresh ID token here; we return the stored JWT.
      getIdToken: async () => _token,
    };
  },
};

export function getToken() {
  return _token;
}

export function onAuthStateChanged(callback) {
  _listeners.add(callback);
  // Fire once immediately with current state (matches Firebase behavior).
  callback(auth.currentUser);
  return () => _listeners.delete(callback);
}

export function signOut() {
  _clearSession();
  return Promise.resolve();
}

export async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Login failed");
  _setSession(data.token, data.user);
  return data.user;
}

export async function register(email, password) {
  const res = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Registration failed");
  _setSession(data.token, data.user);
  return data.user;
}

export async function forgotPassword(email) {
  const res = await fetch(`${API}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data.message;
}

export async function resetPassword(token, newPassword) {
  const res = await fetch(`${API}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Reset failed");
  return data.message;
}

export async function verifyEmail(token) {
  const res = await fetch(`${API}/auth/verify-email?token=${encodeURIComponent(token)}`, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Verification failed");
  // Reflect the new verified state in the stored session if logged in.
  if (_user && data.user) _setSession(_token, data.user);
  return data.message;
}

export async function resendVerification() {
  const res = await fetch(`${API}/auth/resend-verification`, {
    method: "POST",
    headers: { Authorization: `Bearer ${_token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Could not resend");
  return data.message;
}

/* Validate the stored token against the backend; clears session if invalid. */
export async function validateSession() {
  if (!_token) return null;
  try {
    const res = await fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${_token}` },
    });
    if (!res.ok) {
      _clearSession();
      return null;
    }
    const data = await res.json();
    // Refresh stored user in case it changed.
    _setSession(_token, data.user);
    return data.user;
  } catch {
    // Network error: keep the optimistic local session rather than logging out.
    return auth.currentUser;
  }
}
