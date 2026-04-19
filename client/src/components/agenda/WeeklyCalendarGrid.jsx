import React, { useMemo, useEffect, useRef } from 'react';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Activity, Zap, Plus, CheckCircle2, Flag, AlertTriangle, CalendarClock } from 'lucide-react';
import { getCoverageLabel, isParticularCoverage } from '@/utils/coverage';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_OFFSET_MAP = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 };
const DEFAULT_START_MINUTES = 8 * 60;
const DEFAULT_END_MINUTES = 20 * 60 + 30;
const SLOT_STEP_MINUTES = 30;

const parseTimeToMinutes = (time = '00:00') => {
  const [hours = '0', minutes = '0'] = String(time).split(':');
  return Number(hours) * 60 + Number(minutes);
};

const formatMinutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const findCurrentTimeSlotIndex = (timeSlots, currentMinutes) => {
  for (let index = 0; index < timeSlots.length; index += 1) {
    const startMinutes = parseTimeToMinutes(timeSlots[index]);
    const nextStartMinutes = index < timeSlots.length - 1
      ? parseTimeToMinutes(timeSlots[index + 1])
      : startMinutes + SLOT_STEP_MINUTES;

    if (currentMinutes >= startMinutes && currentMinutes < nextStartMinutes) {
      return index;
    }
  }

  return -1;
};

const findClosestTimeSlotIndex = (timeSlots, currentMinutes) => {
  const activeIndex = findCurrentTimeSlotIndex(timeSlots, currentMinutes);
  if (activeIndex >= 0) return activeIndex;

  const nextIndex = timeSlots.findIndex((slot) => parseTimeToMinutes(slot) >= currentMinutes);
  return nextIndex >= 0 ? nextIndex : timeSlots.length - 1;
};

const sortSchedules = (workSchedule = []) =>
  [...workSchedule].sort((a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek));

const buildDefaultDays = (currentDate) =>
  Array.from({ length: 6 }, (_, index) => ({
    dayOfWeek: index + 1,
    startTime: '08:00',
    endTime: '20:30',
    date: addDays(currentDate, index),
    hasConfiguredSchedule: false,
  }));

const getCoverageBadgeClass = (value, treatAsParticular = false) => (
  isParticularCoverage(value, treatAsParticular)
    ? 'text-blue-800 bg-blue-100/80'
    : 'text-teal-800 bg-teal-100/50'
);

const WeeklyCalendarGrid = ({ currentDate, onSlotClick, appointments, workSchedule = [], selectedProfessional = null, currentTime, capacityPerSlot = 5 }) => {
  const scrollContainerRef = useRef(null);
  const getStatusMeta = (status, usesEA, treatAsParticular, healthInsurance) => {
    const isPami = healthInsurance?.toUpperCase().includes('PAMI');
    if (status === 'COMPLETED') {
      return {
        cardClass: 'bg-emerald-50 border-emerald-600',
        badgeClass: 'bg-emerald-100 text-emerald-700',
        label: 'Asistió',
        icon: <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
      };
    }

    if (status === 'NO_SHOW') {
      return {
        cardClass: 'bg-rose-50 border-rose-600',
        badgeClass: 'bg-rose-100 text-rose-700',
        label: 'Inasistencia',
        icon: <AlertTriangle size={16} className="text-rose-600 shrink-0" />
      };
    }

    if (isPami && status === 'SCHEDULED') {
      return {
        cardClass: 'bg-amber-50 border-amber-400',
        badgeClass: 'bg-amber-100 text-amber-700',
        label: 'PAMI',
        icon: null
      };
    }

    if (isParticularCoverage(healthInsurance, treatAsParticular)) {
      return {
        cardClass: 'bg-blue-50 border-blue-600',
        badgeClass: 'bg-blue-100 text-blue-700',
        label: 'Programado',
        icon: null
      };
    }

    return {
      cardClass: usesEA ? 'bg-indigo-50 border-indigo-600' : 'bg-teal-50 border-teal-600',
      badgeClass: 'bg-slate-100 text-slate-600',
      label: 'Programado',
      icon: null
    };
  };

  const dayColumns = useMemo(() => {
    const sortedSchedule = sortSchedules(workSchedule);

    if (!sortedSchedule.length) {
      return buildDefaultDays(currentDate);
    }

    return sortedSchedule.map((schedule) => ({
      ...schedule,
      date: addDays(currentDate, DAY_OFFSET_MAP[schedule.dayOfWeek]),
      hasConfiguredSchedule: true,
    }));
  }, [currentDate, workSchedule]);

  const timeSlots = useMemo(() => {
    if (!workSchedule.length) {
      const appointmentStarts = appointments.map((item) => parseTimeToMinutes(item.time));
      const appointmentEnds = appointmentStarts.map((minutes) => minutes + SLOT_STEP_MINUTES);

      const startMinutes = Math.min(
        DEFAULT_START_MINUTES,
        ...(appointmentStarts.length ? appointmentStarts : [DEFAULT_START_MINUTES])
      );

      const endMinutes = Math.max(
        DEFAULT_END_MINUTES,
        ...(appointmentEnds.length ? appointmentEnds : [DEFAULT_END_MINUTES])
      );

      const fallbackSlots = [];
      for (let minutes = startMinutes; minutes < endMinutes; minutes += SLOT_STEP_MINUTES) {
        fallbackSlots.push(formatMinutesToTime(minutes));
      }
      return fallbackSlots;
    }

    const activeMinutes = new Set();

    workSchedule.forEach((item) => {
      const start = parseTimeToMinutes(item.startTime);
      const end = parseTimeToMinutes(item.endTime);

      for (let minutes = start; minutes < end; minutes += SLOT_STEP_MINUTES) {
        activeMinutes.add(minutes);
      }
    });

    appointments.forEach((item) => {
      activeMinutes.add(parseTimeToMinutes(item.time));
    });

    return [...activeMinutes]
      .sort((a, b) => a - b)
      .map((minutes) => formatMinutesToTime(minutes));
  }, [appointments, workSchedule]);

  useEffect(() => {
    if (scrollContainerRef.current && timeSlots.length > 0) {
      const now = currentTime || new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const targetIndex = findClosestTimeSlotIndex(timeSlots, currentMinutes);
      const slotHeight = 160; // min-h-[160px]
      const scrollTop = targetIndex * slotHeight;
      scrollContainerRef.current.scrollTop = scrollTop;
    }
  }, [timeSlots, currentTime]);

  const currentTimeSlotIndex = useMemo(() => {
    if (!timeSlots.length || !currentTime) return -1;
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    return findCurrentTimeSlotIndex(timeSlots, currentMinutes);
  }, [timeSlots, currentTime]);

  const gridTemplateColumns = `var(--calendar-time-column) repeat(${dayColumns.length}, minmax(var(--calendar-day-min-width), 1fr))`;

  if (!selectedProfessional && !appointments.length) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 bg-slate-50 text-center">
        <CalendarClock size={36} className="text-slate-300" />
        <div>
          <p className="text-lg font-black text-slate-700">Selecciona un profesional</p>
          <p className="text-sm font-medium text-slate-400">La agenda se construye con la disponibilidad del profesional.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef} className="calendar-scroll-container relative isolate max-h-[72vh] overflow-auto rounded-2xl border bg-white shadow-2xl sm:max-h-[85vh]">
      <div className="calendar-grid grid min-w-max" style={{ gridTemplateColumns }}>
        <div className="sticky-corner border-b border-r p-2 bg-slate-100 z-50" />

        {dayColumns.map((day) => (
          <div key={day.date.toString()} className="sticky-day-header p-2 sm:p-4 text-center border-b border-r bg-slate-50 z-40">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">
              {format(day.date, 'EEEE', { locale: es })}
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-800">{format(day.date, 'd')}</p>
            {day.hasConfiguredSchedule && (
              <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-teal-600">
                {day.startTime} - {day.endTime}
              </p>
            )}
          </div>
        ))}

        {timeSlots.map((slotTime, slotIndex) => {
          const slotMinutes = parseTimeToMinutes(slotTime);
          const isCurrentTimeSlot = slotIndex === currentTimeSlotIndex;

          return (
            <React.Fragment key={slotTime}>
              <div
                className={`sticky-time-column flex min-h-[160px] items-center justify-center border-b border-r p-2 text-center transition-colors sm:p-4 ${
                  isCurrentTimeSlot
                    ? 'bg-emerald-100 border-emerald-200 shadow-inner'
                    : 'bg-slate-50'
                }`}
              >
                <span
                  className={`text-[10px] sm:text-base font-black italic ${
                    isCurrentTimeSlot ? 'text-emerald-700' : 'text-slate-600'
                  }`}
                >
                  {slotTime}
                </span>
              </div>

              {dayColumns.map((day) => {
                const formattedDate = format(day.date, 'yyyy-MM-dd');
                const appsInSlot = appointments.filter((appointment) => appointment.date.split('T')[0] === formattedDate && appointment.time === slotTime);
                const dayStartMinutes = parseTimeToMinutes(day.startTime);
                const dayEndMinutes = parseTimeToMinutes(day.endTime);
                const isWithinConfiguredSchedule = !day.hasConfiguredSchedule || (slotMinutes >= dayStartMinutes && slotMinutes < dayEndMinutes);
                const isCellDisabled = !isWithinConfiguredSchedule && appsInSlot.length === 0;

                return (
                  <div
                    key={formattedDate + slotTime}
                    className={`border-b border-r p-3 flex flex-col gap-2 relative ${
                      isCellDisabled
                        ? 'bg-slate-50'
                        : isCurrentTimeSlot
                          ? 'bg-emerald-50/70 group'
                          : 'bg-white group'
                    }`}
                  >
                    {appsInSlot.map((app) => {
                      const statusMeta = getStatusMeta(
                        app.status,
                        app.patient?.usesEA,
                        app.patient?.treatAsParticular,
                        app.patient?.healthInsurance
                      );

                      return (
                      <div
                        key={app.id}
                        onClick={() => onSlotClick(app)}
                        className={`group relative flex flex-col p-4 rounded-xl border-l-[8px] shadow-sm transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer ${
                          statusMeta.cardClass
                        }`}
                      >
                        {app.isFirstSession && (
                          <div className="absolute -top-2 -right-1 bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 animate-pulse z-10">
                            <Flag size={8} fill="currentColor" /> INGRESO
                          </div>
                        )}

                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[11px] sm:text-[13px] font-black text-slate-900 uppercase leading-tight truncate pr-4">
                            {app.patient?.fullName}
                          </span>
                          {statusMeta.icon}
                        </div>

                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-[9px] sm:text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${getCoverageBadgeClass(app.patient?.healthInsurance, app.patient?.treatAsParticular)}`}>
                            {getCoverageLabel(app.patient?.healthInsurance, app.patient?.treatAsParticular)}
                          </span>
                          <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 whitespace-nowrap">
                            SESIÓN {app.isFirstSession ? 1 : app.sessionNumber}
                          </span>
                        </div>

                        <div className="mt-2 flex justify-end">
                          <span className={`rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-wider ${statusMeta.badgeClass}`}>
                            {statusMeta.label}
                          </span>
                        </div>

                        <div className="mt-2 sm:mt-3 p-2 bg-white/80 rounded-lg border border-slate-200/50 shadow-inner">
                          <p className="text-[10px] sm:text-[12px] font-bold text-slate-700 leading-snug line-clamp-3 uppercase">
                            {app.diagnosis || 'SIN ESPECIFICAR'}
                          </p>
                        </div>

                        <div className="flex gap-2 mt-3 items-center">
                          {app.patient?.hasCancer && <AlertTriangle size={12} className="text-rose-500" title="Oncológico" />}
                          {app.patient?.hasMarcapasos && <Activity size={12} className="text-blue-600 stroke-[3px]" />}
                          {app.patient?.usesEA && <Zap size={12} className="text-amber-500 fill-amber-500" />}
                        </div>
                      </div>
                    );
                    })}

                    {isWithinConfiguredSchedule && appsInSlot.length < capacityPerSlot && (
                      <button
                        onClick={() => onSlotClick({ date: formattedDate, time: slotTime })}
                        className="mt-auto w-full py-3 rounded-xl opacity-0 group-hover:opacity-100 bg-slate-50 text-slate-300 hover:text-teal-600 border-2 border-dashed border-slate-200 hover:border-teal-500 transition-all flex items-center justify-center"
                      >
                        <Plus size={28} />
                      </button>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default WeeklyCalendarGrid;
