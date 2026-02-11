import axios from 'axios';

/**
 * CONFIGURACIÓN DE URL
 * Forzamos que la base siempre incluya /api para que todas las llamadas 
 * relativas funcionen automáticamente.
 */
const rawUrl = import.meta.env.VITE_API_URL || 'https://kareh-backend.onrender.com';
// Si la URL no termina en /api, se lo agregamos. 
const API_BASE_URL = rawUrl.endsWith('/api') ? rawUrl : `${rawUrl.replace(/\/$/, '')}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para añadir el JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
  (error) => {
    let message = 'Ocurrió un error inesperado';
    if (error.response) {
      const status = error.response.status;
      if (status === 401) message = 'Sesión expirada.';
      if (status === 404) message = 'No se encontró el recurso (Error de ruta).';
      message = error.response.data?.message || message;
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
export const verifyOTP = (email, otp) => api.post('/auth/verify-otp', { email, otp });

// Appointments
export const deleteAppointment = (id) => api.delete(`/appointments/${id}`);
export const cancelFutureAppointments = (patientId, fromDate = null) => 
  api.post(`/appointments/patients/${patientId}/cancel-future`, { fromDate });

export const updateAppointment = (id, data) => api.patch(`/appointments/${id}`, data);