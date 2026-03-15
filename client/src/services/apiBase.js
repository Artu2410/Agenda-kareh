const defaultApiUrl = import.meta.env.DEV
  ? 'http://localhost:5000'
  : 'https://kareh-backend.onrender.com';

const rawUrl = import.meta.env.VITE_API_URL || defaultApiUrl;

export const API_BASE_URL = rawUrl.endsWith('/api')
  ? rawUrl
  : `${rawUrl.replace(/\/$/, '')}/api`;
