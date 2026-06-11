import React, { lazy, Suspense, useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { CustomToaster } from './components/Toast';
import Sidebar from './components/layout/Sidebar';
import RequireRole from './components/auth/RequireRole';
import api from './services/api';
import { bootstrapAuthSession } from './services/authBootstrap';
import { getStoredUser } from './services/session';
import { registerServiceWorker, subscribeToPushNotifications, playNotificationSound } from './services/notifications';
import { APP_ROUTES, getDocumentTitle } from './utils/appRoutes';
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';

const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'));
const CashflowPage = lazy(() => import('./pages/CashflowPage'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const CapacityPage = lazy(() => import('./pages/CapacityPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const PatientsPage = lazy(() => import('./pages/PatientsPage'));
const ClinicalHistoriesPage = lazy(() => import('./pages/ClinicalHistoriesPage'));
const ClinicalHistoryPage = lazy(() => import('./pages/ClinicalHistoryPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const WhatsAppPage = lazy(() => import('./pages/WhatsAppPage'));
const ObrasSocialesPage = lazy(() => import('./pages/ObrasSocialesPage'));
const NotesPage = lazy(() => import('./pages/NotesPage'));
const AuditoriaPage = lazy(() => import('./pages/AuditoriaPage'));
const AutorizacionesPage = lazy(() => import('./pages/AutorizacionesPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));

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

function AppBootSplash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.18),transparent_45%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-6">
      <div className="w-full max-w-sm rounded-4xl border border-white/70 bg-white/85 p-8 text-center shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/35 border-t-white" />
        </div>
        <p className="mt-6 text-[11px] font-black uppercase tracking-[0.3em] text-teal-600">
          Agenda Kareh
        </p>
        <h1 className="mt-3 text-2xl font-black text-slate-900">
          Preparando panel
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Verificando tu sesión y cargando la interfaz.
        </p>
      </div>
    </div>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(true);
  const [mobileViewport, setMobileViewport] = useState(isMobileViewport);
  const [sidebarOpen, setSidebarOpen] = useState(() => !isMobileViewport());

  useEffect(() => {
    let isMounted = true;

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const session = await bootstrapAuthSession();
          if (!isMounted) return;

          setCurrentUser(session.user);
          setIsAuthenticated(session.isAuthenticated);
        } finally {
          if (isMounted) setLoading(false);
        }
      })();
    }, 0);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const nextIsMobile = isMobileViewport();
      setMobileViewport((currentIsMobile) => {
        setSidebarOpen((currentSidebarOpen) => {
          if (nextIsMobile) return false;
          return currentIsMobile ? true : currentSidebarOpen;
        });

        return nextIsMobile;
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const intervalId = setInterval(() => {
      api.post('/auth/refresh').catch(() => {
        // Ignorar errores, se manejarán al intentar usar la app.
      });
    }, 6 * 60 * 60 * 1000); // refrescar cada 6 horas

    return () => clearInterval(intervalId);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Registrar Service Worker y Suscribirse a Notificaciones Push
    void (async () => {
      await registerServiceWorker();
      await subscribeToPushNotifications();
    })();

    // Escuchar mensajes del Service Worker
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'PUSH_NOTIFICATION') {
        playNotificationSound();
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const shouldLockViewport = isAuthenticated && mobileViewport && sidebarOpen;
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    if (shouldLockViewport) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [isAuthenticated, mobileViewport, sidebarOpen]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  if (loading) return <AppBootSplash />;

  return (
    <Router>
      <DocumentTitleSync />
      <CustomToaster />
      <div className="flex min-h-dvh w-full bg-slate-50 overflow-hidden">
        {isAuthenticated && sidebarOpen && (
          <Sidebar
            onToggle={toggleSidebar}
            onLogout={() => {
              setCurrentUser(getStoredUser());
              setIsAuthenticated(false);
            }}
            onNavigate={() => {
              if (mobileViewport) setSidebarOpen(false);
            }}
            isMobile={mobileViewport}
          />
        )}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
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
              className="fixed right-4 top-4 z-90 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/95 text-slate-900 shadow-lg ring-1 ring-slate-200 transition hover:bg-white"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <Suspense fallback={<AppBootSplash />}>
            <Routes>
              <Route path={APP_ROUTES.privacy} element={<PrivacyPolicyPage />} />
              {!isAuthenticated ? (
                <>
                  <Route path={APP_ROUTES.login} element={<LoginPage onLoginSuccess={() => {
                    setCurrentUser(getStoredUser());
                    setIsAuthenticated(true);
                  }} />} />
                  <Route path="/login" element={<Navigate to={APP_ROUTES.login} replace />} />
                  <Route path="*" element={<Navigate to={APP_ROUTES.login} replace />} />
                </>
              ) : (
                <>
                  <Route path="/" element={<Navigate to={APP_ROUTES.dashboard} replace />} />
                  <Route path={APP_ROUTES.dashboard} element={<DashboardPage />} />
                  <Route
                    path={APP_ROUTES.appointments}
                    element={(
                      <RequireRole role={currentUser?.role} roles={['SUPER_USER', 'ADMIN', 'PROFESSIONAL', 'SECRETARIA']}>
                        <AppointmentsPage />
                      </RequireRole>
                    )}
                  />
                  <Route
                    path={APP_ROUTES.patients}
                    element={(
                      <RequireRole role={currentUser?.role} roles={['SUPER_USER', 'ADMIN', 'PROFESSIONAL', 'SECRETARIA']}>
                        <PatientsPage />
                      </RequireRole>
                    )}
                  />
                  <Route
                    path={APP_ROUTES.clinicalHistories}
                    element={(
                      <RequireRole role={currentUser?.role} roles={['SUPER_USER', 'ADMIN', 'PROFESSIONAL']}>
                        <ClinicalHistoriesPage />
                      </RequireRole>
                    )}
                  />
                  <Route
                    path={`${APP_ROUTES.clinicalHistoryDetailBase}/:patientSlug`}
                    element={(
                      <RequireRole role={currentUser?.role} roles={['SUPER_USER', 'ADMIN', 'PROFESSIONAL']}>
                        <ClinicalHistoryPage />
                      </RequireRole>
                    )}
                  />
                  <Route
                    path={APP_ROUTES.cashflow}
                    element={(
                      <RequireRole role={currentUser?.role} roles={['SUPER_USER', 'ADMIN', 'SECRETARIA']}>
                        <CashflowPage />
                      </RequireRole>
                    )}
                  />
                  <Route
                    path={APP_ROUTES.billing}
                    element={(
                      <RequireRole role={currentUser?.role} roles={['SUPER_USER', 'ADMIN', 'SECRETARIA']}>
                        <BillingPage />
                      </RequireRole>
                    )}
                  />
                  <Route
                    path={APP_ROUTES.capacity}
                    element={(
                      <RequireRole role={currentUser?.role} roles={['SUPER_USER', 'ADMIN', 'PROFESSIONAL', 'SECRETARIA']}>
                        <CapacityPage />
                      </RequireRole>
                    )}
                  />
                  <Route
                    path={APP_ROUTES.notes}
                    element={(
                      <RequireRole role={currentUser?.role} roles={['SUPER_USER', 'ADMIN']}>
                        <NotesPage />
                      </RequireRole>
                    )}
                  />
                  <Route
                    path={APP_ROUTES.whatsapp}
                    element={(
                      <RequireRole role={currentUser?.role} roles={['SUPER_USER', 'ADMIN']}>
                        <WhatsAppPage />
                      </RequireRole>
                    )}
                  />
                  <Route
                    path={APP_ROUTES.settings}
                    element={(
                      <RequireRole role={currentUser?.role} roles={['SUPER_USER', 'ADMIN']}>
                        <SettingsPage />
                      </RequireRole>
                    )}
                  />
                  <Route
                    path={APP_ROUTES.obrasSociales}
                    element={(
                      <RequireRole role={currentUser?.role} roles={['SUPER_USER', 'ADMIN']}>
                        <ObrasSocialesPage />
                      </RequireRole>
                    )}
                  />
                  <Route
                    path={APP_ROUTES.audit}
                    element={(
                      <RequireRole role={currentUser?.role} roles={['SUPER_USER', 'ADMIN']}>
                        <AuditoriaPage />
                      </RequireRole>
                    )}
                  />
                  <Route
                    path={APP_ROUTES.authorizations}
                    element={(
                      <RequireRole role={currentUser?.role} roles={['SUPER_USER', 'ADMIN']}>
                        <AutorizacionesPage />
                      </RequireRole>
                    )}
                  />

                  <Route path="/dashboard" element={<Navigate to={APP_ROUTES.dashboard} replace />} />
                  <Route path="/appointments" element={<Navigate to={APP_ROUTES.appointments} replace />} />
                  <Route path="/patients" element={<Navigate to={APP_ROUTES.patients} replace />} />
                  <Route path="/clinical-histories" element={<Navigate to={APP_ROUTES.clinicalHistories} replace />} />
                  <Route
                    path="/clinical-history/:legacyPatientId"
                    element={(
                      <RequireRole role={currentUser?.role} roles={['SUPER_USER', 'ADMIN', 'PROFESSIONAL']}>
                        <ClinicalHistoryPage />
                      </RequireRole>
                    )}
                  />
                  <Route path="/cashflow" element={<Navigate to={APP_ROUTES.cashflow} replace />} />
                  <Route path="/billing" element={<Navigate to={APP_ROUTES.billing} replace />} />
                  <Route path="/capacity" element={<Navigate to={APP_ROUTES.capacity} replace />} />
                  <Route path="/inteligencia/capacidad" element={<Navigate to={APP_ROUTES.capacity} replace />} />
                  <Route path="/notes" element={<Navigate to={APP_ROUTES.notes} replace />} />
                  <Route path="/whatsapp" element={<Navigate to={APP_ROUTES.whatsapp} replace />} />
                  <Route path="/obras-sociales" element={<Navigate to={APP_ROUTES.obrasSociales} replace />} />
                  <Route path="/auditoria" element={<Navigate to={APP_ROUTES.audit} replace />} />
                  <Route path="/autorizaciones" element={<Navigate to={APP_ROUTES.authorizations} replace />} />
                  <Route path="/settings" element={<Navigate to={APP_ROUTES.settings} replace />} />
                  <Route path="*" element={<Navigate to={APP_ROUTES.dashboard} replace />} />
                </>
              )}
            </Routes>
          </Suspense>
        </main>
      </div>
    </Router>
  );
}

export default App;
