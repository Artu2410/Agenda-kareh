import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, startOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, addMonths, subWeeks, subMonths, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2, UserRound, CalendarClock, Clock, Banknote } from 'lucide-react';
import WeeklyCalendarGrid from '../components/agenda/WeeklyCalendarGrid';
import MonthlyCalendarGrid from '../components/agenda/MonthlyCalendarGrid';
import SlotTimersPanel from '../components/agenda/SlotTimersPanel';
import AppointmentModal from '../components/AppointmentModal';
import api from '../services/api'; 
import toast from 'react-hot-toast';
import { getCoverageLabel } from '../utils/coverage';

const isMobileAgendaViewport = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches;
};

const DEFAULT_AGENDA_CONFIG = {
  slotDuration: 30,
  capacityPerSlot: 5,
  timerDurationMinutes: 25,
  timerDurations: [],
};

const VIEW_MODE = {
  week: 'week',
  month: 'month',
};

const getRangeForView = (date, viewMode) => {
  if (viewMode === VIEW_MODE.month) {
    return {
      startDate: startOfMonth(date),
      endDate: endOfMonth(date),
    };
  }

  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  return {
    startDate: weekStart,
    endDate: addDays(weekStart, 6),
  };
};

const AppointmentsPage = () => {
  const [viewMode, setViewMode] = useState(VIEW_MODE.week);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [agendaConfig, setAgendaConfig] = useState(DEFAULT_AGENDA_CONFIG);
  const [mobileAgendaViewport, setMobileAgendaViewport] = useState(isMobileAgendaViewport);

  const selectedProfessional = professionals.find((professional) => professional.id === selectedProfessionalId) || null;
  const selectedWorkSchedule = selectedProfessional?.workSchedule || [];
  const currentWeek = useMemo(
    () => startOfWeek(currentDate, { weekStartsOn: 1 }),
    [currentDate]
  );
  const viewTitle = viewMode === VIEW_MODE.month ? 'Agenda Mensual' : 'Agenda Semanal';
  const currentRangeLabel = useMemo(() => {
    if (viewMode === VIEW_MODE.month) {
      return format(currentDate, 'MMMM yyyy', { locale: es });
    }

    const rangeEnd = addDays(currentWeek, 6);
    return `${format(currentWeek, 'd MMM', { locale: es })} - ${format(rangeEnd, 'd MMM yyyy', { locale: es })}`;
  }, [currentDate, currentWeek, viewMode]);

  const mobileDayAppointments = useMemo(() => (
    appointments
      .filter((appointment) => format(new Date(appointment.date), 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd'))
      .sort((a, b) => `${a.time}-${a.slotNumber}`.localeCompare(`${b.time}-${b.slotNumber}`))
  ), [appointments, currentDate]);

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
    } catch {
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
    } catch {
      toast.error('No se pudo cargar la configuración de agenda');
    }
  }, []);

  const fetchAppointments = useCallback(async (date, mode = viewMode) => {
    if (!date || !isValid(date)) return;
    setLoading(true);
    try {
      const { startDate, endDate } = getRangeForView(date, mode);
      
      const response = await api.get('/appointments/week', {
        params: {
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd'),
          ...(selectedProfessionalId ? { professionalId: selectedProfessionalId } : {})
        }
      });
      
      setAppointments(response.data || []);
    } catch {
      toast.error("Error al cargar agenda");
    } finally { setLoading(false); }
  }, [selectedProfessionalId, viewMode]);

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
    const handleResize = () => setMobileAgendaViewport(isMobileAgendaViewport());
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!selectedProfessionalId && professionals.length) return;
    fetchAppointments(currentDate, viewMode);
  }, [currentDate, fetchAppointments, professionals.length, selectedProfessionalId, viewMode]);

  const refreshAppointments = useCallback(() => {
    fetchAppointments(currentDate, viewMode);
  }, [currentDate, fetchAppointments, viewMode]);

  const navigatePeriod = useCallback((direction) => {
    setCurrentDate((previous) => {
      if (viewMode === VIEW_MODE.month) {
        return direction > 0 ? addMonths(previous, 1) : subMonths(previous, 1);
      }

      return direction > 0 ? addWeeks(previous, 1) : subWeeks(previous, 1);
    });
  }, [viewMode]);
  const handleGoToToday = useCallback(() => {
    setCurrentDate(new Date());
    setViewMode(VIEW_MODE.week);
  }, []);


  const handleMonthDayOpen = useCallback((date) => {
    setCurrentDate(date);
    setViewMode(VIEW_MODE.week);
  }, []);

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
            <h1 className="text-xl font-black text-slate-800 italic uppercase">{viewTitle}</h1>
            <div className="rounded-lg bg-slate-100 px-3 py-1">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-teal-600" />
                <span className="text-sm font-bold text-slate-700">{format(currentTime, 'hh:mm a', { locale: es })}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleGoToToday}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-teal-700 transition hover:bg-teal-100 sm:w-fit"
            >
              Hoy
            </button>
            <div className="flex items-center justify-between rounded-lg bg-slate-100 p-1">
              <button type="button" onClick={() => navigatePeriod(-1)} className="rounded-md p-1.5 hover:bg-white"><ChevronLeft size={18} /></button>
              <h2 className="px-4 text-center text-sm font-bold capitalize">{currentRangeLabel}</h2>
              <button type="button" onClick={() => navigatePeriod(1)} className="rounded-md p-1.5 hover:bg-white"><ChevronRight size={18} /></button>
            </div>
            <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode(VIEW_MODE.week)}
                className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wide transition ${
                  viewMode === VIEW_MODE.week ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Semanal
              </button>
              <button
                type="button"
                onClick={() => setViewMode(VIEW_MODE.month)}
                className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wide transition ${
                  viewMode === VIEW_MODE.month ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Mensual
              </button>
            </div>
          </div>
          <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 xl:w-auto">
            <UserRound size={16} className="text-teal-600" />
            <select
              aria-label="Profesional"
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
        {viewMode === VIEW_MODE.week && !mobileAgendaViewport && (
          <SlotTimersPanel
            currentTime={currentTime}
            appointments={appointments}
            selectedProfessional={selectedProfessional}
            agendaConfig={agendaConfig}
          />
        )}

        {selectedProfessional && selectedWorkSchedule.length === 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            <CalendarClock size={18} />
            {selectedProfessional.fullName} todavía no tiene horarios configurados. Define días y franjas desde Configuración para que la agenda respete su disponibilidad.
          </div>
        )}

        {loading ? <div className="flex justify-center h-full items-center"><Loader2 className="animate-spin text-teal-500" size={40}/></div> : (
          <div className="relative min-w-0 overflow-hidden rounded-2xl border bg-white shadow-sm">
            {viewMode === VIEW_MODE.week && mobileAgendaViewport ? (
              <div className="space-y-3 p-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                    Vista diaria móvil
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-800">
                    {format(currentDate, "EEEE d 'de' MMMM", { locale: es })}
                  </p>
                </div>
                {mobileDayAppointments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-400">
                    No hay turnos para este día.
                  </div>
                ) : mobileDayAppointments.map((appointment) => (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => handleSlotClick(appointment)}
                    className="w-full rounded-[1.75rem] border border-slate-200 bg-white p-4 text-left shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-slate-800">{appointment.patient?.fullName}</p>
                        <p className="mt-1 text-sm font-semibold uppercase text-teal-700">
                          {getCoverageLabel(appointment.patient?.healthInsurance, appointment.patient?.treatAsParticular) || 'Sin cobertura'}
                        </p>
                        {appointment.paidInAdvance && (
                          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                            <Banknote size={11} />
                            Pago adelantado
                          </p>
                        )}
                        <p className="mt-2 text-sm text-slate-500">{appointment.diagnosis || 'Sin diagnóstico'}</p>
                      </div>
                      <span className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">
                        {appointment.time}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : viewMode === VIEW_MODE.week ? (
              <WeeklyCalendarGrid
                currentDate={currentWeek}
                onSlotClick={handleSlotClick}
                appointments={appointments}
                workSchedule={selectedWorkSchedule}
                selectedProfessional={selectedProfessional}
                currentTime={currentTime}
                capacityPerSlot={agendaConfig.capacityPerSlot}
              />
            ) : (
              <MonthlyCalendarGrid
                currentDate={currentDate}
                appointments={appointments}
                workSchedule={selectedWorkSchedule}
                selectedProfessional={selectedProfessional}
                onAppointmentClick={handleSlotClick}
                onDayOpen={handleMonthDayOpen}
              />
            )}
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

