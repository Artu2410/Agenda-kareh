import axios from 'axios';

// Detecta la URL automáticamente
const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:10000/api' 
  : 'https://kareh-backend.onrender.com/api';

const instance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para añadir el token JWT
instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Manejo global de errores
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Si el token expiró, podrías redirigir al login
      console.warn('Sesión expirada o no autorizada');
    }
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default instance;