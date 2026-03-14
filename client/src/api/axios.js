import axios from 'axios';

const defaultApiUrl = import.meta.env.DEV
  ? 'http://localhost:5000'
  : 'https://kareh-backend.onrender.com';
const rawUrl = import.meta.env.VITE_API_URL || defaultApiUrl;
const API_URL = rawUrl.endsWith('/api') ? rawUrl : `${rawUrl.replace(/\/$/, '')}/api`;

const instance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const getFallbackToken = () => sessionStorage.getItem('auth_fallback_token');
const isFallbackMode = () => sessionStorage.getItem('auth_fallback') === '1';
const enableFallbackMode = () => sessionStorage.setItem('auth_fallback', '1');
const clearFallbackMode = () => sessionStorage.removeItem('auth_fallback');

instance.interceptors.request.use(
  (config) => {
    if (isFallbackMode()) {
      const token = getFallbackToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      console.warn('Sesión no autorizada');
      // Opcional: localStorage.removeItem('auth_token'); window.location.href = '/login';
    }
    const originalRequest = error.config;
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const isRefreshCall = String(originalRequest.url || '').includes('/auth/refresh');
      if (!isRefreshCall && !isFallbackMode()) {
        try {
          const refreshResponse = await instance.post('/auth/refresh', null, {
            headers: { 'X-Auth-Fallback': '1' }
          });
          if (refreshResponse.data?.accessToken) {
            sessionStorage.setItem('auth_fallback_token', refreshResponse.data.accessToken);
          }
          return instance(originalRequest);
        } catch (refreshError) {
          const fallbackToken = getFallbackToken();
          if (fallbackToken) {
            enableFallbackMode();
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${fallbackToken}`;
            return instance(originalRequest);
          }
          clearFallbackMode();
          return Promise.reject(refreshError);
        }
      } else if (isFallbackMode()) {
        const fallbackToken = getFallbackToken();
        if (fallbackToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${fallbackToken}`;
          return instance(originalRequest);
        }
      }
    }
    return Promise.reject(error);
  }
);

export default instance;
