import React from 'react';
import { BarChart3, Calendar, Users, DollarSign, Settings, FileText, LogOut } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { showSuccessToast } from '../Toast';
import { useConfirmModal } from '../ConfirmModal';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { ConfirmModalComponent, openModal } = useConfirmModal();
  const menuItems = [
    { icon: BarChart3, label: 'Dashboard', path: '/dashboard' },
    { icon: Calendar, label: 'Turnos', path: '/appointments' },
    { icon: Users, label: 'Pacientes', path: '/patients' },
    { icon: FileText, label: 'Historia Clínica', path: '/clinical-histories' },
    { icon: DollarSign, label: 'Caja', path: '/cashflow' },
    { icon: Settings, label: 'Configuración', path: '/settings' },
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
          window.location.href = '/';
        }, 500);
      },
    });
  };

  const userName = localStorage.getItem('user_name') || 'Admin';
  const userEmail = localStorage.getItem('user_email') || 'user@example.com';

  return (
    <>
    <aside className="w-64 bg-slate-900 text-white h-screen flex flex-col shadow-xl">
      <div className="p-6 text-center border-b border-slate-800">
        <h1 className="text-2xl font-bold text-teal-400 tracking-tight">KAREH PRO</h1>
        <p className="text-[10px] text-slate-500 uppercase font-black mt-1">Centro de Kinesiología</p>
      </div>
      
<nav className="flex-1 mt-6 px-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
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
