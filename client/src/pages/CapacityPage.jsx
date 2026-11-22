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

const SummaryCard = ({ label, value, description, definition, icon, tone = 'neutral' }) => {
  const resolvedTone = getTone(tone);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" title={definition || undefined}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</p>
          <p className={`mt-2 text-2xl font-black leading-tight ${resolvedTone.text}`}>{value}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{description}</p>
          {definition && (
            <p className="mt-2 text-[11px] font-medium leading-snug text-slate-400">{definition}</p>
          )}
        </div>
        <div className={`shrink-0 rounded-xl p-3 ${resolvedTone.badge}`}>
          {React.createElement(icon, { size: 20 })}
        </div>
      </div>
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
  const saturation = capacity?.saturation || {};
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
      value: formatNumber(currentMonth.monthlyCapacity),
      description: `Esta semana (${weekRange}): ${formatNumber(currentWeek.capacity)}${weekClosuresText} · semana estándar: ${formatNumber(currentWeek.standardCapacity)}`,
      definition: definitions.capacity,
      icon: Gauge,
      tone: 'neutral',
    },
    {
      label: 'Turnos asistidos',
      value: formatCount(currentMonth.completedCount),
      description: currentMonth.isPartial ? `Mes en curso, hasta el ${asOfLabel}` : 'Mes cerrado',
      definition: definitions.attended,
      icon: CheckCircle2,
      tone: 'success',
    },
    {
      label: 'Turnos reservados',
      value: formatCount(currentMonthForDisplay.occupiedCount),
      description: `${formatCount(breakdown.attended)} asistidos · ${formatCount(breakdown.noShow)} inasistencias · ${formatCount(breakdown.pendingPast)} sin cerrar · ${formatCount(breakdown.upcoming)} próximos`,
      definition: definitions.reserved,
      icon: Users,
      tone: 'neutral',
    },
    {
      label: 'Ocupación del mes',
      value: formatRate(currentMonth.occupancyRate),
      description: 'Reservados / capacidad (incluye turnos futuros del mes)',
      definition: definitions.occupancy,
      icon: TrendingUp,
      tone: occupationTone,
    },
    {
      label: 'Capacidad libre',
      value: formatNumber(currentMonth.freeMonthlyCapacity),
      description: `${formatNumber(currentMonth.monthlyCapacity)} − ${formatCount(currentMonthForDisplay.occupiedCount)} reservados`,
      definition: definitions.freeCapacity,
      icon: Clock3,
      tone: 'warning',
    },
    {
      label: 'Pacientes activos',
      value: formatCount(currentMonth.activePatients),
      description: `${formatCount(patients.attendedThisMonth)} atendidos · ${formatCount(patients.newThisMonth)} nuevos · ${formatCount(patients.withUpcoming)} con próximo turno`,
      definition: definitions.activePatients,
      icon: Users,
      tone: 'neutral',
    },
    {
      label: 'Agenda futura',
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
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-teal-600">KIS · Fase 2</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Capacidad Operativa y Ocupación</h1>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-500">
              Mide cuánto puede producir Kareh, qué porcentaje usa y qué soporte operativo se justifica por datos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchCapacity()}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600 shadow-sm transition hover:bg-slate-100 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </header>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Conciliación del mes · al {asOfLabel}</p>
            <dl className="mt-3 space-y-1 text-sm font-semibold text-slate-600" aria-label="Conciliación de capacidad del mes">
              {[
                ['Capacidad', breakdown.capacity, 'font-black text-slate-900'],
                ['Asistidos', breakdown.attended, 'text-teal-700'],
                ['Inasistencias', breakdown.noShow, ''],
                ['Pasados sin cerrar', breakdown.pendingPast, breakdown.pendingPast > 0 ? 'text-amber-700' : ''],
                ['Próximos del mes', breakdown.upcoming, ''],
                ...(breakdown.otherStatus > 0 ? [['Otros estados', breakdown.otherStatus, 'text-amber-700']] : []),
                ['= Reservados', breakdown.reserved, 'font-black text-slate-900'],
                ['Capacidad libre', breakdown.free, 'font-black'],
                ['Cancelados (liberan lugar)', breakdown.cancelled, 'text-slate-400'],
              ].map(([label, value, className]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt>{label}</dt>
                  <dd className={className}>{formatCount(value)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs font-bold text-slate-500">Cuello de botella: {bottleneck.label || 'Sin diagnóstico'}</p>
          </div>

          <div className={`rounded-2xl border bg-white p-5 shadow-sm ${adminAlert.recommended ? 'border-amber-200' : 'border-slate-200'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Soporte administrativo</p>
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
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Segundo kinesiólogo</p>
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
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Histórico mensual</p>
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
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
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

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Lectura automática</p>
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

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Saturación por día y franja · últimas 8 semanas</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{definitions.slotSaturation}</p>
          {(saturation.byDayOfWeek || []).length === 0 ? (
            <p className="mt-4 text-sm font-semibold text-slate-400">Datos insuficientes.</p>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {saturation.byDayOfWeek.map((day) => (
                  <div key={day.dayOfWeek} className="rounded-xl bg-slate-50 px-3 py-3 text-center">
                    <p className="text-[10px] font-black uppercase text-slate-400">{dayLabels[day.dayOfWeek]}</p>
                    <p className="mt-1 text-lg font-black text-slate-900">{formatRate(day.occupancyRate)}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-black text-slate-600">
                  Franjas más ocupadas · {formatCount(saturation.saturatedSlotCount)} saturadas de {formatCount(saturation.slotCount)}
                </p>
                <ul className="mt-2 space-y-1 text-sm font-semibold text-slate-600">
                  {(saturation.topSlots || []).map((slot) => (
                    <li key={`${slot.dayOfWeek}-${slot.time}`} className="flex justify-between">
                      <span>{dayLabels[slot.dayOfWeek]} {slot.time}</span>
                      <span className={slot.saturated ? 'font-black text-rose-700' : 'font-black'}>{formatRate(slot.occupancyRate)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Por profesional</p>
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
