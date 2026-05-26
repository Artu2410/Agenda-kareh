const LOCAL_API_ORIGIN = 'http://localhost:5000';
const PROD_API_ORIGIN = 'https://kareh-backend.onrender.com';
const isLocalApiMode = import.meta.env.DEV || import.meta.env.MODE === 'test';

const normalizeUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

export const getApiBaseUrl = (rawUrl = import.meta.env.VITE_API_URL) => {
  const fallbackOrigin = isLocalApiMode ? LOCAL_API_ORIGIN : PROD_API_ORIGIN;
  const normalized = normalizeUrl(rawUrl || fallbackOrigin);
  const baseUrl = normalized || fallbackOrigin;

  return baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
};

export const API_BASE_URL = getApiBaseUrl();

export const getApiUrl = (path = '') => {
  const normalizedPath = String(path || '').replace(/^\/+/, '');
  if (!normalizedPath) return API_BASE_URL;

  if (/^https?:\/\//i.test(API_BASE_URL)) {
    return new URL(normalizedPath, `${API_BASE_URL}/`).toString();
  }

  return `${API_BASE_URL}/${normalizedPath}`.replace(/\/{2,}/g, '/');
};
