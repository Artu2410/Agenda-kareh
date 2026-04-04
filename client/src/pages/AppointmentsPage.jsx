import React, { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, addDays, subDays, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2, UserRound, CalendarClock, Clock } from 'lucide-react';
import WeeklyCalendarGrid from '../components/agenda/WeeklyCalendarGrid';
import SlotTimersPanel from '../components/agenda/SlotTimersPanel';
import AppointmentModal from '../components/AppointmentModal';
import api from '../services/api'; 
import toast from 'react-hot-toast';

const DEFAULT_AGENDA_CONFIG = {
  slotDuration: 30,
  capacityPerSlot: 5,
  timerDurationMinutes: 25,
  timerDurations: [],
};

const AppointmentsPage = () => {
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [agendaConfig, setAgendaConfig] = useState(DEFAULT_AGENDA_CONFIG);

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

  const fetchAgendaConfig = useCallback(async () => {
    try {
      const response = await api.get('/agenda/config');
      setAgendaConfig((previous) => ({
        ...previous,
        ...(response.data || {}),
      }));
    } catch (error) {
      console.error('Error fetching agenda config:', error);
      toast.error('No se pudo cargar la configuración de agenda');
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
    fetchAgendaConfig();
  }, [fetchAgendaConfig]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Actualizar cada minuto
    return () => clearInterval(timer);
  }, []);

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

  const handleModalSave = async () => {
    await refreshAppointments();
    setIsAppointmentModalOpen(false);
  };

  return (
    <div className="flex min-h-dvh min-w-0 flex-col overflow-hidden bg-slate-100">
      <header className="z-10 border-b bg-white px-3 pb-3 pt-16 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            <h1 className="text-xl font-black text-slate-800 italic uppercase">Agenda Semanal</h1>
            <div className="rounded-lg bg-slate-100 px-3 py-1">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-teal-600" />
                <span className="text-sm font-bold text-slate-700">{format(currentTime, 'hh:mm a', { locale: es })}</span>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-100 p-1">
              <button type="button" onClick={() => setCurrentWeek(subDays(currentWeek, 7))} className="rounded-md p-1.5 hover:bg-white"><ChevronLeft size={18} /></button>
              <h2 className="px-4 text-center text-sm font-bold capitalize">{format(currentWeek, 'MMMM yyyy', { locale: es })}</h2>
              <button type="button" onClick={() => setCurrentWeek(addDays(currentWeek, 7))} className="rounded-md p-1.5 hover:bg-white"><ChevronRight size={18} /></button>
            </div>
          </div>
          <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 xl:w-auto">
            <UserRound size={16} className="text-teal-600" />
            <select
              value={selectedProfessionalId}
              onChange={(e) => setSelectedProfessionalId(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-700 outline-none"
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

      <main className="flex-1 overflow-auto p-3 pt-2 sm:p-4">
        <SlotTimersPanel
          currentTime={currentTime}
          appointments={appointments}
          selectedProfessional={selectedProfessional}
          agendaConfig={agendaConfig}
        />

        {selectedProfessional && selectedWorkSchedule.length === 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            <CalendarClock size={18} />
            {selectedProfessional.fullName} todavía no tiene horarios configurados. Define días y franjas desde Configuración para que la agenda respete su disponibilidad.
          </div>
        )}

        {loading ? <div className="flex justify-center h-full items-center"><Loader2 className="animate-spin text-teal-500" size={40}/></div> : (
          <div className="relative min-w-0 overflow-hidden rounded-2xl border bg-white shadow-sm">
            <WeeklyCalendarGrid
              currentDate={currentWeek}
              onSlotClick={handleSlotClick}
              appointments={appointments}
              workSchedule={selectedWorkSchedule}
              selectedProfessional={selectedProfessional}
              currentTime={currentTime}
              capacityPerSlot={agendaConfig.capacityPerSlot}
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
