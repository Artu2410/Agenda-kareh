// Minimal in-memory auth store (no localStorage for access token)
// Exports: getAccessToken, setAccessToken, clearAuth, logout

import { clearClientSession } from '../services/session';

let accessToken = null;
const listeners = new Set();

export const getAccessToken = () => accessToken;

export const setAccessToken = (token) => {
  accessToken = token || null;
  listeners.forEach((fn) => {
    try { fn(accessToken); } catch (e) { /* ignore */ }
  });
};

export const clearAuth = () => {
  accessToken = null;
  listeners.forEach((fn) => {
    try { fn(accessToken); } catch (e) { /* ignore */ }
  });
  // clear persisted user/session info (keeps cookies untouched)
  try { clearClientSession(); } catch (e) { /* ignore */ }
};

export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const logout = async () => {
  try {
    // try to call backend logout to clear refresh cookie
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
  } catch (e) {
    // ignore
  }
  clearAuth();
  if (typeof window !== 'undefined') window.location.href = '/login';
};

export default {
  getAccessToken,
  setAccessToken,
  clearAuth,
  subscribe,
  logout,
};
