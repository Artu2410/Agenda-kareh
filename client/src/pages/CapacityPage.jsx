import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Gauge,
  Lightbulb,
  Loader2,
  RefreshCw,
  Stethoscope,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../services/api';
import { showErrorToast } from '../components/toastHelpers';
import { getHistoricalAxisMax } from '../utils/capacityChart';

const dayLabels = {
  0: 'Dom',
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
};

const formatNumber = (value, options = {}) =>
  new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: options.maximumFractionDigits ?? 1,
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
  }).format(Number(value) || 0);

const formatCount = (value) =>
  new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Number(value) || 0);

const formatRate = (value) => `${formatNumber(value, { maximumFractionDigits: 1 })}%`;

const firstPositiveNumber = (...values) => {
  const positiveValue = values.find((value) => Number(value) > 0);
  return positiveValue === undefined ? 0 : Number(positiveValue);
};

const getOccupiedCount = (row = {}, { includeCompleted = false } = {}) => firstPositiveNumber(
  row.occupiedCount,
  row.monthlyAppointmentCount,
  row.appointmentCount,
  row.turns,
  ...(includeCompleted ? [row.completedCount] : []),
);

const formatDate = (value) => {
  if (!value) return 'Sin datos';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin datos';
  return date.toLocaleDateString('es-AR');
};

const toneClassNames = {
  neutral: {
    card: 'border-slate-200 bg-slate-50 text-slate-700',
    badge: 'bg-slate-100 text-slate-700',
    text: 'text-slate-700',
  },
  success: {
    card: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
    text: 'text-emerald-700',
  },
  warning: {
    card: 'border-amber-200 bg-amber-50 text-amber-800',
    badge: 'bg-amber-100 text-amber-800',
    text: 'text-amber-700',
  },
  danger: {
    card: 'border-rose-200 bg-rose-50 text-rose-700',
    badge: 'bg-rose-100 text-rose-700',
    text: 'text-rose-700',
  },
  critical: {
    card: 'border-red-300 bg-red-50 text-red-800',
    badge: 'bg-red-100 text-red-800',
    text: 'text-red-800',
  },
};

const getTone = (tone = 'neutral') => toneClassNames[tone] || toneClassNames.neutral;

const accentClassNames = {
  teal: { bar: 'from-teal-500 to-emerald-400', chip: 'bg-teal-50 text-teal-700 ring-teal-100', value: 'text-slate-900' },
  emerald: { bar: 'from-emerald-500 to-lime-400', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-100', value: 'text-emerald-700' },
  sky: { bar: 'from-sky-500 to-cyan-400', chip: 'bg-sky-50 text-sky-700 ring-sky-100', value: 'text-slate-900' },
  amber: { bar: 'from-amber-500 to-orange-400', chip: 'bg-amber-50 text-amber-700 ring-amber-100', value: 'text-amber-700' },
  violet: { bar: 'from-violet-500 to-fuchsia-400', chip: 'bg-violet-50 text-violet-700 ring-violet-100', value: 'text-slate-900' },
  indigo: { bar: 'from-indigo-500 to-sky-400', chip: 'bg-indigo-50 text-indigo-700 ring-indigo-100', value: 'text-slate-900' },
  rose: { bar: 'from-rose-500 to-pink-400', chip: 'bg-rose-50 text-rose-700 ring-rose-100', value: 'text-rose-700' },
};

const toneToAccent = { success: 'emerald', warning: 'amber', danger: 'rose', critical: 'rose', neutral: 'teal' };

const formatWeekRange = (week) => {
  const toLabel = (key) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;
  return `${toLabel(week.weekStart)} – ${toLabel(week.weekEnd)}`;
};

const getHeatClassName = (rate) => {
  const value = Number(rate) || 0;
  if (value >= 90) return 'bg-rose-500 text-white';
  if (value >= 70) return 'bg-amber-400 text-amber-950';
  if (value >= 40) return 'bg-teal-400 text-teal-950';
  if (value >= 15) return 'bg-teal-200 text-teal-900';
  return 'bg-teal-50 text-teal-800';
};

const ChartSurface = ({ children }) => {
  const containerRef = useRef(null);
  const [canRenderChart, setCanRenderChart] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const updateAvailability = () => {
      const { width, height } = node.getBoundingClientRect();
      setCanRenderChart(width > 0 && height > 0);
    };

    updateAvailability();
    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(updateAvailability);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="h-[340px] min-h-[340px] w-full min-w-0">
      {canRenderChart ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={340}>
          {children}
        </ResponsiveContainer>
      ) : (
        <div className="h-full w-full animate-pulse rounded-2xl bg-slate-100" />
      )}
    </div>
  );
};

const SummaryCard = ({ label, value, description, definition, icon, accent = 'teal' }) => {
  const resolvedAccent = accentClassNames[accent] || accentClassNames.teal;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
      <div className={`absolute inset-x-0 top-0 h-1 bg-linear-to-r ${resolvedAccent.bar}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className={`mt-2 text-3xl font-black leading-tight tracking-tight ${resolvedAccent.value}`}>{value}</p>
          <p className="mt-1.5 text-xs font-semibold leading-relaxed text-slate-500">{description}</p>
        </div>
        <div className={`shrink-0 rounded-2xl p-3 ring-1 ${resolvedAccent.chip}`}>
          {React.createElement(icon, { size: 20 })}
        </div>
      </div>
      {definition && (
        <details className="group mt-3 border-t border-slate-100 pt-2">
          <summary className="cursor-pointer list-none text-[11px] font-bold text-teal-700 hover:text-teal-800">
            ¿Cómo se calcula?
          </summary>
          <p className="mt-1.5 text-[11px] font-medium leading-snug text-slate-500">{definition}</p>
        </details>
      )}
    </section>
  );
};

const CriteriaList = ({ recommendation }) => (
  <div className="mt-4 grid gap-2">
    {(recommendation?.criteria || []).map((criterion) => (
      <div
        key={criterion.key}
        className={`flex items-start justify-between gap-3 rounded-xl px-3 py-3 ${
          criterion.met
            ? 'bg-emerald-50 text-emerald-800'
            : criterion.measured
              ? 'bg-slate-50 text-slate-600'
              : 'bg-amber-50 text-amber-800'
        }`}
      >
        <div>
          <p className="text-sm font-black">{criterion.label}</p>
          {!criterion.measured && (
            <p className="mt-1 text-xs font-semibold">No disponible: dato no registrado en el sistema</p>
          )}
        </div>
        <span className="shrink-0 text-xs font-black uppercase tracking-[0.16em]">
          {!criterion.measured
            ? 'Sin dato'
            : recommendation?.status === 'INSUFFICIENT_DATA'
              ? formatNumber(criterion.value)
              : criterion.met ? 'Cumple' : 'No'}
        </span>
      </div>
    ))}
  </div>
);

const buildOperationalInsights = ({ currentMonth, bottleneck, adminAlert, operationalStatus }) => {
  const breakdown = currentMonth?.breakdown || {};
  const insights = [
    {
      key: 'status',
      badge: 'Estado',
      tone: operationalStatus?.tone || 'neutral',
      title: operationalStatus?.label || 'Datos insuficientes',
      detail: operationalStatus?.description || 'No hay datos para clasificar.',
    },
    {
      key: 'bottleneck',
      badge: 'Foco',
      tone: bottleneck?.key === 'DEMAND' || bottleneck?.key === 'NO_CRITICAL_BOTTLENECK' ? 'neutral' : 'warning',
      title: bottleneck?.label || 'Sin diagnóstico',
      detail: bottleneck?.description || 'Todavía no hay datos suficientes.',
    },
    {
      key: 'admin',
      badge: 'Sin dato',
      tone: 'neutral',
      title: adminAlert?.label || 'Datos insuficientes para recomendar contratación',
      detail: adminAlert?.suggestedSupport
        ? `Según el volumen: ${adminAlert.suggestedSupport}. Falta medir la carga administrativa real.`
        : 'Falta medir la carga administrativa real.',
    },
  ];

  if (breakdown.pendingPast > 0) {
    insights.unshift({
      key: 'unclosed',
      badge: 'Datos',
      tone: 'warning',
      title: `${formatCount(breakdown.pendingPast)} turnos pasados sin cerrar`,
      detail: 'Marcalos como asistidos o inasistencias para que la asistencia del mes sea real.',
    });
  }

  return insights;
};

const InsightList = ({ insights }) => (
  <div className="mt-4 grid gap-3">
    {insights.map((insight) => {
      const resolvedTone = getTone(insight.tone);

      return (
        <div key={insight.key} className={`rounded-xl border px-4 py-3 ${resolvedTone.card}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-black">{insight.title}</p>
              <p className={`mt-1 text-xs font-semibold ${resolvedTone.text} opacity-85`}>{insight.detail}</p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${resolvedTone.badge}`}>
              {insight.badge}
            </span>
          </div>
        </div>
      );
    })}
  </div>
);

const CapacityTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;

  const row = payload[0].payload;

  return (
    <div className="min-w-[230px] rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">{row.label}</p>
      <div className="mt-3 space-y-2 text-sm font-semibold text-slate-600">
        <div className="flex items-center justify-between gap-3">
          <span>Capacidad</span>
          <span className="font-black text-slate-900">{formatNumber(row.capacity)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Turnos ocupados</span>
          <span className="font-black text-slate-900">{formatCount(row.occupiedCount)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Turnos asistidos</span>
          <span className="font-black text-teal-700">{formatCount(row.attendedCount)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Ocupación</span>
          <span className="font-black text-amber-700">{formatRate(row.occupancyRate)}</span>
        </div>
      </div>
    </div>
  );
};

const formatScheduleSummary = (workSchedule = []) => {
  if (!workSchedule.length) return 'Sin horario configurado';

  return workSchedule
    .map((item) => `${dayLabels[item.dayOfWeek] || item.dayOfWeek} ${item.startTime}-${item.endTime}`)
    .join(' · ');
};

const CapacityPage = () => {
  const [capacity, setCapacity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historyView, setHistoryView] = useState('year');
  // null = semana actual; si no, índice dentro de weeklySaturation.
  const [weekIndex, setWeekIndex] = useState(null);

  const fetchCapacity = useCallback(async ({ silent = false } = {}) => {
    try {
      setLoading(true);
      const { data } = await api.get('/capacity');
      setCapacity(data);
    } catch (error) {
      if (!silent) {
        showErrorToast(error?.friendlyMessage || 'No se pudo cargar capacidad operativa.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCapacity();
  }, [fetchCapacity]);

  const currentMonth = capacity?.currentMonth || {};
  const futureCoverage = capacity?.futureCoverage || {};
  const bottleneck = capacity?.bottleneck || {};
  const currentMonthForDisplay = {
    ...currentMonth,
    occupiedCount: getOccupiedCount(currentMonth),
  };
  const occupationTone = currentMonth?.level?.tone || 'neutral';
  const adminAlert = capacity?.alerts?.admin || {};
  const kinesiologistAlert = capacity?.alerts?.kinesiologist || {};
  const operationalStatus = capacity?.operationalStatus || {};
  const definitions = capacity?.definitions || {};
  const breakdown = currentMonth?.breakdown || {};
  const patients = currentMonth?.patients || {};
  const currentWeek = capacity?.currentWeek || {};
  const weeklySaturation = capacity?.weeklySaturation || [];
  const currentWeekIndex = Math.max(weeklySaturation.findIndex((week) => week.isCurrent), 0);
  const resolvedWeekIndex = weekIndex ?? currentWeekIndex;
  const selectedWeek = weeklySaturation[resolvedWeekIndex] || null;
  const futureWindow = futureCoverage?.window || {};
  const asOfLabel = formatDate(currentMonth?.asOf ? `${currentMonth.asOf}T12:00:00` : capacity?.generatedAt);
  const operationalInsights = buildOperationalInsights({
    currentMonth,
    bottleneck,
    adminAlert,
    operationalStatus,
  });
  const monthlyTrend = (capacity?.monthlyTrend || []).map((row) => ({
    ...row,
    occupiedCount: getOccupiedCount(row, { includeCompleted: true }),
    attendedCount: firstPositiveNumber(row.attendedCount, row.completedCount),
  }));
  const visibleMonthlyTrend = historyView === 'year' ? monthlyTrend : monthlyTrend.slice(-6);
  const historicalAxisMax = getHistoricalAxisMax(visibleMonthlyTrend);

  const weekRange = currentWeek.start
    ? `${formatDate(currentWeek.start)} – ${formatDate(currentWeek.end)}`
    : 'semana actual';
  const weekClosuresText = (currentWeek.closures || []).length > 0
    ? `, ${currentWeek.closures.length} día(s) cerrado(s)`
    : '';

  const summaryCards = [
    {
      label: 'Capacidad del mes',
      accent: 'teal',
      value: formatNumber(currentMonth.monthlyCapacity),
      description: `Esta semana (${weekRange}): ${formatNumber(currentWeek.capacity)}${weekClosuresText} · semana estándar: ${formatNumber(currentWeek.standardCapacity)}`,
      definition: definitions.capacity,
      icon: Gauge,
      tone: 'neutral',
    },
    {
      label: 'Turnos asistidos',
      accent: 'emerald',
      value: formatCount(currentMonth.completedCount),
      description: currentMonth.isPartial ? `Mes en curso, hasta el ${asOfLabel}` : 'Mes cerrado',
      definition: definitions.attended,
      icon: CheckCircle2,
      tone: 'success',
    },
    {
      label: 'Turnos reservados',
      accent: 'sky',
      value: formatCount(currentMonthForDisplay.occupiedCount),
      description: `${formatCount(breakdown.attended)} asistidos · ${formatCount(breakdown.noShow)} inasistencias · ${formatCount(breakdown.pendingPast)} sin cerrar · ${formatCount(breakdown.upcoming)} próximos`,
      definition: definitions.reserved,
      icon: Users,
      tone: 'neutral',
    },
    {
      label: 'Ocupación del mes',
      accent: 'indigo',
      value: formatRate(currentMonth.occupancyRate),
      description: 'Reservados / capacidad (incluye turnos futuros del mes)',
      definition: definitions.occupancy,
      icon: TrendingUp,
      tone: occupationTone,
    },
    {
      label: 'Capacidad libre',
      accent: 'amber',
      value: formatNumber(currentMonth.freeMonthlyCapacity),
      description: `${formatNumber(currentMonth.monthlyCapacity)} − ${formatCount(currentMonthForDisplay.occupiedCount)} reservados`,
      definition: definitions.freeCapacity,
      icon: Clock3,
      tone: 'warning',
    },
    {
      label: 'Pacientes activos',
      accent: 'violet',
      value: formatCount(currentMonth.activePatients),
      description: `${formatCount(patients.attendedThisMonth)} atendidos · ${formatCount(patients.newThisMonth)} nuevos · ${formatCount(patients.withUpcoming)} con próximo turno`,
      definition: definitions.activePatients,
      icon: Users,
      tone: 'neutral',
    },
    {
      label: 'Agenda futura',
      accent: 'sky',
      value: `${formatCount(futureCoverage.daysWithAppointments)} días con turnos`,
      description: futureCoverage.lastAppointmentDate || futureCoverage.farthestDate
        ? `${formatCount(futureCoverage.appointmentCount)} turnos · último: ${formatDate(futureCoverage.lastAppointmentDate || futureCoverage.farthestDate)} (a ${formatCount(futureCoverage.calendarDaysToLastAppointment ?? futureCoverage.daysCovered)} días calendario)`
        : 'Sin turnos futuros',
      definition: [definitions.daysWithAppointments, definitions.calendarDaysToLastAppointment].filter(Boolean).join(' '),
      icon: CalendarDays,
      tone: 'neutral',
    },
    {
      label: 'Agenda próximos 60 días',
      accent: 'indigo',
      value: futureWindow.occupancyRate === null || futureWindow.occupancyRate === undefined
        ? 'No disponible'
        : formatRate(futureWindow.occupancyRate),
      description: `${formatCount(futureWindow.reserved)} de ${formatNumber(futureWindow.capacity)} lugares · ${formatCount(futureCoverage.weeksWithAppointments)} semanas con turnos`,
      definition: definitions.futureOccupancy,
      icon: BarChart3,
      tone: 'neutral',
    },
    {
      label: 'Estado operativo',
      accent: toneToAccent[operationalStatus.tone] || 'teal',
      value: operationalStatus.label || 'Datos insuficientes',
      description: operationalStatus.description || 'Faltan datos para clasificar',
      icon: AlertTriangle,
      tone: operationalStatus.tone || 'neutral',
    },
  ];

  if (loading && !capacity) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 p-8">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
          <Loader2 className="mx-auto animate-spin text-teal-600" size={32} />
          <p className="mt-4 text-sm font-black uppercase tracking-[0.24em] text-slate-400">Capacidad operativa</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">Calculando ocupación</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-teal-50/60 via-slate-50 to-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="relative mb-6 overflow-hidden rounded-3xl bg-linear-to-br from-teal-700 via-teal-600 to-emerald-500 p-6 text-white shadow-lg sm:p-8">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-teal-100">KIS · Fase 2</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Capacidad Operativa y Ocupación</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium text-teal-50/90">
                Cuánto puede atender Kareh, qué parte de esa capacidad se usa y qué decisiones respaldan los datos.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl bg-white/15 px-4 py-3 ring-1 ring-white/25 backdrop-blur">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-100">Estado operativo</p>
                <p className="mt-0.5 text-lg font-black">{operationalStatus.label || 'Datos insuficientes'}</p>
              </div>
              <div className="rounded-2xl bg-white/15 px-4 py-3 ring-1 ring-white/25 backdrop-blur">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-100">Ocupación del mes</p>
                <p className="mt-0.5 text-lg font-black">{formatRate(currentMonth.occupancyRate)}</p>
              </div>
              <button
                type="button"
                onClick={() => fetchCapacity()}
                disabled={loading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-teal-700 shadow-sm transition hover:bg-teal-50 disabled:opacity-60"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                Actualizar
              </button>
            </div>
          </div>
          <p className="relative mt-4 text-xs font-semibold text-teal-100">Datos al {asOfLabel} · el mes en curso todavía no está cerrado.</p>
        </header>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-teal-700">Conciliación del mes · al {asOfLabel}</p>
            <dl className="mt-3 space-y-1 text-sm font-semibold text-slate-600" aria-label="Conciliación de capacidad del mes">
              {[
                ['Capacidad', breakdown.capacity, 'font-black text-slate-900', 'bg-slate-400'],
                ['Asistidos', breakdown.attended, 'font-bold text-emerald-700', 'bg-emerald-500'],
                ['Inasistencias', breakdown.noShow, 'font-bold text-rose-700', 'bg-rose-500'],
                ['Pasados sin cerrar', breakdown.pendingPast, breakdown.pendingPast > 0 ? 'font-bold text-amber-700' : '', 'bg-amber-400'],
                ['Próximos del mes', breakdown.upcoming, 'font-bold text-sky-700', 'bg-sky-500'],
                ...(breakdown.otherStatus > 0 ? [['Otros estados', breakdown.otherStatus, 'text-amber-700', 'bg-amber-300']] : []),
                ['= Reservados', breakdown.reserved, 'font-black text-slate-900', 'bg-indigo-500'],
                ['Capacidad libre', breakdown.free, 'font-black text-teal-700', 'bg-teal-400'],
                ['Cancelados (liberan lugar)', breakdown.cancelled, 'text-slate-400', 'bg-slate-200'],
              ].map(([label, value, className, dot]) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1 hover:bg-slate-50">
                  <dt className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />{label}</dt>
                  <dd className={className}>{formatCount(value)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs font-bold text-slate-500">Cuello de botella: {bottleneck.label || 'Sin diagnóstico'}</p>
          </div>

          <div className={`rounded-2xl border bg-white p-5 shadow-sm ${adminAlert.recommended ? 'border-amber-200' : 'border-slate-200'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-teal-700">Soporte administrativo</p>
                <h2 className={`mt-2 text-xl font-black ${adminAlert.recommended ? 'text-amber-700' : 'text-slate-900'}`}>
                  {adminAlert.label || 'En observación'}
                </h2>
                {adminAlert.suggestedSupport && (
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Según volumen: {adminAlert.suggestedSupport}.
                  </p>
                )}
                {(adminAlert.reasons || []).map((reason) => (
                  <p key={reason} className="mt-1 text-xs font-semibold text-slate-400">{reason}</p>
                ))}
              </div>
              <BriefcaseBusiness className={adminAlert.recommended ? 'text-amber-600' : 'text-slate-300'} size={24} />
            </div>
            <CriteriaList recommendation={adminAlert} />
          </div>

          <div className={`rounded-2xl border bg-white p-5 shadow-sm ${kinesiologistAlert.recommended ? 'border-rose-200' : 'border-slate-200'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-teal-700">Segundo kinesiólogo</p>
                <h2 className={`mt-2 text-xl font-black ${kinesiologistAlert.recommended ? 'text-rose-700' : 'text-slate-900'}`}>
                  {kinesiologistAlert.label || 'En observación'}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {kinesiologistAlert.metCount || 0} de {kinesiologistAlert.requiredCount || 3} criterios obligatorios.
                </p>
              </div>
              <UserPlus className={kinesiologistAlert.recommended ? 'text-rose-600' : 'text-slate-300'} size={24} />
            </div>
            <CriteriaList recommendation={kinesiologistAlert} />
          </div>
        </section>

        <section className="mb-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-teal-700">Histórico mensual</p>
                <h2 className="mt-2 text-xl font-black text-slate-900">Capacidad, ocupación y asistencia</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  La ocupación usa turnos no cancelados; la asistencia, turnos efectivamente atendidos. El mes en curso no está cerrado. La capacidad de meses pasados es una estimación con los horarios actuales.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start rounded-xl bg-slate-100 p-1" aria-label="Período del histórico">
                {[
                  { key: 'year', label: 'Todo el año' },
                  { key: 'recent', label: 'Últimos 6 meses' },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={historyView === option.key}
                    onClick={() => setHistoryView(option.key)}
                    className={`rounded-lg px-3 py-2 text-xs font-black transition ${historyView === option.key
                      ? 'bg-white text-teal-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {visibleMonthlyTrend.length > 0 ? (
              <ChartSurface>
                <ComposedChart data={visibleMonthlyTrend} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 700 }} tickLine={false} axisLine={false} minTickGap={12} />
                  <YAxis
                    yAxisId="left"
                    domain={[0, historicalAxisMax]}
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 'auto']}
                    tickFormatter={(value) => `${value}%`}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                  />
                  <RechartsTooltip content={<CapacityTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: 12 }} />
                  <Bar yAxisId="left" dataKey="capacity" name="Capacidad" fill="#cbd5e1" radius={[8, 8, 0, 0]} />
                  <Bar yAxisId="left" dataKey="attendedCount" name="Turnos asistidos" fill="#14b8a6" radius={[8, 8, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="occupancyRate" name="Ocupación %" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </ComposedChart>
              </ChartSurface>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm font-semibold text-slate-400">
                No hay meses con actividad suficiente.
              </div>
            )}

            {monthlyTrend.length > 0 && (
              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                <div className="border-b border-teal-100 bg-teal-50/70 px-4 py-3">
                  <h3 className="text-sm font-black text-slate-900">Detalle mensual</h3>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Desde el primer mes con turnos. Capacidad histórica estimada: no hay versiones de horarios anteriores.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <caption className="sr-only">Detalle mensual de capacidad y ocupación</caption>
                    <thead className="bg-white text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                      <tr>
                        <th scope="col" className="px-4 py-3">Mes</th>
                        <th scope="col" className="px-4 py-3 text-right">Capacidad</th>
                        <th scope="col" className="px-4 py-3 text-right">Ocupados</th>
                        <th scope="col" className="px-4 py-3 text-right">Asistidos</th>
                        <th scope="col" className="px-4 py-3 text-right">Ocupación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {monthlyTrend.map((row) => (
                        <tr key={row.monthKey} className={row.isCurrentMonth ? 'bg-amber-50/60 text-slate-600' : 'bg-white text-slate-600'}>
                          <th scope="row" className="whitespace-nowrap px-4 py-3 font-black text-slate-800">{row.label || row.month}</th>
                          <td className="px-4 py-3 text-right font-semibold">{formatNumber(row.capacity)}</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatCount(row.occupiedCount)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-teal-700">{formatCount(row.attendedCount)}</td>
                          <td className="px-4 py-3 text-right font-black text-amber-700">{formatRate(row.occupancyRate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-teal-700">Lectura automática</p>
                <h2 className="mt-2 text-xl font-black text-slate-900">Insights automáticos</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Lo importante del mes, resumido en señales accionables.
                </p>
              </div>
              <Lightbulb className="text-slate-300" size={24} />
            </div>
            <InsightList insights={operationalInsights} />
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-teal-700">Saturación semanal por día y franja</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Turnos citados / lugares disponibles de cada día. Debajo, los pacientes citados.
              </p>
            </div>
            {selectedWeek && (
              <div className="flex items-center gap-2 self-start" aria-label="Recorrido semanal">
                <button
                  type="button"
                  onClick={() => setWeekIndex((index) => Math.max(index - 1, 0))}
                  disabled={resolvedWeekIndex === 0}
                  aria-label="Semana anterior"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-lg font-black text-slate-600 hover:bg-teal-50 disabled:opacity-40"
                >
                  ‹
                </button>
                <div className="min-w-[170px] rounded-xl bg-teal-50 px-3 py-2 text-center ring-1 ring-teal-100">
                  <p className="text-sm font-black text-teal-800">{formatWeekRange(selectedWeek)}</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-600">
                    {selectedWeek.isCurrent ? 'Semana actual' : selectedWeek.isFuture ? 'Agenda futura' : `Hace ${Math.abs(selectedWeek.offset)} sem.`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWeekIndex((index) => Math.min(index + 1, weeklySaturation.length - 1))}
                  disabled={resolvedWeekIndex >= weeklySaturation.length - 1}
                  aria-label="Semana siguiente"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-lg font-black text-slate-600 hover:bg-teal-50 disabled:opacity-40"
                >
                  ›
                </button>
                {!selectedWeek.isCurrent && (
                  <button
                    type="button"
                    onClick={() => setWeekIndex(null)}
                    className="min-h-10 rounded-xl px-3 text-xs font-bold text-teal-700 hover:bg-teal-50"
                  >
                    Hoy
                  </button>
                )}
              </div>
            )}
          </div>

          {!selectedWeek ? (
            <p className="mt-4 text-sm font-semibold text-slate-400">Datos insuficientes.</p>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Ocupación de la semana: {formatRate(selectedWeek.occupancyRate)}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{formatCount(selectedWeek.reserved)} turnos de {formatCount(selectedWeek.capacity)} lugares</span>
                <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-700">{formatCount(selectedWeek.patients)} pacientes distintos</span>
                {selectedWeek.saturatedSlotCount > 0 && (
                  <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">{formatCount(selectedWeek.saturatedSlotCount)} franjas saturadas</span>
                )}
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {selectedWeek.days.map((day) => {
                    const isClosed = (selectedWeek.closedDays || []).includes(day.date);
                    return (
                      <div
                        key={day.dayOfWeek}
                        className={`rounded-2xl px-3 py-3 text-center ${isClosed ? 'bg-slate-100 text-slate-400' : getHeatClassName(day.occupancyRate)}`}
                      >
                        <p className="text-[10px] font-black uppercase opacity-80">
                          {dayLabels[day.dayOfWeek]}{day.date ? ` ${day.date.slice(8, 10)}/${day.date.slice(5, 7)}` : ''}
                        </p>
                        <p className="mt-1 text-lg font-black">{isClosed ? 'Cerrado' : formatRate(day.occupancyRate)}</p>
                        {!isClosed && (
                          <p className="mt-0.5 text-[11px] font-bold opacity-90">
                            {formatCount(day.patients)} {day.patients === 1 ? 'paciente' : 'pacientes'}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div>
                  <p className="text-xs font-black text-slate-600">Franjas más ocupadas de la semana</p>
                  {(selectedWeek.topSlots || []).length === 0 ? (
                    <p className="mt-2 text-sm font-semibold text-slate-400">Sin turnos citados esta semana.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-sm font-semibold text-slate-600">
                      {selectedWeek.topSlots.map((slot) => (
                        <li key={`${slot.dayOfWeek}-${slot.time}`} className="flex justify-between gap-3">
                          <span>{dayLabels[slot.dayOfWeek]} {slot.time}</span>
                          <span className={slot.saturated ? 'font-black text-rose-700' : 'font-black text-slate-800'}>
                            {formatRate(slot.occupancyRate)} · {formatCount(slot.reserved)}/{formatCount(slot.capacity)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-teal-700">Por profesional</p>
              <h2 className="mt-2 text-xl font-black text-slate-900">Capacidad y ocupación individual</h2>
            </div>
            <Stethoscope className="text-slate-300" size={24} />
          </div>

          {(capacity?.professionals || []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm font-semibold text-slate-400">
              No hay profesionales activos con datos de agenda.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {capacity.professionals.map((professional) => {
                const levelTone = getTone(professional.level?.tone);
                const occupiedCount = getOccupiedCount(professional);

                return (
                  <article key={professional.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black text-slate-900">{professional.fullName}</h3>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{formatScheduleSummary(professional.workSchedule)}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${levelTone.badge}`}>
                        {professional.level?.label || 'Sin datos'}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                      <div className="rounded-xl bg-white px-3 py-3">
                        <p className="text-[10px] font-black uppercase text-slate-400">Horas sem.</p>
                        <p className="mt-1 text-lg font-black text-slate-900">{formatNumber(professional.availableHoursWeekly)}</p>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-3">
                        <p className="text-[10px] font-black uppercase text-slate-400">Cap. mes</p>
                        <p className="mt-1 text-lg font-black text-slate-900">{formatNumber(professional.monthlyCapacity)}</p>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-3">
                        <p className="text-[10px] font-black uppercase text-slate-400">Asistidos</p>
                        <p className="mt-1 text-lg font-black text-teal-700">{formatCount(professional.completedCount)}</p>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-3">
                        <p className="text-[10px] font-black uppercase text-slate-400">Turnos ocupados</p>
                        <p className="mt-1 text-lg font-black text-slate-900">{formatCount(occupiedCount)}</p>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-3">
                        <p className="text-[10px] font-black uppercase text-slate-400">Ocupación</p>
                        <p className={`mt-1 text-lg font-black ${levelTone.text}`}>{formatRate(professional.occupancyRate)}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default CapacityPage;
