import axios from 'axios';

/**
 * CONFIGURACIÓN DE URL
 * Priorizamos la variable de entorno, pero dejamos la de Render como fallback directo
 * para evitar que 'import.meta.env' falle en tiempo de ejecución.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://kareh-backend.onrender.com/api';

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
      // El servidor respondió con un código de error (4xx, 5xx)
      const status = error.response.status;
      
      if (status === 401) message = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
      if (status === 403) message = 'No tienes permiso para realizar esta acción.';
      if (status === 409) message = 'Este horario ya está ocupado por otro paciente.';
      if (status === 400) message = 'Datos inválidos. Revisa el formulario.';
      if (status === 500) message = 'Error en el servidor de Kareh Pro. Revisa el backend.';
      if (status === 503) message = 'El servidor está temporalmente fuera de línea.';
      
      // Si el backend envió un mensaje específico, lo usamos
      message = error.response.data?.message || message;
    } else if (error.request) {
      // La petición se hizo pero no hubo respuesta (Error de red o CORS)
      message = 'No se pudo conectar con el servidor. Verifica tu conexión o el estado del backend.';
    }

    // Retornamos un objeto de error más limpio para el frontend
    return Promise.reject({ ...error, friendlyMessage: message });
  }
);

export default api;

// --- FUNCIONES ESPECÍFICAS ---

// Auth - Petición de OTP (Hardcoded para asegurar que funcione)
export const requestOTP = async (email) => {
  return api.post('/auth/request-otp', { email });
};

export const verifyOTP = async (email, otp) => {
  return api.post('/auth/verify-otp', { email, otp });
};

// Appointments
export const deleteAppointment = async (appointmentId) => {
  return api.delete(`/appointments/${appointmentId}`);
};

export const cancelFutureAppointments = async (patientId, fromDate = null) => {
  return api.post(`/appointments/patients/${patientId}/cancel-future`, { fromDate });
};

export const updateAppointment = async (appointmentId, data) => {
  return api.patch(`/appointments/${appointmentId}`, data);
};