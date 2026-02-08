import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://kareh-backend.onrender.com/api',
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
    let message = 'Ocurri� un error inesperado';

    if (error.response) {
      // The server responded with an error code (4xx, 5xx)
      const status = error.response.status;
      
      if (status === 503) message = 'El servidor de Kareh Pro est� fuera de l�nea. Revisa el backend.';
      if (status === 409) message = 'Este horario ya est� ocupado por otro paciente.';
      if (status === 400) message = 'Datos inv�lidos. Revisa el formulario.';
      
      // If the backend sent a specific message, we use it
      message = error.response.data?.message || message;
    } else if (error.request) {
      // The request was made but there was no response (Network Error)
      message = 'No se pudo conectar con el servidor. Verifica tu conexi�n.';
    }

    // We return a cleaner error object
    return Promise.reject({ ...error, friendlyMessage: message });
  }
);

export default api;
// Funciones específicas para Appointments
export const deleteAppointment = async (appointmentId) => {
  return api.delete(`/appointments/${appointmentId}`);
};

export const cancelFutureAppointments = async (patientId, fromDate = null) => {
  return api.post(`/appointments/patients/${patientId}/cancel-future`, { fromDate });
};

export const updateAppointment = async (appointmentId, data) => {
  return api.patch(`/appointments/${appointmentId}`, data);
};