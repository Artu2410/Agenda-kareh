import React, { useState, useEffect, useCallback } from 'react';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, RefreshCw, Calendar as CalendarIcon } from 'lucide-react';
import WeeklyCalendarGrid from '../components/agenda/WeeklyCalendarGrid';
import AppointmentModal from '../components/AppointmentModal';
import EvolutionModal from '../components/agenda/EvolutionModal';
import api from '@/services/api';

// ✅ Función helper para crear fechas locales sin problemas de zona horaria
const createLocalDate = (year, month, day) => {
  return new Date(year, month - 1, day);
};

// ✅ Función para obtener el inicio de la semana en local time
const getLocalWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay() || 7; // 0=dom, 1=lun... convertir dom a 7
  d.setDate(d.getDate() - (day - 1)); // Restar días para llegar al lunes
  return d;
};

const AppointmentsPage = () => {
  // ✅ Inicializar con la semana actual (lunes)
  const [currentWeek, setCurrentWeek] = useState(getLocalWeekStart(new Date()));
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Estados para Modales
  const [isApptModalOpen, setIsApptModalOpen] = useState(false);
  const [isEvolModalOpen, setIsEvolModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const weekStart = getLocalWeekStart(currentWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const response = await api.get('/appointments/week', {
        params: { 
          startDate: format(weekStart, 'yyyy-MM-dd'),
          endDate: format(weekEnd, 'yyyy-MM-dd')
        }
      });
      setAppointments(response.data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [currentWeek]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleSlotClick = (data) => {
    if (data.id) {
      // Si tiene ID, es un turno existente -> Abrir Evolución
      setSelectedAppointment(data);
      setIsEvolModalOpen(true);
    } else {
      // Si no tiene ID, es un slot vacío -> Abrir Nuevo Turno
      setSelectedSlot(data);
      setIsApptModalOpen(true);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <header className="p-4 bg-white border-b flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarIcon className="text-teal-600" /> Agenda
          </h1>
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button onClick={() => {
              const prev = new Date(currentWeek);
              prev.setDate(prev.getDate() - 7);
              setCurrentWeek(getLocalWeekStart(prev));
            }} className="p-1.5 hover:bg-white rounded-md transition-all"><ChevronLeft size={18}/></button>
            <span className="px-4 text-sm font-bold capitalize w-40 text-center">
              {format(currentWeek, 'MMMM yyyy', { locale: es })}
            </span>
            <button onClick={() => {
              const next = new Date(currentWeek);
              next.setDate(next.getDate() + 7);
              setCurrentWeek(getLocalWeekStart(next));
            }} className="p-1.5 hover:bg-white rounded-md transition-all"><ChevronRight size={18}/></button>
          </div>
        </div>
        
        <button onClick={fetchAppointments} className={`p-2 ${loading ? 'animate-spin' : ''}`}>
          <RefreshCw size={20} className="text-slate-400" />
        </button>
      </header>

      <main className="flex-1 overflow-auto p-4">
        <WeeklyCalendarGrid 
          currentDate={currentWeek} 
          appointments={appointments} 
          onSlotClick={handleSlotClick}
        />
      </main>

      {isApptModalOpen && (
        <AppointmentModal 
          isOpen={isApptModalOpen} 
          onClose={() => setIsApptModalOpen(false)} 
          selectedSlot={selectedSlot} 
          onSave={fetchAppointments} 
        />
      )}

      {isEvolModalOpen && (
        <EvolutionModal 
          isOpen={isEvolModalOpen} 
          onClose={() => setIsEvolModalOpen(false)} 
          appointment={selectedAppointment} 
          onSave={fetchAppointments} 
        />
      )}
    </div>
  );
};

export default AppointmentsPage;