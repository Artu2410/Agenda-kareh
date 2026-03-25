import axios from 'axios';
import { API_BASE_URL } from './apiBase';
import { ensureCsrfToken } from './csrf';
import { clearClientSession } from './session';

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

const getFallbackToken = () => localStorage.getItem('auth_fallback_token');
const isFallbackMode = () => localStorage.getItem('auth_fallback') === '1';
const enableFallbackMode = () => localStorage.setItem('auth_fallback', '1');
const clearFallbackMode = () => localStorage.removeItem('auth_fallback');
const isRefreshableAuthError = (response) => {
  const status = response?.status;
  if (status === 401) return true;
  if (status !== 403) return false;
  const message = String(response?.data?.message || '').toLowerCase();
  return message.includes('token');
};

// Interceptor para logging/debug
api.interceptors.request.use(
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
    // Útil para ver en consola si la URL se está armando bien
    console.log(`🌐 Llamando a: ${config.baseURL}${config.url}`);
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
    if (isRefreshableAuthError(error.response) && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const isRefreshCall = String(originalRequest.url || '').includes('/auth/refresh');
      if (!isRefreshCall && !isFallbackMode()) {
        try {
          const refreshResponse = await api.post('/auth/refresh', null, {
            headers: { 'X-Auth-Fallback': '1' }
          });
          if (refreshResponse.data?.accessToken) {
            localStorage.setItem('auth_fallback_token', refreshResponse.data.accessToken);
          }
          return api(originalRequest);
        } catch (refreshError) {
          const fallbackToken = getFallbackToken();
          if (fallbackToken) {
            enableFallbackMode();
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${fallbackToken}`;
            return api(originalRequest);
          }
          clearFallbackMode();
          clearClientSession();
        }
      } else if (isFallbackMode()) {
        const fallbackToken = getFallbackToken();
        if (fallbackToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${fallbackToken}`;
          return api(originalRequest);
        }
      }
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
