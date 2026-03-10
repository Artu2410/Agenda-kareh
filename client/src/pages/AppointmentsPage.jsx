import React, { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, addDays, subDays, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2, UserRound, CalendarClock } from 'lucide-react';
import WeeklyCalendarGrid from '../components/agenda/WeeklyCalendarGrid';
import AppointmentModal from '../components/AppointmentModal';
import api from '../services/api'; 
import toast from 'react-hot-toast';

const AppointmentsPage = () => {
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState('');

  const selectedProfessional = professionals.find((professional) => professional.id === selectedProfessionalId) || null;
  const selectedWorkSchedule = selectedProfessional?.workSchedule || [];

  const fetchProfessionals = useCallback(async () => {
    try {
      const response = await api.get('/professionals');
      const list = response.data || [];
      setProfessionals(list);

      if (!list.length) {
        setSelectedProfessionalId('');
        return;
      }

      const activeProfessional = list.find((professional) => professional.isActive);
      const fallbackProfessional = activeProfessional || list[0];

      setSelectedProfessionalId((currentId) => {
        const exists = list.some((professional) => professional.id === currentId);
        return exists ? currentId : fallbackProfessional.id;
      });
    } catch (error) {
      console.error('Error fetching professionals:', error);
      toast.error('No se pudo cargar el staff profesional');
    }
  }, []);

  const fetchAppointments = useCallback(async (week) => {
    if (!week || !isValid(week)) return;
    setLoading(true);
    try {
      const startDate = format(week, 'yyyy-MM-dd');
      const endDate = format(addDays(week, 6), 'yyyy-MM-dd');
      
      const response = await api.get('/appointments/week', {
        params: {
          startDate,
          endDate,
          ...(selectedProfessionalId ? { professionalId: selectedProfessionalId } : {})
        }
      });
      
      setAppointments(response.data || []);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      toast.error("Error al cargar agenda");
    } finally { setLoading(false); }
  }, [selectedProfessionalId]);

  useEffect(() => {
    fetchProfessionals();
  }, [fetchProfessionals]);

  useEffect(() => {
    if (!selectedProfessionalId && professionals.length) return;
    fetchAppointments(currentWeek);
  }, [currentWeek, fetchAppointments, selectedProfessionalId, professionals.length]);

  const refreshAppointments = useCallback(() => {
    fetchAppointments(currentWeek);
  }, [currentWeek, fetchAppointments]);

  const handleSlotClick = (data) => {
    if (data?.id) { setSelectedAppointment(data); setSelectedSlot(null); }
    else { setSelectedSlot(data); setSelectedAppointment(null); }
    setIsAppointmentModalOpen(true);
  };

  const handleModalSave = () => {
    refreshAppointments();
    setIsAppointmentModalOpen(false);
  };

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
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <UserRound size={16} className="text-teal-600" />
            <select
              value={selectedProfessionalId}
              onChange={(e) => setSelectedProfessionalId(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none"
            >
              {!professionals.length && <option value="">Sin profesionales</option>}
              {professionals.map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professional.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4">
        {selectedProfessional && selectedWorkSchedule.length === 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            <CalendarClock size={18} />
            {selectedProfessional.fullName} todavía no tiene horarios configurados. Define días y franjas desde Configuración para que la agenda respete su disponibilidad.
          </div>
        )}

        {loading ? <div className="flex justify-center h-full items-center"><Loader2 className="animate-spin text-teal-500" size={40}/></div> : (
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <WeeklyCalendarGrid
              currentDate={currentWeek}
              onSlotClick={handleSlotClick}
              appointments={appointments}
              workSchedule={selectedWorkSchedule}
              selectedProfessional={selectedProfessional}
            />
          </div>
        )}
      </main>

      {isAppointmentModalOpen && (
        <AppointmentModal
          isOpen={isAppointmentModalOpen}
          onClose={() => setIsAppointmentModalOpen(false)}
          selectedSlot={selectedSlot}
          appointment={selectedAppointment}
          professional={selectedProfessional}
          onSave={handleModalSave}
          onDelete={handleModalSave}
          onRefresh={refreshAppointments}
        />
      )}
    </div>
  );
};

export default AppointmentsPage;
