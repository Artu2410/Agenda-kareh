import React, { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, addDays, subDays, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Loader2, FileDown } from 'lucide-react';
import WeeklyCalendarGrid from '../components/agenda/WeeklyCalendarGrid';
import AppointmentModal from '../components/AppointmentModal';
import api from '../services/api'; 
import toast from 'react-hot-toast';
import { exportWeeklyAppointmentsToExcel } from '../utils/exportToExcel';

const AppointmentsPage = () => {
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  const fetchAppointments = useCallback(async (week) => {
    if (!week || !isValid(week)) return;
    setLoading(true);
    try {
      const startDate = format(week, 'yyyy-MM-dd');
      const endDate = format(addDays(week, 6), 'yyyy-MM-dd');
      
      // CAMBIO: Aseguramos que la petición use params limpios hacia /api/appointments/week
      const response = await api.get('/appointments/week', {
        params: { startDate, endDate }
      });
      
      setAppointments(response.data || []);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      toast.error("Error al cargar agenda");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAppointments(currentWeek); }, [currentWeek, fetchAppointments]);

  const handleSlotClick = (data) => {
    if (data?.id) { setSelectedAppointment(data); setSelectedSlot(null); }
    else { setSelectedSlot(data); setSelectedAppointment(null); }
    setIsAppointmentModalOpen(true);
  };

  const refreshData = () => { fetchAppointments(currentWeek); setIsAppointmentModalOpen(false); };

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden">
      <header className="p-4 bg-white border-b flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black text-slate-800 italic uppercase">Agenda Semanal</h1>
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button onClick={() => setCurrentWeek(subDays(currentWeek, 7))} className="p-1.5 hover:bg-white rounded-md"><ChevronLeft size={18} /></button>
            <h2 className="text-sm font-bold px-4 capitalize">{format(currentWeek, 'MMMM yyyy', { locale: es })}</h2>
            <button onClick={() => setCurrentWeek(addDays(currentWeek, 7))} className="p-1.5 hover:bg-white rounded-md"><ChevronRight size={18} /></button>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => exportWeeklyAppointmentsToExcel(appointments, currentWeek)} className="bg-emerald-600 text-white py-2 px-4 rounded-xl text-sm font-bold uppercase flex items-center gap-2"><FileDown size={16}/> Exportar</button>
          <button onClick={() => handleSlotClick(null)} className="bg-teal-600 text-white py-2 px-5 rounded-xl text-sm font-bold uppercase flex items-center gap-2"><Plus size={16}/> Nuevo Turno</button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4">
        {loading ? <div className="flex justify-center h-full items-center"><Loader2 className="animate-spin text-teal-500" size={40}/></div> : (
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <WeeklyCalendarGrid currentDate={currentWeek} onSlotClick={handleSlotClick} appointments={appointments} />
          </div>
        )}
      </main>

      {isAppointmentModalOpen && (
        <AppointmentModal isOpen={isAppointmentModalOpen} onClose={() => setIsAppointmentModalOpen(false)} selectedSlot={selectedSlot} appointment={selectedAppointment} onSave={refreshData} onDelete={refreshData} />
      )}
    </div>
  );
};

export default AppointmentsPage;