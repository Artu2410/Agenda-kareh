import React, { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, addDays, subDays, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Loader2, FileDown } from 'lucide-react';
import WeeklyCalendarGrid from '../components/agenda/WeeklyCalendarGrid';
import AppointmentModal from '../components/AppointmentModal';
import EvolutionModal from '../components/agenda/EvolutionModal';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { exportWeeklyAppointmentsToExcel } from '../utils/exportToExcel';

const AppointmentsPage = () => {
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isEvolutionModalOpen, setIsEvolutionModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  const fetchAppointments = useCallback(async (week) => {
    if (!week || !isValid(week)) return;
    setLoading(true);
    try {
      const startDate = format(week, 'yyyy-MM-dd');
      const endDate = format(addDays(week, 6), 'yyyy-MM-dd');
      const response = await api.get(`/appointments/week?startDate=${startDate}&endDate=${endDate}`);
      setAppointments(response.data || []);
    } catch (error) {
      toast.error("No se pudieron cargar los turnos");
      setAppointments([]); 
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments(currentWeek);
  }, [currentWeek, fetchAppointments]);

  const handleSlotClick = (slotOrAppointment) => {
    if (slotOrAppointment?.id) {
      setSelectedAppointment(slotOrAppointment);
      setSelectedSlot(null);
    } else {
      setSelectedSlot(slotOrAppointment);
      setSelectedAppointment(null);
    }
    setIsAppointmentModalOpen(true);
  };

  const handleCloseModals = () => {
    setIsAppointmentModalOpen(false);
    setIsEvolutionModalOpen(false);
    setSelectedSlot(null);
    setSelectedAppointment(null);
  };

  const refreshData = () => {
    fetchAppointments(currentWeek);
    handleCloseModals();
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden">
      <header className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black text-slate-800 tracking-tight uppercase italic">Agenda Semanal</h1>
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button onClick={() => setCurrentWeek(subDays(currentWeek, 7))} className="p-1.5 hover:bg-white rounded-md transition-all">
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-sm font-bold text-slate-700 min-w-[140px] text-center capitalize">
              {format(currentWeek, 'MMMM yyyy', { locale: es })}
            </h2>
            <button onClick={() => setCurrentWeek(addDays(currentWeek, 7))} className="p-1.5 hover:bg-white rounded-md transition-all">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              if (appointments.length === 0) {
                toast.error('No hay turnos para exportar');
                return;
              }
              try {
                await exportWeeklyAppointmentsToExcel(appointments, currentWeek);
                toast.success('✅ Agenda exportada a Excel');
              } catch (err) {
                console.error('Error exportando agenda:', err);
                toast.error('Error al exportar agenda');
              }
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 px-4 rounded-xl flex items-center gap-2 transition-all shadow-md text-sm uppercase"
            title="Exportar agenda a Excel"
          >
            <FileDown size={18} /> Exportar
          </button>
          <button
            onClick={() => handleSlotClick(null)}
            className="bg-teal-600 hover:bg-teal-700 text-white font-black py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all shadow-md text-sm uppercase"
          >
            <Plus size={18} /> Nuevo Turno
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="text-teal-500 animate-spin" size={40} /></div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <WeeklyCalendarGrid currentDate={currentWeek} onSlotClick={handleSlotClick} appointments={appointments} />
          </div>
        )}
      </main>

      {isAppointmentModalOpen && (
        <AppointmentModal
          isOpen={isAppointmentModalOpen}
          onClose={handleCloseModals}
          selectedSlot={selectedSlot}
          appointment={selectedAppointment}
          onSave={refreshData}
          onDelete={refreshData}
        />
      )}
    </div>
  );
};

export default AppointmentsPage;