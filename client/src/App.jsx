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
import NotesPage from './pages/NotesPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import Sidebar from './components/layout/Sidebar';
import api from './services/api';
import { initializeCsrf } from './services/csrf';
import { clearClientSession } from './services/session';
import { APP_ROUTES, getDocumentTitle } from './utils/appRoutes';
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';

const isMobileViewport = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 1023px)').matches;
};

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
  const [mobileViewport, setMobileViewport] = useState(isMobileViewport);
  const [sidebarOpen, setSidebarOpen] = useState(() => !isMobileViewport());

  const verifyAuth = useCallback(async () => {
    let validSession = false;

    try {
      const response = await api.get('/auth/verify');
      validSession = Boolean(response.data?.valid);
    } catch {
      // Si el token expira, el interceptor de axios intentará refrescarlo.
      // Si aún así falla, no será válido.
    }

    if (validSession) {
      setIsAuthenticated(true);
    } else {
      clearClientSession();
      setIsAuthenticated(false);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    initializeCsrf();
    verifyAuth();
  }, [verifyAuth]);

  useEffect(() => {
    const handleResize = () => {
      const nextIsMobile = isMobileViewport();
      setMobileViewport(nextIsMobile);
      setSidebarOpen((prev) => {
        if (nextIsMobile) return false;
        return prev || true;
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const intervalId = setInterval(() => {
      api.post('/auth/refresh', null, { headers: { 'X-Auth-Fallback': '1' } }).catch(() => {
        // Ignorar errores, se manejarán al intentar usar la app.
      });
    }, 10 * 60 * 1000); // refrescar cada 10 minutos

    return () => clearInterval(intervalId);
  }, [isAuthenticated]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  if (loading) return null;

  return (
    <Router>
      <DocumentTitleSync />
      <CustomToaster />
      <div className="flex min-h-dvh w-full bg-slate-50 overflow-hidden">
        {isAuthenticated && sidebarOpen && (
          <Sidebar
            onToggle={toggleSidebar}
            onLogout={() => setIsAuthenticated(false)}
            onNavigate={() => {
              if (mobileViewport) setSidebarOpen(false);
            }}
            isMobile={mobileViewport}
          />
        )}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {isAuthenticated && mobileViewport && !sidebarOpen && (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Mostrar menú lateral"
              aria-expanded={sidebarOpen}
              className="fixed left-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg transition hover:bg-slate-800"
            >
              <Menu size={18} />
            </button>
          )}
          {isAuthenticated && !mobileViewport && !sidebarOpen && (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Mostrar menú lateral"
              aria-expanded={sidebarOpen}
              className="fixed left-0 top-1/2 z-40 flex h-10 w-6 -translate-y-1/2 items-center justify-center rounded-r-md bg-slate-900/70 text-white shadow-md transition hover:bg-slate-900"
            >
              <ChevronRight size={18} />
            </button>
          )}
          {isAuthenticated && mobileViewport && sidebarOpen && (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Ocultar menú lateral"
              className="fixed right-4 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/95 text-slate-900 shadow-lg ring-1 ring-slate-200 transition hover:bg-white"
            >
              <ChevronLeft size={18} />
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
                <Route path={APP_ROUTES.notes} element={<NotesPage />} />
                <Route path={APP_ROUTES.whatsapp} element={<WhatsAppPage />} />
                <Route path={APP_ROUTES.settings} element={<SettingsPage />} />

                <Route path="/dashboard" element={<Navigate to={APP_ROUTES.dashboard} replace />} />
                <Route path="/appointments" element={<Navigate to={APP_ROUTES.appointments} replace />} />
                <Route path="/patients" element={<Navigate to={APP_ROUTES.patients} replace />} />
                <Route path="/clinical-histories" element={<Navigate to={APP_ROUTES.clinicalHistories} replace />} />
                <Route path="/clinical-history/:legacyPatientId" element={<ClinicalHistoryPage />} />
                <Route path="/cashflow" element={<Navigate to={APP_ROUTES.cashflow} replace />} />
                <Route path="/notes" element={<Navigate to={APP_ROUTES.notes} replace />} />
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
