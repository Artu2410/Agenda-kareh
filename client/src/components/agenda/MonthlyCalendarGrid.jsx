import React, { useMemo } from 'react';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Activity, AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, Clock3, Zap, Banknote } from 'lucide-react';
import { getCoverageLabel } from '@/utils/coverage';
import { getAppointmentColorScheme } from './appointmentColors';

const WEEKDAY_HEADERS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const VISIBLE_APPOINTMENTS_PER_DAY = 4;
const isVisibleWeekday = (date) => date.getDay() !== 0;

const getAppointmentDateKey = (value) => String(value || '').split('T')[0];

const getStatusMeta = (appointment = {}) => {
  const { status } = appointment;
  const colorScheme = getAppointmentColorScheme(appointment);
  const coverageClasses = {
    coverageBadgeClass: colorScheme.coverageBadgeClass,
    coverageBorderClass: colorScheme.coverageBorderClass,
    showCoverageBadge: colorScheme.showCoverageBadge,
  };

  if (status === 'COMPLETED') {
    return {
      cardClass: 'border-emerald-200 bg-emerald-50/90',
      badgeClass: 'bg-emerald-100 text-emerald-700',
      label: 'Asistió',
      accentClass: 'bg-emerald-500',
      icon: <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />,
      ...coverageClasses,
    };
  }

  if (status === 'NO_SHOW') {
    return {
      cardClass: 'border-rose-200 bg-rose-50/90',
      badgeClass: 'bg-rose-100 text-rose-700',
      label: 'Inasistencia',
      accentClass: 'bg-rose-500',
      icon: <AlertTriangle size={14} className="shrink-0 text-rose-600" />,
      ...coverageClasses,
    };
  }

  if (status === 'SCHEDULED' && colorScheme.category === 'iu') {
    return {
      cardClass: colorScheme.cardClass,
      badgeClass: colorScheme.badgeClass,
      label: 'Tratamiento IU',
      accentClass: colorScheme.accentClass,
      icon: <span className="text-lg">💧</span>,
      ...coverageClasses,
    };
  }

  if (status === 'SCHEDULED' && colorScheme.category === 'respiratory') {
    return {
      cardClass: colorScheme.cardClass,
      badgeClass: colorScheme.badgeClass,
      label: 'Respiratorio',
      accentClass: colorScheme.accentClass,
      icon: <span className="text-lg">🫁</span>,
      ...coverageClasses,
    };
  }

  if (status === 'SCHEDULED' && colorScheme.category === 'pami') {
    return {
      cardClass: colorScheme.cardClass,
      badgeClass: colorScheme.badgeClass,
      label: 'PAMI',
      accentClass: colorScheme.accentClass,
      icon: null,
      ...coverageClasses,
    };
  }

  if (status === 'SCHEDULED' && colorScheme.category === 'particular') {
    return {
      cardClass: colorScheme.cardClass,
      badgeClass: colorScheme.badgeClass,
      label: 'Programado',
      accentClass: colorScheme.accentClass,
      icon: null,
      ...coverageClasses,
    };
  }

  return {
    cardClass: colorScheme.cardClass,
    badgeClass: colorScheme.badgeClass,
    label: 'Programado',
    accentClass: colorScheme.accentClass,
    icon: <Clock3 size={14} className={`shrink-0 ${colorScheme.iconClass}`} />,
    ...coverageClasses,
  };
};

const MonthlyCalendarGrid = ({
  currentDate,
  appointments = [],
  workSchedule = [],
  selectedProfessional = null,
  onAppointmentClick,
  onDayOpen,
  onOpenWeek = onDayOpen,
}) => {
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: gridStart, end: gridEnd }).filter(isVisibleWeekday);
  }, [currentDate]);

  const appointmentsByDay = useMemo(() => (
    appointments.reduce((accumulator, appointment) => {
      const dateKey = getAppointmentDateKey(appointment.date);
      if (!accumulator[dateKey]) {
        accumulator[dateKey] = [];
      }

      accumulator[dateKey].push(appointment);
      return accumulator;
    }, {})
  ), [appointments]);

  const monthlyTotals = useMemo(() => (
    appointments.reduce((accumulator, appointment) => {
      accumulator.total += 1;

      if (appointment.status === 'COMPLETED') {
        accumulator.completed += 1;
      } else if (appointment.status === 'NO_SHOW') {
        accumulator.noShow += 1;
      } else {
        accumulator.scheduled += 1;
      }

      return accumulator;
    }, { total: 0, scheduled: 0, completed: 0, noShow: 0 })
  ), [appointments]);

  const scheduleByDay = useMemo(() => (
    workSchedule.reduce((accumulator, schedule) => {
      accumulator[schedule.dayOfWeek] = `${schedule.startTime} - ${schedule.endTime}`;
      return accumulator;
    }, {})
  ), [workSchedule]);

  if (!selectedProfessional && !appointments.length) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 bg-slate-50 text-center">
        <CalendarClock size={36} className="text-slate-300" />
        <div>
          <p className="text-lg font-black text-slate-700">Selecciona un profesional</p>
          <p className="text-sm font-medium text-slate-400">La vista mensual se arma con los turnos y la disponibilidad del profesional.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-slate-50 p-3 sm:p-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-teal-600">Vista mensual</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Toca un turno para editarlo, usa Ver más para ver la lista completa del día o Abrir semana para gestionar horarios.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
            {monthlyTotals.total} turnos
          </div>
          <div className="rounded-full bg-teal-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-teal-700">
            {monthlyTotals.scheduled} programados
          </div>
          <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
            {monthlyTotals.completed} asistencias
          </div>
          <div className="rounded-full bg-rose-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-rose-700">
            {monthlyTotals.noShow} inasistencias
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:hidden">
        {monthDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayAppointments = appointmentsByDay[dateKey] || [];
          const visibleAppointments = dayAppointments.slice(0, VISIBLE_APPOINTMENTS_PER_DAY);
          const hiddenCount = dayAppointments.length - visibleAppointments.length;
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);
          const availability = scheduleByDay[day.getDay()];

          return (
            <div
              key={dateKey}
              className={`rounded-2xl border bg-white p-4 shadow-sm ${isCurrentMonth ? 'border-slate-200' : 'border-slate-100 bg-slate-50/70'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-[11px] font-black uppercase tracking-[0.22em] ${isCurrentMonth ? 'text-slate-500' : 'text-slate-300'}`}>
                    {format(day, 'EEEE d MMM', { locale: es })}
                  </p>
                  {isCurrentDay && (
                    <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-teal-600">Hoy</p>
                  )}
                </div>
                <div className="text-right">
                  {availability ? (
                    <p className="inline-flex rounded-full bg-teal-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-teal-700">
                      {availability}
                    </p>
                  ) : (
                    <p className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      Sin horario
                    </p>
                  )}
                  <p className={`mt-2 text-sm font-black ${isCurrentMonth ? 'text-slate-700' : 'text-slate-400'}`}>
                    {dayAppointments.length === 0 ? 'Sin turnos' : `${dayAppointments.length} turno${dayAppointments.length === 1 ? '' : 's'}`}
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {visibleAppointments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-3 text-sm font-semibold text-slate-400">
                    No hay turnos para este día.
                  </div>
                ) : (
                  visibleAppointments.map((appointment) => {
                    const statusMeta = getStatusMeta(appointment);

                    return (
                      <button
                        key={appointment.id}
                        type="button"
                        onClick={() => onAppointmentClick(appointment)}
                        className={`flex w-full items-start justify-between gap-3 rounded-2xl border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${statusMeta.cardClass}`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${statusMeta.accentClass}`} />
                            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-700">
                              {appointment.time}
                            </span>
                          </div>
                          <p className="mt-2 truncate text-sm font-black text-slate-900">
                            {appointment.patient?.fullName}
                          </p>
                          {statusMeta.showCoverageBadge && (
                            <span className={`mt-2 inline-flex rounded-full border ${statusMeta.coverageBorderClass} px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${statusMeta.coverageBadgeClass}`}>
                              {getCoverageLabel(appointment.patient?.healthInsurance, appointment.patient?.treatAsParticular)}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {statusMeta.icon}
                          <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${statusMeta.badgeClass}`}>
                            {statusMeta.label}
                          </span>
                          {appointment.paidInAdvance && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                              <Banknote size={11} />
                              Pago
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}

                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDayOpen(day);
                    }}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-full bg-slate-900 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-slate-700"
                  >
                    Ver {hiddenCount} más
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => onOpenWeek(day)}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 transition hover:border-teal-500 hover:text-teal-600"
              >
                Abrir semana
                <ChevronRight size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
        <div className="grid min-w-[860px] grid-cols-6">
          {WEEKDAY_HEADERS.map((header) => (
            <div
              key={header}
              className="border-b border-r border-slate-200 bg-slate-100 px-3 py-3 text-center text-[11px] font-black uppercase tracking-[0.24em] text-slate-500 last:border-r-0"
            >
              {header}
            </div>
          ))}

          {monthDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayAppointments = appointmentsByDay[dateKey] || [];
            const visibleAppointments = dayAppointments.slice(0, VISIBLE_APPOINTMENTS_PER_DAY);
            const hiddenCount = dayAppointments.length - visibleAppointments.length;
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isCurrentDay = isToday(day);
            const availability = scheduleByDay[day.getDay()];

            return (
              <div
                key={dateKey}
                role="button"
                tabIndex={0}
                onClick={() => onOpenWeek(day)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenWeek(day);
                  }
                }}
                className={`flex min-h-[15rem] flex-col border-b border-r border-slate-200 p-3 text-left transition last:border-r-0 ${
                  isCurrentMonth
                    ? 'cursor-pointer bg-white hover:bg-slate-50'
                    : 'cursor-pointer bg-slate-50/70 text-slate-400 hover:bg-slate-100/80'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-black ${
                      isCurrentDay
                        ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/20'
                        : isCurrentMonth
                          ? 'bg-slate-100 text-slate-800'
                          : 'bg-white text-slate-400'
                    }`}>
                      {format(day, 'd')}
                    </div>
                    <div>
                      <p className={`text-[11px] font-black uppercase tracking-[0.18em] ${isCurrentMonth ? 'text-slate-400' : 'text-slate-300'}`}>
                        {format(day, 'MMM', { locale: es })}
                      </p>
                      {isCurrentDay && (
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-600">Hoy</p>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    {availability ? (
                      <p className="rounded-full bg-teal-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-teal-700">
                        {availability}
                      </p>
                    ) : (
                      <p className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        Sin horario
                      </p>
                    )}
                    <p className={`mt-2 text-xs font-black ${isCurrentMonth ? 'text-slate-700' : 'text-slate-400'}`}>
                      {dayAppointments.length === 0 ? 'Sin turnos' : `${dayAppointments.length} turno${dayAppointments.length === 1 ? '' : 's'}`}
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {visibleAppointments.map((appointment) => {
                    const statusMeta = getStatusMeta(appointment);

                    return (
                      <button
                        key={appointment.id}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onAppointmentClick(appointment);
                        }}
                        className={`w-full rounded-2xl border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${statusMeta.cardClass}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${statusMeta.accentClass}`} />
                            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-700">
                              {appointment.time}
                            </span>
                          </div>
                          {statusMeta.icon}
                        </div>

                        <p className="mt-2 truncate text-sm font-black text-slate-900">
                          {appointment.patient?.fullName}
                        </p>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          {statusMeta.showCoverageBadge && (
                            <span className={`rounded-full border ${statusMeta.coverageBorderClass} px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${statusMeta.coverageBadgeClass}`}>
                              {getCoverageLabel(appointment.patient?.healthInsurance, appointment.patient?.treatAsParticular)}
                            </span>
                          )}
                          <div className="flex flex-wrap justify-end gap-1">
                            {appointment.paidInAdvance && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                                <Banknote size={11} />
                                Pago
                              </span>
                            )}
                            <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${statusMeta.badgeClass}`}>
                              {statusMeta.label}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-2 text-slate-400">
                          {appointment.patient?.hasCancer && <AlertTriangle size={12} className="text-rose-500" title="Oncológico" />}
                          {appointment.patient?.hasMarcapasos && <Activity size={12} className="stroke-[2.6] text-blue-600" title="Marcapasos" />}
                          {appointment.patient?.usesEA && <Zap size={12} className="fill-amber-500 text-amber-500" title="Electroanalgesia" />}
                          {appointment.patient?.usesWheelchair && <span className="text-[13px]" title="Silla de ruedas">🦽</span>}
                          {appointment.patient?.isIU && <span className="text-[13px]" title="Tratamiento IU / piso pélvico">💧</span>}
                          {appointment.patient?.isRespiratory && <span className="text-[13px]" title="Respiratorio">🫁</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-auto pt-3">
                  {hiddenCount > 0 ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDayOpen(day);
                      }}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-slate-700"
                    >
                      Ver {hiddenCount} más
                      <ChevronRight size={14} />
                    </button>
                  ) : (
                    <div className={`inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.18em] ${
                      isCurrentMonth ? 'text-slate-400' : 'text-slate-300'
                    }`}>
                      Abrir semana
                      <ChevronRight size={14} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MonthlyCalendarGrid;
