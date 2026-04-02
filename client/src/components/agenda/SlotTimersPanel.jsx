import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/services/api';

const DEFAULT_CAPACITY_PER_SLOT = 5;
const DEFAULT_TIMER_DURATION_MINUTES = 25;
const DEFAULT_SLOT_DURATION_MINUTES = 30;
const TIMER_DOUBLE_CLICK_DELAY_MS = 300;
const TIMER_SYNC_INTERVAL_MS = 5000;
const TIMER_STATUSES = new Set(['idle', 'active', 'paused', 'finished']);

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

const normalizeTimerDurations = (durations, count, fallbackMinutes) =>
  Array.from({ length: count }, (_, index) => ({
    slotNumber: index + 1,
    minutes: Math.max(1, Number(durations?.[index]) || fallbackMinutes),
  })).map((item) => item.minutes);

const getDefaultSecondsForSlot = (timerDefaultSecondsBySlot, slotNumber) =>
  timerDefaultSecondsBySlot[slotNumber - 1] || timerDefaultSecondsBySlot[0] || (DEFAULT_TIMER_DURATION_MINUTES * 60);

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

const getConsumedSeconds = (timer, timerDefaultSecondsBySlot) => {
  const defaultSeconds = getDefaultSecondsForSlot(timerDefaultSecondsBySlot, timer.slotNumber);
  return Math.max(0, defaultSeconds - Math.max(timer.remainingSeconds, 0));
};

const getTimerMeta = (timer, timerDefaultSecondsBySlot) => {
  if (timer.status === 'finished' && timer.remainingSeconds < 0) {
    return {
      label: 'Atraso',
      value: `+${formatCountdown(Math.abs(timer.remainingSeconds))}`,
    };
  }

  return {
    label: timer.status === 'paused' ? 'Pausa' : null,
    value: formatCountdown(getConsumedSeconds(timer, timerDefaultSecondsBySlot)),
  };
};

const createTimerShell = (defaultSecondsBySlot) =>
  defaultSecondsBySlot.map((defaultSeconds, index) => ({
    slotNumber: index + 1,
    durationSeconds: defaultSeconds,
    remainingSeconds: defaultSeconds,
    status: 'idle',
    endsAt: null,
    finishedAt: null,
    updatedAt: null,
  }));

const normalizeTimerRecord = (timer, defaultSeconds, slotNumber) => ({
  slotNumber,
  durationSeconds: Math.max(1, Number(timer?.durationSeconds) || defaultSeconds),
  remainingSeconds: Number.isFinite(Number(timer?.remainingSeconds))
    ? Math.trunc(Number(timer.remainingSeconds))
    : defaultSeconds,
  status: TIMER_STATUSES.has(String(timer?.status)) ? String(timer.status) : 'idle',
  endsAt: timer?.endsAt || null,
  finishedAt: timer?.finishedAt || null,
  updatedAt: timer?.updatedAt || null,
});

const computeTimerView = (timer, defaultSeconds, nowMs) => {
  const durationSeconds = Math.max(1, Number(timer?.durationSeconds) || defaultSeconds);

  if (timer?.status === 'active' && timer?.endsAt) {
    const endMs = new Date(timer.endsAt).getTime();
    if (!Number.isNaN(endMs)) {
      const remainingSeconds = Math.ceil((endMs - nowMs) / 1000);
      if (remainingSeconds > 0) {
        return {
          ...timer,
          durationSeconds,
          remainingSeconds,
          status: 'active',
        };
      }

      const overtimeSeconds = Math.max(0, Math.floor((nowMs - endMs) / 1000));
      return {
        ...timer,
        durationSeconds,
        remainingSeconds: overtimeSeconds === 0 ? 0 : -overtimeSeconds,
        status: 'finished',
      };
    }
  }

  if (timer?.status === 'finished') {
    const finishedMs = timer?.finishedAt ? new Date(timer.finishedAt).getTime() : nowMs;
    const overtimeSeconds = Number.isNaN(finishedMs) ? 0 : Math.max(0, Math.floor((nowMs - finishedMs) / 1000));
    return {
      ...timer,
      durationSeconds,
      remainingSeconds: overtimeSeconds === 0 ? 0 : -overtimeSeconds,
      status: 'finished',
    };
  }

  if (timer?.status === 'paused') {
    return {
      ...timer,
      durationSeconds,
      remainingSeconds: Math.max(0, Number(timer.remainingSeconds) || durationSeconds),
      status: 'paused',
    };
  }

  return {
    ...timer,
    durationSeconds,
    remainingSeconds: durationSeconds,
    status: 'idle',
  };
};

const SlotTimersPanel = ({ currentTime, appointments = [], agendaConfig = null }) => {
  const audioContextRef = useRef(null);
  const clickTimeoutsRef = useRef(new Map());
  const previousStatusesRef = useRef(new Map());
  const hasHydratedTimersRef = useRef(false);
  const slotDurationMinutes = Math.max(1, Number(agendaConfig?.slotDuration) || DEFAULT_SLOT_DURATION_MINUTES);
  const configuredCapacity = Math.max(1, Number(agendaConfig?.capacityPerSlot) || DEFAULT_CAPACITY_PER_SLOT);
  const defaultDurationMinutes = Math.max(1, Number(agendaConfig?.timerDurationMinutes) || DEFAULT_TIMER_DURATION_MINUTES);

  const baseDate = currentTime || new Date();
  const todayKey = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(baseDate.getDate()).padStart(2, '0')}`;
  const currentMinutes = (currentTime?.getHours?.() || 0) * 60 + (currentTime?.getMinutes?.() || 0);
  const currentSlotTime = formatMinutesToTime(Math.floor(currentMinutes / slotDurationMinutes) * slotDurationMinutes);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [pendingSlots, setPendingSlots] = useState([]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const currentSlotAppointments = useMemo(() => (
    appointments
      .filter((appointment) => appointment.date?.split('T')[0] === todayKey && appointment.time === currentSlotTime)
      .sort((a, b) => (a.slotNumber || 0) - (b.slotNumber || 0))
  ), [appointments, currentSlotTime, todayKey]);

  const timerCount = useMemo(() => {
    const highestOccupiedSlot = currentSlotAppointments.reduce(
      (maxValue, appointment) => Math.max(maxValue, Number(appointment.slotNumber) || 0),
      0,
    );
    return Math.max(configuredCapacity, highestOccupiedSlot, 1);
  }, [configuredCapacity, currentSlotAppointments]);

  const appointmentBySlot = useMemo(
    () => new Map(currentSlotAppointments.map((appointment) => [appointment.slotNumber, appointment])),
    [currentSlotAppointments],
  );

  const timerDurations = useMemo(
    () => normalizeTimerDurations(agendaConfig?.timerDurations, timerCount, defaultDurationMinutes),
    [agendaConfig?.timerDurations, timerCount, defaultDurationMinutes],
  );
  const timerDefaultSecondsBySlot = useMemo(
    () => timerDurations.map((minutes) => minutes * 60),
    [timerDurations],
  );

  const [timerRecords, setTimerRecords] = useState(() => createTimerShell(timerDefaultSecondsBySlot));

  const clearPendingClick = (slotNumber) => {
    const timeoutId = clickTimeoutsRef.current.get(slotNumber);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      clickTimeoutsRef.current.delete(slotNumber);
    }
  };

  useEffect(() => {
    setTimerRecords(createTimerShell(timerDefaultSecondsBySlot));
    clickTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    clickTimeoutsRef.current.clear();
    previousStatusesRef.current = new Map();
    hasHydratedTimersRef.current = false;
  }, [timerDefaultSecondsBySlot, todayKey, currentSlotTime]);

  useEffect(() => () => {
    clickTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    clickTimeoutsRef.current.clear();
  }, []);

  const applyServerSnapshot = (serverTimers = []) => {
    const recordsBySlot = new Map(serverTimers.map((timer) => [Number(timer.slotNumber), timer]));

    setTimerRecords(
      timerDefaultSecondsBySlot.map((defaultSeconds, index) => {
        const slotNumber = index + 1;
        const serverTimer = recordsBySlot.get(slotNumber);
        return normalizeTimerRecord(serverTimer, defaultSeconds, slotNumber);
      }),
    );
  };

  const fetchTimerSnapshot = async ({ silent = false } = {}) => {
    try {
      const response = await api.get('/agenda/timers', {
        params: {
          timerDate: todayKey,
          slotTime: currentSlotTime,
        },
      });

      applyServerSnapshot(response.data?.timers || []);
      hasHydratedTimersRef.current = true;
    } catch (error) {
      if (!silent) {
        console.error('Error fetching timers:', error);
      }
    }
  };

  useEffect(() => {
    fetchTimerSnapshot();
  }, [todayKey, currentSlotTime]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      fetchTimerSnapshot({ silent: true });
    }, TIMER_SYNC_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTimerSnapshot({ silent: true });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [todayKey, currentSlotTime, timerDefaultSecondsBySlot]);

  const timers = useMemo(
    () => timerRecords.map((timer) => computeTimerView(
      timer,
      getDefaultSecondsForSlot(timerDefaultSecondsBySlot, timer.slotNumber),
      nowMs,
    )),
    [nowMs, timerDefaultSecondsBySlot, timerRecords],
  );

  const playFinishedSound = async () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }

      const context = audioContextRef.current;
      if (context.state === 'suspended') {
        await context.resume();
      }

      const startAt = context.currentTime + 0.01;
      const tones = [
        { frequency: 880, offset: 0 },
        { frequency: 660, offset: 0.18 },
      ];

      tones.forEach(({ frequency, offset }) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, startAt + offset);

        gain.gain.setValueAtTime(0.0001, startAt + offset);
        gain.gain.exponentialRampToValueAtTime(0.12, startAt + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.18);

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(startAt + offset);
        oscillator.stop(startAt + offset + 0.2);
      });
    } catch {
      // Si el navegador bloquea audio, el cronómetro sigue funcionando.
    }
  };

  useEffect(() => {
    const nextStatuses = new Map(timers.map((timer) => [timer.slotNumber, timer.status]));

    if (!hasHydratedTimersRef.current) {
      previousStatusesRef.current = nextStatuses;
      return;
    }

    timers.forEach((timer) => {
      const previousStatus = previousStatusesRef.current.get(timer.slotNumber);
      if (previousStatus && previousStatus !== 'finished' && timer.status === 'finished') {
        playFinishedSound();
      }
    });

    previousStatusesRef.current = nextStatuses;
  }, [timers]);

  const handleToggleTimer = async (slotNumber) => {
    if (pendingSlots.includes(slotNumber)) return;

    clearPendingClick(slotNumber);

    setPendingSlots((prev) => [...prev, slotNumber]);

    try {
      const defaultDurationSeconds = getDefaultSecondsForSlot(timerDefaultSecondsBySlot, slotNumber);
      const response = await api.post('/agenda/timers/toggle', {
        timerDate: todayKey,
        slotTime: currentSlotTime,
        slotNumber,
        defaultDurationSeconds,
      });

      const serverTimer = normalizeTimerRecord(response.data?.timer, defaultDurationSeconds, slotNumber);
      setTimerRecords((previous) => previous.map((timer) => (
        timer.slotNumber === slotNumber ? serverTimer : timer
      )));
    } catch (error) {
      console.error('Error toggling timer:', error);
      toast.error('No se pudo actualizar el cronómetro');
    } finally {
      setPendingSlots((prev) => prev.filter((value) => value !== slotNumber));
    }
  };

  const handleResetTimer = async (slotNumber) => {
    if (pendingSlots.includes(slotNumber)) return;

    clearPendingClick(slotNumber);
    setPendingSlots((prev) => [...prev, slotNumber]);

    try {
      const defaultDurationSeconds = getDefaultSecondsForSlot(timerDefaultSecondsBySlot, slotNumber);
      const response = await api.post('/agenda/timers/reset', {
        timerDate: todayKey,
        slotTime: currentSlotTime,
        slotNumber,
        defaultDurationSeconds,
      });

      const serverTimer = normalizeTimerRecord(response.data?.timer, defaultDurationSeconds, slotNumber);
      setTimerRecords((previous) => previous.map((timer) => (
        timer.slotNumber === slotNumber ? serverTimer : timer
      )));
    } catch (error) {
      console.error('Error resetting timer:', error);
      toast.error('No se pudo resetear el cronómetro');
    } finally {
      setPendingSlots((prev) => prev.filter((value) => value !== slotNumber));
    }
  };

  const handleTimerClick = (slotNumber, clickCount) => {
    if (clickCount >= 2) {
      handleResetTimer(slotNumber);
      return;
    }

    clearPendingClick(slotNumber);
    const timeoutId = window.setTimeout(() => {
      clickTimeoutsRef.current.delete(slotNumber);
      handleToggleTimer(slotNumber);
    }, TIMER_DOUBLE_CLICK_DELAY_MS);
    clickTimeoutsRef.current.set(slotNumber, timeoutId);
  };

  return (
    <section className="mb-4 overflow-x-auto px-3 py-2 sm:px-4">
      <div className="inline-flex min-w-max rounded-[1.4rem] border border-slate-200 bg-white/90 px-3 py-3 shadow-sm">
        <div className="flex min-w-max gap-3 pb-1">
          {timers.map((timer) => {
            const hasAppointment = appointmentBySlot.has(timer.slotNumber);
            const timerMeta = getTimerMeta(timer, timerDefaultSecondsBySlot);
            const isPending = pendingSlots.includes(timer.slotNumber);

            return (
              <button
                type="button"
                key={`${todayKey}-${currentSlotTime}-${timer.slotNumber}`}
                onClick={(event) => handleTimerClick(timer.slotNumber, event.detail)}
                disabled={isPending}
                className={`relative flex h-[92px] w-[84px] shrink-0 flex-col items-center justify-center rounded-[1.1rem] border-[4px] px-1 font-black transition-all ${getTimerBoxClasses(timer.status)} ${isPending ? 'cursor-wait opacity-70' : ''}`}
                title={timer.status === 'active'
                  ? 'Click: pausar. Doble click: resetear.'
                  : (timer.status === 'paused'
                    ? 'Click: reanudar. Doble click: resetear.'
                    : 'Click: iniciar. Doble click: resetear.')}
              >
                {hasAppointment && (
                  <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-slate-950/80" />
                )}
                <span className="text-[28px] leading-none">{timer.slotNumber}</span>

                {timerMeta.label && (
                  <span className="mt-2 text-[9px] font-black uppercase tracking-[0.16em] opacity-80">
                    {timerMeta.label}
                  </span>
                )}

                <span className={`${!timerMeta.label ? 'mt-2' : ''} text-[11px] font-black leading-tight`}>
                  {timerMeta.value}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default SlotTimersPanel;
