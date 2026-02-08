import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const ProtectedRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token');

        if (!token) {
          setIsAuthenticated(false);
          setIsChecking(false);
          return;
        }

        const response = await fetch('/api/auth/verify', {
          headers: { Authorization: `Bearer ${token}` }
        });

        // Leer el body de forma segura: puede venir vacío o no ser JSON (ej. HTML de error)
        const text = await response.text();
        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch (parseError) {
          console.error('Respuesta no-JSON al verificar token:', text);
          data = {};
        }

        if (response.ok && data.valid) {
          setIsAuthenticated(true);
        } else {
          console.error('Error verificando token:', response.status, data);
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_email');
          localStorage.removeItem('user_name');
          setIsAuthenticated(false);
          // Mostrar mensaje sólo si es un problema de sesión
          if (response.status === 401 || response.status === 403) {
            toast.error('Sesión expirada. Por favor, inicia sesión nuevamente.');
          }
        }
      } catch (error) {
        console.error('Error verificando autenticación:', error);
        localStorage.removeItem('auth_token');
        setIsAuthenticated(false);
      } finally {
        setIsChecking(false);
      }
    };

    verifyAuth();
  }, []);

  if (isChecking) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <div className="inline-block">
            <div className="w-12 h-12 rounded-full border-4 border-teal-200 border-t-teal-600 animate-spin"></div>
          </div>
          <p className="text-slate-400 font-bold">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
