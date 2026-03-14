import axios from 'axios';

/**
 * CONFIGURACIÓN DE URL
 * Forzamos que la base siempre incluya /api para que todas las llamadas 
 * relativas funcionen automáticamente.
 */
const defaultApiUrl = import.meta.env.DEV
  ? 'http://localhost:5000'
  : 'https://kareh-backend.onrender.com';
const rawUrl = import.meta.env.VITE_API_URL || defaultApiUrl;
// Si la URL no termina en /api, se lo agregamos. 
export const API_BASE_URL = rawUrl.endsWith('/api') ? rawUrl : `${rawUrl.replace(/\/$/, '')}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

const getFallbackToken = () => sessionStorage.getItem('auth_fallback_token');
const isFallbackMode = () => sessionStorage.getItem('auth_fallback') === '1';
const enableFallbackMode = () => sessionStorage.setItem('auth_fallback', '1');
const clearFallbackMode = () => sessionStorage.removeItem('auth_fallback');

// Interceptor para logging/debug
api.interceptors.request.use(
  (config) => {
    if (isFallbackMode()) {
      const token = getFallbackToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
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
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const isRefreshCall = String(originalRequest.url || '').includes('/auth/refresh');
      if (!isRefreshCall && !isFallbackMode()) {
        try {
          const refreshResponse = await api.post('/auth/refresh', null, {
            headers: { 'X-Auth-Fallback': '1' }
          });
          if (refreshResponse.data?.accessToken) {
            sessionStorage.setItem('auth_fallback_token', refreshResponse.data.accessToken);
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
          localStorage.removeItem('userEmail');
          localStorage.removeItem('userName');
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
