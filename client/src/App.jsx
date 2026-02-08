import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import AppointmentsPage from './pages/AppointmentsPage';
import CashflowPage from './pages/CashflowPage';
import SettingsPage from './pages/SettingsPage';
import PatientsPage from './pages/PatientsPage';
import ClinicalHistoryPage from './pages/ClinicalHistoryPage';
import ClinicalHistoriesPage from './pages/ClinicalHistoriesPage';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import Sidebar from './components/layout/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';

import { CustomToaster } from './components/Toast';

function App() {
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/verify`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await response.json();
          if (!data.valid) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('userName');
            localStorage.removeItem('userEmail');
          }
        } catch (err) {
          console.error('Error verifying auth:', err);
          localStorage.removeItem('auth_token');
        }
      }
      setIsVerifying(false);
    };

    verifyAuth();
  }, []);

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
        {/* Sidebar solo si hay token */}
        {localStorage.getItem('auth_token') && <Sidebar />}

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Navigate to={localStorage.getItem('auth_token') ? '/dashboard' : '/login'} replace />} />

            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/appointments" element={<ProtectedRoute><AppointmentsPage /></ProtectedRoute>} />
            <Route path="/patients" element={<ProtectedRoute><PatientsPage /></ProtectedRoute>} />
            <Route path="/clinical-histories" element={<ProtectedRoute><ClinicalHistoriesPage /></ProtectedRoute>} />
            <Route path="/clinical-history/:patientId" element={<ProtectedRoute><ClinicalHistoryPage /></ProtectedRoute>} />
            <Route path="/cashflow" element={<ProtectedRoute><CashflowPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
