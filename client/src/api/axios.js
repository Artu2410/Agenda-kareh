import axios from 'axios';

const instance = axios.create({
  baseURL: 'http://localhost:5000/api', // Ajusta la URL base de tu API (puerto del backend)
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para añadir el token JWT automáticamente en todas las peticiones
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

// Interceptor para manejo de errores (como solicitaste)
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Aquí puedes manejar errores de forma global
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default instance;
