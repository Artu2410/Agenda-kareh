import axios from 'axios';

const defaultApiUrl = import.meta.env.DEV
  ? 'http://localhost:5000'
  : 'https://kareh-backend.onrender.com';
const rawUrl = import.meta.env.VITE_API_URL || defaultApiUrl;
const API_URL = rawUrl.endsWith('/api') ? rawUrl : `${rawUrl.replace(/\/$/, '')}/api`;

const instance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('Sesión no autorizada');
      // Opcional: localStorage.removeItem('auth_token'); window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default instance;
