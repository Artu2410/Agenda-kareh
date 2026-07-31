// Minimal in-memory auth store (no localStorage for access token)
// Exports: getAccessToken, setAccessToken, clearAuth, logout

import { clearClientSession } from '../services/session';
import { getApiUrl } from '../services/apiBase';
import { APP_ROUTES } from '../utils/appRoutes';

const isLoginPath = () => {
  if (typeof window === 'undefined') return false;

  const { pathname } = window.location;
  return pathname === APP_ROUTES.login || pathname === '/login';
};

let accessToken = null;
const listeners = new Set();

export const getAccessToken = () => accessToken;

export const setAccessToken = (token) => {
  accessToken = token || null;
  listeners.forEach((fn) => {
    try { fn(accessToken); } catch { /* ignore */ }
  });
};

export const clearAuth = () => {
  accessToken = null;
  listeners.forEach((fn) => {
    try { fn(accessToken); } catch { /* ignore */ }
  });
  // clear persisted user/session info (keeps cookies untouched)
  try { clearClientSession(); } catch { /* ignore */ }
};

export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const logout = async () => {
  try {
    // try to call backend logout to clear refresh cookie
    await fetch(getApiUrl('/auth/logout'), { method: 'POST', credentials: 'include' }).catch(() => {});
  } catch {
    // ignore
  }
  clearAuth();
  if (typeof window !== 'undefined' && import.meta.env.MODE !== 'test' && !isLoginPath()) {
    window.location.replace(APP_ROUTES.login);
  }
};

export default {
  getAccessToken,
  setAccessToken,
  clearAuth,
  subscribe,
  logout,
};
