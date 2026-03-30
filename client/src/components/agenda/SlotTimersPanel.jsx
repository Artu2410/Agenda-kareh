import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { RotateCcw } from 'lucide-react';

const DEFAULT_CAPACITY_PER_SLOT = 5;
const DEFAULT_TIMER_DURATION_MINUTES = 25;
const DEFAULT_SLOT_DURATION_MINUTES = 30;
const STORAGE_NAMESPACE = 'kareh-slot-timers';

const formatMinutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const formatCountdown = (seconds) => {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

const createTimers = (count, defaultSeconds) =>
  Array.from({ length: count }, (_, index) => ({
    slotNumber: index + 1,
    remainingSeconds: defaultSeconds,
    status: 'idle',
  }));

const normalizeStoredTimers = (storedTimers, timerCount, defaultSeconds) =>
  Array.from({ length: timerCount }, (_, index) => {
    const storedTimer = storedTimers?.[index];
    const remainingSeconds = Number.isFinite(storedTimer?.remainingSeconds)
      ? Math.max(0, Math.floor(storedTimer.remainingSeconds))
      : defaultSeconds;
    const status = ['idle', 'active', 'paused', 'finished'].includes(storedTimer?.status)
      ? storedTimer.status
      : 'idle';

    return {
      slotNumber: index + 1,
      remainingSeconds,
      status: remainingSeconds === 0 && status === 'active' ? 'finished' : status,
    };
  });

const getStatusCopy = (status) => {
  if (status === 'active') return 'Activo';
  if (status === 'paused') return 'Pausado';
  if (status === 'finished') return 'Terminado';
  return 'Listo';
};

const getTimerBoxClasses = (status) => {
  if (status === 'active') {
    return 'border-emerald-500 bg-emerald-400 text-slate-950 shadow-[0_0_24px_rgba(16,185,129,0.4)] hover:border-emerald-400';
  }

  if (status === 'finished') {
    return 'border-rose-500 bg-rose-500 text-white shadow-[0_0_24px_rgba(244,63,94,0.35)] hover:border-rose-400';
  }

  if (status === 'paused') {
    return 'border-amber-400 bg-amber-300 text-slate-950 shadow-[0_0_18px_rgba(251,191,36,0.28)] hover:border-amber-300';
  }

  return 'border-slate-900 bg-white text-slate-900 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.6)] hover:border-slate-700';
};

const SlotTimersPanel = ({ currentTime, appointments = [], selectedProfessional = null, agendaConfig = null }) => {
  const slotDurationMinutes = Math.max(1, Number(agendaConfig?.slotDuration) || DEFAULT_SLOT_DURATION_MINUTES);
  const configuredCapacity = Math.max(1, Number(agendaConfig?.capacityPerSlot) || DEFAULT_CAPACITY_PER_SLOT);
  const defaultDurationMinutes = Math.max(1, Number(agendaConfig?.timerDurationMinutes) || DEFAULT_TIMER_DURATION_MINUTES);
  const defaultSeconds = defaultDurationMinutes * 60;

  const todayKey = format(currentTime || new Date(), 'yyyy-MM-dd');
  const currentMinutes = (currentTime?.getHours?.() || 0) * 60 + (currentTime?.getMinutes?.() || 0);
  const currentSlotTime = formatMinutesToTime(Math.floor(currentMinutes / slotDurationMinutes) * slotDurationMinutes);

  const currentSlotAppointments = useMemo(() => (
    appointments
      .filter((appointment) => appointment.date?.split('T')[0] === todayKey && appointment.time === currentSlotTime)
      .sort((a, b) => (a.slotNumber || 0) - (b.slotNumber || 0))
  ), [appointments, currentSlotTime, todayKey]);

  const timerCount = useMemo(() => {
    const highestOccupiedSlot = currentSlotAppointments.reduce(
      (maxValue, appointment) => Math.max(maxValue, Number(appointment.slotNumber) || 0),
      0
    );
    return Math.max(configuredCapacity, highestOccupiedSlot, 1);
  }, [configuredCapacity, currentSlotAppointments]);

  const appointmentBySlot = useMemo(() => (
    new Map(currentSlotAppointments.map((appointment) => [appointment.slotNumber, appointment]))
  ), [currentSlotAppointments]);

  const storageKey = `${STORAGE_NAMESPACE}:${selectedProfessional?.id || 'global'}:${todayKey}:${currentSlotTime}:${timerCount}`;
  const [timers, setTimers] = useState(() => createTimers(timerCount, defaultSeconds));
  const [hydratedStorageKey, setHydratedStorageKey] = useState('');

  useEffect(() => {
    try {
      const rawState = window.localStorage.getItem(storageKey);
      if (!rawState) {
        setTimers(createTimers(timerCount, defaultSeconds));
        setHydratedStorageKey(storageKey);
        return;
      }

      const parsedState = JSON.parse(rawState);
      setTimers(normalizeStoredTimers(parsedState, timerCount, defaultSeconds));
      setHydratedStorageKey(storageKey);
    } catch {
      setTimers(createTimers(timerCount, defaultSeconds));
      setHydratedStorageKey(storageKey);
    }
  }, [storageKey, timerCount, defaultSeconds]);

  useEffect(() => {
    if (hydratedStorageKey !== storageKey) return;
    window.localStorage.setItem(storageKey, JSON.stringify(timers));
  }, [hydratedStorageKey, storageKey, timers]);

  const hasActiveTimer = useMemo(
    () => timers.some((timer) => timer.status === 'active'),
    [timers]
  );

  useEffect(() => {
    if (!hasActiveTimer) return undefined;

    const intervalId = window.setInterval(() => {
      setTimers((previousTimers) => previousTimers.map((timer) => {
        if (timer.status !== 'active') return timer;
        if (timer.remainingSeconds <= 1) {
          return { ...timer, remainingSeconds: 0, status: 'finished' };
        }
        return { ...timer, remainingSeconds: timer.remainingSeconds - 1 };
      }));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [hasActiveTimer]);

  const updateTimer = (slotNumber, updater) => {
    setTimers((previousTimers) => previousTimers.map((timer) => (
      timer.slotNumber === slotNumber ? updater(timer) : timer
    )));
  };

  const handleToggleTimer = (slotNumber) => {
    updateTimer(slotNumber, (timer) => {
      if (timer.remainingSeconds <= 0) {
        return { ...timer, remainingSeconds: defaultSeconds, status: 'active' };
      }

      if (timer.status === 'active') {
        return timer;
      }

      return { ...timer, status: 'active' };
    });
  };

  const handleResetAll = () => {
    setTimers(createTimers(timerCount, defaultSeconds));
  };

  return (
    <section className="mb-4 overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.08),_transparent_42%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.26em] text-teal-600">Cronómetros de Sesión</p>
          <h2 className="mt-1 text-lg font-black uppercase italic text-slate-900">
            {selectedProfessional?.fullName || 'Agenda general'}
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Franja actual {currentSlotTime} • {format(currentTime || new Date(), "EEEE d 'de' MMMM", { locale: es })} • {currentSlotAppointments.length}/{timerCount} ocupados
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleResetAll}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-slate-900 px-4 py-2 text-sm font-black uppercase tracking-wide text-white transition-colors hover:bg-slate-700"
          >
            <RotateCcw size={16} />
            Reiniciar todos
          </button>
        </div>
      </div>

      <div className="overflow-x-auto px-4 py-4 sm:px-6">
        <div className="flex min-w-max gap-3 pb-1">
          {timers.map((timer) => {
            const hasAppointment = appointmentBySlot.has(timer.slotNumber);
            const appointment = appointmentBySlot.get(timer.slotNumber);

            return (
              <button
                type="button"
                key={`${storageKey}-${timer.slotNumber}`}
                onClick={() => handleToggleTimer(timer.slotNumber)}
                title={`Slot ${timer.slotNumber} • ${getStatusCopy(timer.status)} • ${appointment?.patient?.fullName || 'Libre'} • ${formatCountdown(timer.remainingSeconds)}`}
                className={`relative flex h-[72px] w-[72px] shrink-0 flex-col items-center justify-center rounded-[1.1rem] border-[4px] font-black transition-all ${getTimerBoxClasses(timer.status)}`}
              >
                {hasAppointment && (
                  <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-slate-950/80" />
                )}
                <span className="text-[28px] leading-none">{timer.slotNumber}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default SlotTimersPanel;
