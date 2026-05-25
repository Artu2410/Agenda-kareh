import axios from 'axios';
import { API_BASE_URL } from './apiBase';
import { ensureCsrfToken } from './csrf';
import { clearClientSession } from './session';
import * as authStore from '../stores/auth';
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

const shouldLogRequests = import.meta.env.DEV && import.meta.env.VITE_API_DEBUG !== '0';
const isRefreshableAuthError = (response) => {
  const status = response?.status;
  if (status === 401) return true;
  if (status !== 403) return false;
  const message = String(response?.data?.message || '').toLowerCase();
  return message.includes('token');
};
const buildRequestUrl = (config) => {
  const baseURL = String(config.baseURL || '');
  const url = String(config.url || '');

  try {
    return new URL(url, baseURL || window.location.origin).toString();
  } catch {
    return `${baseURL}${url}`;
  }
};

// Interceptor para logging/debug
api.interceptors.request.use(
  async (config) => {
    // Añadimos Authorization desde el store en memoria (no localStorage)
    const token = authStore.getAccessToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
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
      message = error.response.data?.message || message;
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
    // Manejo de refresh con queue/dedupe — accessToken en memoria, refresh en cookie httpOnly
    if (isRefreshableAuthError(error.response) && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const isRefreshCall = String(originalRequest.url || '').includes('/auth/refresh');
      if (isRefreshCall) return Promise.reject(error);

      // Queue/dedupe
      if (!api.isRefreshing) api.isRefreshing = false;
      if (!api.failedQueue) api.failedQueue = [];

      const processQueue = (err, token = null) => {
        api.failedQueue.forEach((prom) => {
          if (err) prom.reject(err);
          else prom.resolve(token);
        });
        api.failedQueue = [];
      };

      if (api.isRefreshing) {
        return new Promise((resolve, reject) => {
          api.failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      api.isRefreshing = true;

      return new Promise(async (resolve, reject) => {
        try {
          const refreshResponse = await api.post('/auth/refresh', null, { withCredentials: true });
          const newToken = refreshResponse?.data?.accessToken;
          if (!newToken) throw new Error('No accessToken on refresh');

          // actualizar token en memoria
          authStore.setAccessToken(newToken);
          api.defaults.headers.common.Authorization = `Bearer ${newToken}`;

          processQueue(null, newToken);
          resolve(api(originalRequest));
        } catch (err) {
          processQueue(err, null);
          // Limpieza global: clear session + logout
          try {
            authStore.clearAuth();
            // intentamos logout en backend para limpiar cookie si es posible
            await api.post('/auth/logout', null).catch(() => {});
          } catch (e) {
            // ignore
          }
          clearClientSession();
          // redirigir a login (behaviour global)
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          reject(err);
        } finally {
          api.isRefreshing = false;
        }
      });
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
export const requestOTP = (email) => api.post('/auth/request-otp', { email });
export const verifyOTP = (email, otp) => api.post(
  '/auth/verify-otp',
  { email, otp },
  { headers: { 'X-Auth-Fallback': '1' } }
);

// Appointments
export const deleteAppointment = (id) => api.delete(`/appointments/${id}`);
export const cancelFutureAppointments = (patientId, fromDate = null) => 
  api.post(`/appointments/patients/${patientId}/cancel-future`, { fromDate });

export const updateAppointment = (id, data) => api.put(`/appointments/${id}`, data);
