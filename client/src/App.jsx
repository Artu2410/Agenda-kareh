import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CustomToaster } from './components/Toast';
import AppointmentsPage from './pages/AppointmentsPage';
import CashflowPage from './pages/CashflowPage';
import SettingsPage from './pages/SettingsPage';
import PatientsPage from './pages/PatientsPage';
import ClinicalHistoriesPage from './pages/ClinicalHistoriesPage'; 
import ClinicalHistoryPage from './pages/ClinicalHistoryPage'; // Importación singular
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import Sidebar from './components/layout/Sidebar';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const verifyAuth = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) { setIsAuthenticated(false); setLoading(false); return; }
    try {
      const host = window.location.hostname === 'localhost' 
        ? 'http://localhost:10000/api' 
        : 'https://kareh-backend.onrender.com/api';
      const response = await fetch(`${host}/auth/verify`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await response.json();
      setIsAuthenticated(!!data.valid);
    } catch (err) { setIsAuthenticated(false); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { verifyAuth(); }, [verifyAuth]);

  if (loading) return null;

  return (
    <Router>
      <CustomToaster />
      <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
        {isAuthenticated && <Sidebar />}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Routes>
            {!isAuthenticated ? (
              <>
                <Route path="/login" element={<LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </>
            ) : (
              <Route path="/">
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="appointments" element={<AppointmentsPage />} />
                <Route path="patients" element={<PatientsPage />} />
                <Route path="clinical-histories" element={<ClinicalHistoriesPage />} />
                {/* RUTA DE LA TARJETA */}
                <Route path="clinical-history/:id" element={<ClinicalHistoryPage />} />
                <Route path="cashflow" element={<CashflowPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            )}
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;