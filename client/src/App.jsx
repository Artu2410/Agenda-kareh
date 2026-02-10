import React, { useEffect, useState } from 'react';
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

  // Función para verificar el token
  const verifyAuth = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setIsAuthenticated(false);
      setIsVerifying(false);
      return;
    }

    try {
      // URL LIMPIA: Aseguramos que llame a /auth/verify correctamente
      const baseUrl = import.meta.env.VITE_API_URL || 'https://kareh-backend.onrender.com/api';
      const response = await fetch(`${baseUrl}/auth/verify`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json' // Forzamos respuesta JSON
        }
      });

      // Si la respuesta no es OK, el token no sirve
      if (!response.ok) throw new Error('Token inválido');

      const data = await response.json();
      
      if (data.valid) {
        setIsAuthenticated(true);
      } else {
        throw new Error('No válido');
      }
    } catch (err) {
      console.error('Error verifying auth:', err);
      localStorage.removeItem('auth_token');
      setIsAuthenticated(false);
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    verifyAuth();
    
    // Escuchar cambios en el login (por si se loguea en otra pestaña o tras el login)
    window.addEventListener('storage', verifyAuth);
    return () => window.removeEventListener('storage', verifyAuth);
  }, []);

  // Función para refrescar el estado tras el login
  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  if (isVerifying) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-slate-100">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-4 border-teal-200 border-t-teal-600 animate-spin mx-auto"></div>
          <p className="text-slate-600 font-semibold">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <CustomToaster />
      <div className="flex h-screen w-full bg-slate-50 text-slate-900 overflow-hidden font-sans">
        {/* Usamos el ESTADO isAuthenticated para mostrar el Sidebar */}
        {isAuthenticated && <Sidebar />}
        
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Routes>
            <Route path="/login" element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage onLoginSuccess={handleLoginSuccess} />
            } />
            
            <Route path="/" element={
              <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
            } />
            
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/appointments" element={<ProtectedRoute><AppointmentsPage /></ProtectedRoute>} />
            <Route path="/patients" element={<ProtectedRoute><PatientsPage /></ProtectedRoute>} />
            
            <Route path="/clinical-histories" element={<ProtectedRoute><ClinicalHistoriesPage /></ProtectedRoute>} />
            <Route path="/clinical-history/:patientId" element={<ProtectedRoute><ClinicalHistoriesPage /></ProtectedRoute>} />
            
            <Route path="/cashflow" element={<ProtectedRoute><CashflowPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            
            <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;