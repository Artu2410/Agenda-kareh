import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { CustomToaster } from './components/Toast';
import AppointmentsPage from './pages/AppointmentsPage';
import CashflowPage from './pages/CashflowPage';
import SettingsPage from './pages/SettingsPage';
import PatientsPage from './pages/PatientsPage';
import ClinicalHistoriesPage from './pages/ClinicalHistoriesPage'; 
import ClinicalHistoryPage from './pages/ClinicalHistoryPage';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import WhatsAppPage from './pages/WhatsAppPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import Sidebar from './components/layout/Sidebar';
import { API_BASE_URL } from './services/apiBase';
import { initializeCsrf } from './services/csrf';
import { APP_ROUTES, getDocumentTitle } from './utils/appRoutes';
import { ChevronRight } from 'lucide-react';

function DocumentTitleSync() {
  const location = useLocation();

  useEffect(() => {
    document.title = getDocumentTitle(location.pathname);
  }, [location.pathname]);

  return null;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const verifyAuth = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok && data.valid) {
        setIsAuthenticated(true);
        return;
      }

      const fallbackToken = sessionStorage.getItem('auth_fallback_token');
      if (fallbackToken) {
        try {
          const fallbackResponse = await fetch(`${API_BASE_URL}/auth/verify`, {
            credentials: 'include',
            headers: { Authorization: `Bearer ${fallbackToken}` }
          });
          const fallbackData = await fallbackResponse.json();
          if (fallbackResponse.ok && fallbackData.valid) {
            sessionStorage.setItem('auth_fallback', '1');
            setIsAuthenticated(true);
            return;
          }
        } catch {
          // Si falla, seguimos limpiando sesión
        }
      }

      localStorage.removeItem('userEmail');
      localStorage.removeItem('userName');
      sessionStorage.removeItem('auth_fallback');
      sessionStorage.removeItem('auth_fallback_token');
      setIsAuthenticated(false);
    } catch {
      setIsAuthenticated(false);
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    initializeCsrf();
    verifyAuth();
  }, [verifyAuth]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  if (loading) return null;

  return (
    <Router>
      <DocumentTitleSync />
      <CustomToaster />
      <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
        {isAuthenticated && sidebarOpen && <Sidebar onToggle={toggleSidebar} />}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {isAuthenticated && !sidebarOpen && (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Mostrar menú lateral"
              aria-expanded={sidebarOpen}
              className={`fixed top-1/2 z-40 flex h-10 w-6 -translate-y-1/2 items-center justify-center rounded-r-md bg-slate-900/70 text-white shadow-md transition hover:bg-slate-900 ${
                sidebarOpen ? 'left-64 -ml-1' : 'left-0'
              }`}
            >
              <ChevronRight size={18} />
            </button>
          )}
          <Routes>
            <Route path={APP_ROUTES.privacy} element={<PrivacyPolicyPage />} />
            {!isAuthenticated ? (
              <>
                <Route path={APP_ROUTES.login} element={<LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />} />
                <Route path="/login" element={<Navigate to={APP_ROUTES.login} replace />} />
                <Route path="*" element={<Navigate to={APP_ROUTES.login} replace />} />
              </>
            ) : (
              <>
                <Route path="/" element={<Navigate to={APP_ROUTES.dashboard} replace />} />
                <Route path={APP_ROUTES.dashboard} element={<DashboardPage />} />
                <Route path={APP_ROUTES.appointments} element={<AppointmentsPage />} />
                <Route path={APP_ROUTES.patients} element={<PatientsPage />} />
                <Route path={APP_ROUTES.clinicalHistories} element={<ClinicalHistoriesPage />} />
                <Route
                  path={`${APP_ROUTES.clinicalHistoryDetailBase}/:patientSlug`}
                  element={<ClinicalHistoryPage />}
                />
                <Route path={APP_ROUTES.cashflow} element={<CashflowPage />} />
                <Route path={APP_ROUTES.whatsapp} element={<WhatsAppPage />} />
                <Route path={APP_ROUTES.settings} element={<SettingsPage />} />

                <Route path="/dashboard" element={<Navigate to={APP_ROUTES.dashboard} replace />} />
                <Route path="/appointments" element={<Navigate to={APP_ROUTES.appointments} replace />} />
                <Route path="/patients" element={<Navigate to={APP_ROUTES.patients} replace />} />
                <Route path="/clinical-histories" element={<Navigate to={APP_ROUTES.clinicalHistories} replace />} />
                <Route path="/clinical-history/:legacyPatientId" element={<ClinicalHistoryPage />} />
                <Route path="/cashflow" element={<Navigate to={APP_ROUTES.cashflow} replace />} />
                <Route path="/whatsapp" element={<Navigate to={APP_ROUTES.whatsapp} replace />} />
                <Route path="/settings" element={<Navigate to={APP_ROUTES.settings} replace />} />
                <Route path="*" element={<Navigate to={APP_ROUTES.dashboard} replace />} />
              </>
            )}
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
