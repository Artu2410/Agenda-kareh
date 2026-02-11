import axios from 'axios';

// Definimos la URL base asegurando que termine en /api
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

instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('Sesión no autorizada');
      // Opcional: localStorage.removeItem('auth_token'); window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default instance;