import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CustomToaster } from './components/Toast';
import AppointmentsPage from './pages/AppointmentsPage';
import CashflowPage from './pages/CashflowPage';
import SettingsPage from './pages/SettingsPage';
import PatientsPage from './pages/PatientsPage';
import ClinicalHistoriesPage from './pages/ClinicalHistoriesPage'; 
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import Sidebar from './components/layout/Sidebar';

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
      // IMPORTANTE: Aseguramos que llame a /api/auth/verify
      const host = window.location.hostname === 'localhost' 
        ? 'http://localhost:10000/api' 
        : 'https://kareh-backend.onrender.com/api';
      
      const response = await fetch(`${host}/auth/verify`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      // Si el servidor responde con HTML o error, lanzamos error
      const contentType = response.headers.get("content-type");
      if (!response.ok || !contentType || !contentType.includes("application/json")) {
        throw new Error("Sesión inválida");
      }

      const data = await response.json();
      setIsAuthenticated(!!data.valid);
      if (!data.valid) localStorage.removeItem('auth_token');

    } catch (err) {
      console.error('Auth error:', err.message);
      setIsAuthenticated(false);
      localStorage.removeItem('auth_token');
    } finally {
      setIsVerifying(false);
    }
  }, []);

  useEffect(() => {
    verifyAuth();
  }, [verifyAuth]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  if (isVerifying) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Router>
      <CustomToaster />
      <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
        {isAuthenticated && <Sidebar />}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Routes>
            {!isAuthenticated ? (
              <>
                <Route path="/login" element={<LoginPage onLoginSuccess={handleLoginSuccess} />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </>
            ) : (
              <>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/appointments" element={<AppointmentsPage />} />
                <Route path="/patients" element={<PatientsPage />} />
                <Route path="/clinical-histories" element={<ClinicalHistoriesPage />} />
                <Route path="/clinical-history/:patientId" element={<ClinicalHistoriesPage />} />
                <Route path="/cashflow" element={<CashflowPage />} />
                <Route path="/settings" element={<SettingsPage />} />
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