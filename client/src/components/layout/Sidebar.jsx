import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Calendar, Users, DollarSign, Settings, FileText, LogOut, MessageCircle, ChevronLeft, NotebookPen } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import toast, { showSuccessToast } from '../toastHelpers';
import { useConfirmModal } from '../../hooks/useConfirmModal';
import { APP_ROUTES } from '../../utils/appRoutes';
import api from '../../services/api';
import { clearClientSession, getStoredUser } from '../../services/session';

const SIDEBAR_WEATHER = {
  latitude: -34.5644444444,
  longitude: -58.6911111111,
  timezone: 'America/Argentina/Buenos_Aires',
  label: 'Bella Vista',
};

const getFirstName = (fullName = '') => String(fullName).trim().split(/\s+/)[0] || '';

const getGreeting = (date = new Date(), firstName = '') => {
  const hour = date.getHours();
  const greeting = hour < 12
    ? 'Buenos días'
    : hour < 20
      ? 'Buenas tardes'
      : 'Buenas noches';

  return firstName ? `${greeting}, ${firstName}` : greeting;
};

const Sidebar = ({ onToggle, onLogout, onNavigate, isMobile = false }) => {
  const location = useLocation();
  const { ConfirmModalComponent, openModal } = useConfirmModal();
  const [whatsappUnread, setWhatsappUnread] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState({
    currentTemp: null,
    maxTemp: null,
    minTemp: null,
  });
  const prevUnreadRef = useRef(new Map());
  const initializedRef = useRef(false);
  const canPlaySoundRef = useRef(false);

  const unreadBadgeLabel = useMemo(() => {
    if (whatsappUnread <= 0) return '';
    return whatsappUnread > 99 ? '99+' : String(whatsappUnread);
  }, [whatsappUnread]);

  const menuItems = [
    { icon: BarChart3, label: 'Panel', path: APP_ROUTES.dashboard },
    { icon: Calendar, label: 'Agenda', path: APP_ROUTES.appointments },
    { icon: Users, label: 'Pacientes', path: APP_ROUTES.patients },
    { icon: NotebookPen, label: 'Notas', path: APP_ROUTES.notes },
    { icon: FileText, label: 'Historias Clínicas', path: APP_ROUTES.clinicalHistories },
    { icon: MessageCircle, label: 'WhatsApp', path: APP_ROUTES.whatsapp },
    { icon: DollarSign, label: 'Caja', path: APP_ROUTES.cashflow },
    { icon: Settings, label: 'Configuración', path: APP_ROUTES.settings },
  ];

  const handleLogout = () => {
    openModal({
      title: 'Cerrar sesión',
      message: '¿Estás seguro de que deseas cerrar sesión?',
      confirmText: 'Cerrar',
      danger: true,
      icon: LogOut,
      onConfirm: async () => {
        try {
          await api.post('/auth/logout');
        } catch {
          // Si falla, igual dejamos al cliente sin sesión activa.
        }
        clearClientSession();
        onLogout?.();
        showSuccessToast('Sesión cerrada correctamente');
      },
    });
  };

  const { name: userName, email: userEmail } = getStoredUser();
  const firstName = useMemo(() => getFirstName(userName), [userName]);
  const greetingMessage = useMemo(() => getGreeting(now, firstName), [now, firstName]);
  const temperatureBubble = weather.currentTemp ?? weather.maxTemp;

  const playNotificationSound = () => {
    if (!canPlaySoundRef.current) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.value = 0.04;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
        oscillator.start();
        setTimeout(() => {
          oscillator.stop();
          ctx.close();
        }, 180);
    } catch {
      // Silencioso: algunas plataformas bloquean audio sin interacción previa
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchWeather = async () => {
      try {
        const params = new URLSearchParams({
          latitude: String(SIDEBAR_WEATHER.latitude),
          longitude: String(SIDEBAR_WEATHER.longitude),
          timezone: SIDEBAR_WEATHER.timezone,
          forecast_days: '1',
          current: 'temperature_2m',
          daily: 'temperature_2m_max,temperature_2m_min',
        });

        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
        if (!response.ok) {
          throw new Error('No se pudo cargar el clima');
        }

        const data = await response.json();
        if (!isMounted) return;

        setWeather({
          currentTemp: Number.isFinite(data?.current?.temperature_2m) ? Math.round(data.current.temperature_2m) : null,
          maxTemp: Number.isFinite(data?.daily?.temperature_2m_max?.[0]) ? Math.round(data.daily.temperature_2m_max[0]) : null,
          minTemp: Number.isFinite(data?.daily?.temperature_2m_min?.[0]) ? Math.round(data.daily.temperature_2m_min[0]) : null,
        });
      } catch {
        if (!isMounted) return;
        setWeather({ currentTemp: null, maxTemp: null, minTemp: null });
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const enableSound = () => {
      canPlaySoundRef.current = true;
      window.removeEventListener('click', enableSound);
      window.removeEventListener('keydown', enableSound);
      window.removeEventListener('touchstart', enableSound);
    };
    window.addEventListener('click', enableSound);
    window.addEventListener('keydown', enableSound);
    window.addEventListener('touchstart', enableSound);
    return () => {
      window.removeEventListener('click', enableSound);
      window.removeEventListener('keydown', enableSound);
      window.removeEventListener('touchstart', enableSound);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const pollUnread = async () => {
      try {
        const { data } = await api.get('/whatsapp/conversations');
        const conversations = Array.isArray(data) ? data : [];
        const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
        if (!isMounted) return;

        const prevMap = prevUnreadRef.current;
        const newItems = conversations.filter((conv) => (
          (conv.unreadCount || 0) > (prevMap.get(conv.id) || 0)
        ));

        prevUnreadRef.current = new Map(
          conversations.map((conv) => [conv.id, conv.unreadCount || 0])
        );
        setWhatsappUnread(totalUnread);

        if (!initializedRef.current) {
          initializedRef.current = true;
          return;
        }

        if (newItems.length > 0) {
          const totalNew = newItems.reduce((sum, conv) => {
            const prev = prevMap.get(conv.id) || 0;
            return sum + ((conv.unreadCount || 0) - prev);
          }, 0);
          const primaryName = newItems[0]?.profileName || newItems[0]?.phone || 'WhatsApp';
          const message = totalNew === 1
            ? 'Nuevo mensaje de ' + primaryName
            : 'Nuevos mensajes (' + totalNew + ')';
          toast(message);
          playNotificationSound();
        }
      } catch {
        // Silencioso para no interrumpir la UI
      }
    };

    pollUnread();
    const interval = setInterval(pollUnread, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <div className={isMobile ? 'fixed inset-0 z-40' : 'relative z-20'}>
        {isMobile && (
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-slate-950/50"
            onClick={onToggle}
          />
        )}
        <aside className={`${
          isMobile
            ? 'fixed inset-y-0 left-0 z-50 flex w-[82vw] max-w-xs flex-col bg-slate-900 text-white shadow-2xl'
            : 'flex h-screen w-64 flex-col bg-slate-900 text-white shadow-xl'
        }`}>
        <div className="relative p-5 text-center border-b border-slate-800 sm:p-6">
          <h1 className="text-2xl font-bold text-teal-400 tracking-tight uppercase">Agenda Kareh</h1>
          <p className="text-[10px] text-slate-500 uppercase font-black mt-1">Centro de Kinesiología</p>
        </div>

        <nav className="flex-1 mt-4 px-3 space-y-2 overflow-y-auto sm:mt-6 sm:px-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.path === APP_ROUTES.clinicalHistories
              ? location.pathname.startsWith(APP_ROUTES.clinicalHistories) || location.pathname.startsWith('/clinical-history')
              : location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={20} />
                <span className="font-bold text-sm">{item.label}</span>
                {item.path === APP_ROUTES.whatsapp && whatsappUnread > 0 && (
                  <span className="ml-auto min-w-[22px] h-[22px] px-2 inline-flex items-center justify-center rounded-full bg-red-600 text-[11px] font-black text-white">
                    {unreadBadgeLabel}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-3 sm:p-4">
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              aria-label="Ocultar menú lateral"
              className="w-full flex items-center gap-2 px-4 py-3 rounded-xl transition-all text-slate-400 hover:bg-slate-800 hover:text-white font-bold text-sm"
            >
              <ChevronLeft size={18} />
              <span>{isMobile ? 'Cerrar menú' : 'Ocultar menú'}</span>
            </button>
          )}
          <div className="bg-slate-800/50 p-3 rounded-xl flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center font-black text-sm text-slate-950 shadow-lg shadow-emerald-950/20 shrink-0">
              {temperatureBubble === null ? '--°' : `${temperatureBubble}°`}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-black text-white truncate">{greetingMessage}</p>
              <p className="text-[10px] text-teal-300/90 font-bold uppercase tracking-wider truncate">
                {SIDEBAR_WEATHER.label}
                {weather.maxTemp !== null && weather.minTemp !== null ? ` · ${weather.maxTemp}° / ${weather.minTemp}°` : ''}
              </p>
              <p className="text-[10px] text-slate-500 truncate">{userEmail || userName}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-3 rounded-xl transition-all text-slate-400 hover:bg-red-900/20 hover:text-red-400 font-bold text-sm"
          >
            <LogOut size={18} />
            <span>Cerrar sesión</span>
          </button>
        </div>
        </aside>
      </div>
      {ConfirmModalComponent}
    </>
  );
};

export default Sidebar;
