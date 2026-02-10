import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import AppointmentsPage from './pages/AppointmentsPage';
import CashflowPage from './pages/CashflowPage';
import SettingsPage from './pages/SettingsPage';
import PatientsPage from './pages/PatientsPage';
import ClinicalHistoriesPage from './pages/ClinicalHistoriesPage'; 
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import Sidebar from './components/layout/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';

import { CustomToaster } from './components/Toast';

function App() {
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const verifyAuth = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      setIsAuthenticated(false);
      setIsVerifying(false);
      return;
    }

    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'https://kareh-backend.onrender.com/api';
      const response = await fetch(`${baseUrl}/auth/verify`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      // Si el servidor responde con HTML o error, no es un JSON válido
      const contentType = response.headers.get("content-type");
      if (!response.ok || !contentType || !contentType.includes("application/json")) {
        throw new Error("Respuesta no válida del servidor");
      }

      const data = await response.json();
      
      // Verificamos que data exista y tenga la propiedad valid
      if (data && data.valid === true) {
        setIsAuthenticated(true);
      } else {
        console.warn("Sesión inválida");
        localStorage.removeItem('auth_token');
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('Error verificando acceso:', err.message);
      // No borramos el token aquí para evitar bucles si es un error temporal de red
      setIsAuthenticated(false);
    } finally {
      // Importante: Marcar como finalizado para romper el bucle de carga
      setIsVerifying(false);
    }
  }, []);

  useEffect(() => {
    verifyAuth();
    
    // Sincronizar pestañas
    const handleStorageChange = (e) => {
      if (e.key === 'auth_token') verifyAuth();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [verifyAuth]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setIsVerifying(false);
  };

  // Pantalla de carga inicial (Evita el "flash" de login/dashboard)
  if (isVerifying) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Cargando Kareh Salud...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <CustomToaster />
      <div className="flex h-screen w-full bg-slate-50 text-slate-900 overflow-hidden font-sans">
        {isAuthenticated && <Sidebar />}
        
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Routes>
            {/* Rutas Públicas */}
            <Route path="/login" element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage onLoginSuccess={handleLoginSuccess} />
            } />
            
            {/* Rutas Privadas Protegidas */}
            <Route path="/dashboard" element={
              <ProtectedRoute isAuthenticated={isAuthenticated}><DashboardPage /></ProtectedRoute>
            } />
            <Route path="/appointments" element={
              <ProtectedRoute isAuthenticated={isAuthenticated}><AppointmentsPage /></ProtectedRoute>
            } />
            <Route path="/patients" element={
              <ProtectedRoute isAuthenticated={isAuthenticated}><PatientsPage /></ProtectedRoute>
            } />
            <Route path="/clinical-histories" element={
              <ProtectedRoute isAuthenticated={isAuthenticated}><ClinicalHistoriesPage /></ProtectedRoute>
            } />
            <Route path="/clinical-history/:patientId" element={
              <ProtectedRoute isAuthenticated={isAuthenticated}><ClinicalHistoriesPage /></ProtectedRoute>
            } />
            <Route path="/cashflow" element={
              <ProtectedRoute isAuthenticated={isAuthenticated}><CashflowPage /></ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute isAuthenticated={isAuthenticated}><SettingsPage /></ProtectedRoute>
            } />

            {/* Redirección por defecto */}
            <Route path="/" element={
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
            } />
            <Route path="*" element={
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
            } />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;