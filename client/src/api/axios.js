import axios from 'axios';
import { API_BASE_URL } from '../services/apiBase';
import { ensureCsrfToken } from '../services/csrf';

const instance = axios.create({
  baseURL: API_BASE_URL,
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
  async (config) => {
    if (isFallbackMode()) {
      const token = getFallbackToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    const method = (config.method || 'get').toLowerCase();
    const isMutating = ['post', 'put', 'delete', 'patch'].includes(method);
    const isCsrfEndpoint = String(config.url || '').includes('/csrf-token');
    if (isMutating && !isCsrfEndpoint) {
      const csrfToken = await ensureCsrfToken();
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
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
    if (error.response?.status === 403 && error.response?.data?.code === 'EBADCSRFTOKEN' && originalRequest && !originalRequest._csrfRetry) {
      originalRequest._csrfRetry = true;
      try {
        const csrfToken = await ensureCsrfToken();
        if (csrfToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers['X-CSRF-Token'] = csrfToken;
        }
        return instance(originalRequest);
      } catch {
        // sin token, propaga el error
      }
    }
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
