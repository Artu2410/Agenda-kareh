import React from 'react';
import { BarChart3, Calendar, Users, DollarSign, Settings, FileText, LogOut, MessageCircle, ChevronLeft } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { showSuccessToast } from '../Toast';
import { useConfirmModal } from '../ConfirmModal';
import { APP_ROUTES } from '../../utils/appRoutes';

const Sidebar = ({ onToggle }) => {
  const location = useLocation();
  const { ConfirmModalComponent, openModal } = useConfirmModal();
  const menuItems = [
    { icon: BarChart3, label: 'Panel', path: APP_ROUTES.dashboard },
    { icon: Calendar, label: 'Agenda', path: APP_ROUTES.appointments },
    { icon: Users, label: 'Pacientes', path: APP_ROUTES.patients },
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
        localStorage.removeItem('auth_token');
        localStorage.removeItem('userName');
        localStorage.removeItem('userEmail');
        showSuccessToast('Sesión cerrada correctamente');
        setTimeout(() => {
          window.location.href = APP_ROUTES.login;
        }, 500);
      },
    });
  };

  const userName = localStorage.getItem('user_name') || 'Admin';
  const userEmail = localStorage.getItem('user_email') || 'user@example.com';

  return (
    <>
    <aside className="w-64 bg-slate-900 text-white h-screen flex flex-col shadow-xl">
      <div className="relative p-6 text-center border-b border-slate-800">
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Ocultar menú lateral"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-800/80 hover:text-white"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <h1 className="text-2xl font-bold text-teal-400 tracking-tight uppercase">Agenda Kareh</h1>
        <p className="text-[10px] text-slate-500 uppercase font-black mt-1">Centro de Kinesiología</p>
      </div>
      
<nav className="flex-1 mt-6 px-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.path === APP_ROUTES.clinicalHistories
            ? location.pathname.startsWith(APP_ROUTES.clinicalHistories) || location.pathname.startsWith('/clinical-history')
            : location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive 
                  ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span className="font-bold text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-3">
        <div className="bg-slate-800/50 p-3 rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center font-bold text-sm">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-xs font-bold truncate">{userName}</p>
            <p className="text-[10px] text-slate-500 truncate">{userEmail}</p>
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
    {ConfirmModalComponent}
    </>
  );
};

export default Sidebar;
