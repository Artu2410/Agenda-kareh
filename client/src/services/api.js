import axios from 'axios';
import { API_BASE_URL } from './apiBase';
import { ensureCsrfToken } from './csrf';
import * as authStore from '../stores/auth';
import { APP_ROUTES } from '../utils/appRoutes';
/**
 * CONFIGURACIÓN DE URL
 * Forzamos que la base siempre incluya /api para que todas las llamadas 
 * relativas funcionen automáticamente.
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

const isDebugEnabled = import.meta.env.DEV && import.meta.env.MODE !== 'test';
const shouldLogRequests = isDebugEnabled && import.meta.env.VITE_API_DEBUG !== '0';
let isRefreshing = false;
let failedQueue = [];

const isRefreshableAuthError = (response) => {
  const status = response?.status;
  if (status === 401) return true;
  if (status !== 403) return false;
  const message = String(response?.data?.message || '').toLowerCase();
  return message.includes('token');
};
const shouldSkipAuthRefresh = (config) => Boolean(config?.skipAuthRefresh);
const isLoginPath = () => {
  if (typeof window === 'undefined') return false;

  const { pathname } = window.location;
  return pathname === APP_ROUTES.login || pathname === '/login';
};
const buildRequestUrl = (config) => {
  const baseURL = String(config.baseURL || '');
  const url = String(config.url || '');
  const normalizedBase = baseURL.replace(/\/+$/, '');
  const normalizedUrl = url.replace(/^\/+/, '');

  if (!normalizedBase) return normalizedUrl ? `/${normalizedUrl}` : url;
  if (/^https?:\/\//i.test(url)) return url;
  if (!normalizedUrl) return normalizedBase;

  return `${normalizedBase}/${normalizedUrl}`;
};

const buildFriendlyErrorMessage = (response) => {
  const fallback = 'Ocurrió un error inesperado';
  const data = response?.data || {};

  if (data.message) {
    return data.message;
  }

  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors
      .map((item) => item?.message)
      .filter(Boolean)
      .join('\n') || fallback;
  }

  return fallback;
};

const processQueue = (err, token = null) => {
  const queue = failedQueue;
  failedQueue = [];

  if (isDebugEnabled) {
    console.debug('[api] processQueue', { err: !!err, token, queued: queue.length });
  }

  queue.forEach(({ resolve, reject }) => {
    if (err) reject(err);
    else resolve(token);
  });
};

export const resetApiClientState = () => {
  isRefreshing = false;
  failedQueue = [];
  delete api.defaults.headers.common.Authorization;
};

export const getApiClientState = () => ({
  isRefreshing,
  failedQueueLength: failedQueue.length,
});

// Interceptor para logging/debug
api.interceptors.request.use(
  async (config) => {
    config.headers = config.headers || {};

    // Añadimos Authorization desde el store en memoria (no localStorage)
    const token = authStore.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (config.headers.Authorization) {
      delete config.headers.Authorization;
    }
    if (isDebugEnabled) console.debug('[api] request', config.method, config.url, { hasAuth: !!token });
    const method = (config.method || 'get').toLowerCase();
    const isMutating = ['post', 'put', 'delete', 'patch'].includes(method);
    const isCsrfEndpoint = String(config.url || '').includes('/csrf-token');
    if (isMutating && !isCsrfEndpoint) {
      const csrfToken = await ensureCsrfToken();
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }

    if (shouldLogRequests) {
      console.info(`[api] ${method.toUpperCase()} ${buildRequestUrl(config)}`);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de errores (se mantiene tu lógica que es buena)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    let message = 'Ocurrió un error inesperado';
    if (error.response) {
      const status = error.response.status;
      if (status === 401) message = 'Sesión expirada.';
      if (status === 404) message = 'No se encontró el recurso (Error de ruta).';
      message = buildFriendlyErrorMessage(error.response) || message;
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
        return api(originalRequest);
      } catch {
        // Si no se puede regenerar, dejamos que caiga el error
      }
    }
    if (shouldSkipAuthRefresh(originalRequest)) {
      return Promise.reject({ ...error, friendlyMessage: message });
    }
    // Manejo de refresh con queue/dedupe — accessToken en memoria, refresh en cookie httpOnly
    if (isRefreshableAuthError(error.response) && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const isRefreshCall = String(originalRequest.url || '').includes('/auth/refresh');
      if (isRefreshCall) return Promise.reject(error);

      // Queue/dedupe
      if (isRefreshing) {
        if (isDebugEnabled) console.debug('[api] request queued while refreshing', originalRequest.url);
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers = originalRequest.headers || {};
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            } else {
              delete originalRequest.headers.Authorization;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;

      return (async () => {
        try {
          if (isDebugEnabled) console.debug('[api] starting refresh');
          const refreshResponse = await api.post('/auth/refresh', null, { withCredentials: true });
          const newToken = refreshResponse?.data?.accessToken || null;

          if (isDebugEnabled) console.debug('[api] refresh success, updating auth mode', { hasAccessToken: Boolean(newToken) });
          authStore.setAccessToken(newToken);

          processQueue(null, newToken);
          originalRequest.headers = originalRequest.headers || {};
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          } else {
            delete originalRequest.headers.Authorization;
          }
          return api(originalRequest);
        } catch (err) {
          if (isDebugEnabled) console.debug('[api] refresh failed', err?.message || err);
          processQueue(err, null);
          // Limpieza global: clear session + logout
          try {
            authStore.clearAuth();
            // intentamos logout en backend para limpiar cookie si es posible
            await api.post('/auth/logout', null, { skipAuthRefresh: true }).catch(() => {});
            if (isDebugEnabled) console.debug('[api] triggered backend logout');
          } catch {
            // ignore
          }
          // redirigir a login (behaviour global)
          if (typeof window !== 'undefined' && import.meta.env.MODE !== 'test' && !isLoginPath()) {
            if (isDebugEnabled) console.debug('[api] redirecting to /login');
            window.location.replace(APP_ROUTES.login);
          }
          throw err;
        } finally {
          isRefreshing = false;
        }
      })();
    }
    return Promise.reject({ ...error, friendlyMessage: message });
  }
);

export default api;

/**
 * FUNCIONES ESPECÍFICAS
 * Ahora son mucho más limpias porque NO necesitan repetir "/api"
 */

// Auth
export const requestOTP = (email) => api.post('/auth/request-otp', { email }, { skipAuthRefresh: true });
export const verifyOTP = (email, otp) => api.post(
  '/auth/verify-otp',
  { email, otp },
  { skipAuthRefresh: true }
);

// Appointments
export const deleteAppointment = (id) => api.delete(`/appointments/${id}`);
export const cancelFutureAppointments = (patientId, fromDate = null) => 
  api.post(`/appointments/patients/${patientId}/cancel-future`, { fromDate });

export const updateAppointment = (id, data) => api.put(`/appointments/${id}`, data);
