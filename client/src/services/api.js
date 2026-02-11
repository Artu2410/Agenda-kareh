import axios from 'axios';

/**
 * CONFIGURACIÓN DE URL
 * Usamos una lógica de limpieza para evitar doble barra // o falta de barra
 */
const rawUrl = import.meta.env.VITE_API_URL || 'https://kareh-backend.onrender.com/api';
// Nos aseguramos de que la URL base no termine en '/' para que las rutas relativas funcionen siempre
const API_BASE_URL = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para añadir el JWT a cada petición
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Log de depuración (puedes quitarlo luego de probar)
    console.log(`🚀 Petición saliente: ${config.method.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejar respuestas y errores globalmente
api.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'Ocurrió un error inesperado';

    if (error.response) {
      const status = error.response.status;
      
      if (status === 401) message = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
      if (status === 403) message = 'No tienes permiso para realizar esta acción.';
      if (status === 409) message = 'Este horario ya está ocupado por otro paciente.';
      if (status === 400) message = 'Datos inválidos. Revisa el formulario.';
      if (status === 500) message = 'Error en el servidor de Kareh Pro. Revisa el backend.';
      if (status === 503) message = 'El servidor está temporalmente fuera de línea.';
      
      message = error.response.data?.message || message;
    } else if (error.request) {
      message = 'No se pudo conectar con el servidor. Verifica tu conexión o el estado del backend.';
    }

    return Promise.reject({ ...error, friendlyMessage: message });
  }
);

export default api;

// --- FUNCIONES ESPECÍFICAS ---
// Nota: Todas empiezan con '/' y Axios las unirá a .../api correctamente

export const requestOTP = async (email) => api.post('/auth/request-otp', { email });
export const verifyOTP = async (email, otp) => api.post('/auth/verify-otp', { email, otp });

export const deleteAppointment = async (appointmentId) => api.delete(`/appointments/${appointmentId}`);
export const cancelFutureAppointments = async (patientId, fromDate = null) => 
  api.post(`/appointments/patients/${patientId}/cancel-future`, { fromDate });

// Usamos PATCH para actualizaciones parciales (o PUT si cambiaste el backend a PUT)
export const updateAppointment = async (appointmentId, data) => api.patch(`/appointments/${appointmentId}`, data);