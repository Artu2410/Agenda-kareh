import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CustomToaster } from './components/Toast';

// Importa tus páginas
import AppointmentsPage from './pages/AppointmentsPage';
import CashflowPage from './pages/CashflowPage';
import SettingsPage from './pages/SettingsPage';
import PatientsPage from './pages/PatientsPage';
import ClinicalHistoriesPage from './pages/ClinicalHistoriesPage'; 
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import Sidebar from './components/layout/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';

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
          'Accept': 'application/json'
        }
      });

      // Si el servidor nos manda HTML (un error de Render/Vercel), lo ignoramos
      const contentType = response.headers.get("content-type");
      if (!response.ok || !contentType || !contentType.includes("application/json")) {
        throw new Error("Respuesta no válida del servidor");
      }

      const data = await response.json();
      setIsAuthenticated(!!data.valid);
      
      if (!data.valid) localStorage.removeItem('auth_token');

    } catch (err) {
      console.error('Error de verificación:', err);
      setIsAuthenticated(false);
    } finally {
      setIsVerifying(false); // IMPORTANTE: Solo aquí termina la carga
    }
  }, []);

  useEffect(() => {
    verifyAuth();
  }, [verifyAuth]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setIsVerifying(false);
  };

  // 1. MIENTRAS VERIFICA: Pantalla de carga limpia para evitar el bucle
  if (isVerifying) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // 2. RENDERIZADO FINAL
  return (
    <Router>
      <CustomToaster />
      <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
        {isAuthenticated && <Sidebar />}
        
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Routes>
            {/* Si NO estoy autenticado, solo puedo ver Login */}
            {!isAuthenticated ? (
              <>
                <Route path="/login" element={<LoginPage onLoginSuccess={handleLoginSuccess} />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </>
            ) : (
              /* Si SÍ estoy autenticado, estas son mis rutas */
              <>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/appointments" element={<AppointmentsPage />} />
                <Route path="/patients" element={<PatientsPage />} />
                <Route path="/clinical-histories" element={<ClinicalHistoriesPage />} />
                <Route path="/clinical-history/:patientId" element={<ClinicalHistoriesPage />} />
                <Route path="/cashflow" element={<CashflowPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </>
            )}
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;