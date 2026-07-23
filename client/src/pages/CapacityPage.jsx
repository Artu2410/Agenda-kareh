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

const SummaryCard = ({ label, value, description, icon, tone = 'neutral' }) => {
  const resolvedTone = getTone(tone);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</p>
          <p className={`mt-2 text-2xl font-black leading-tight ${resolvedTone.text}`}>{value}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{description}</p>
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
            <p className="mt-1 text-xs font-semibold">Dato pendiente de medir</p>
          )}
        </div>
        <span className="shrink-0 text-xs font-black uppercase tracking-[0.16em]">
          {criterion.met ? 'Cumple' : criterion.measured ? 'No' : 'Sin dato'}
        </span>
      </div>
    ))}
  </div>
);

const buildOperationalInsights = ({ currentMonth, futureCoverage, bottleneck, adminAlert }) => {
  const occupancyRate = Number(currentMonth?.occupancyRate) || 0;
  const freeMonthlyCapacity = Number(currentMonth?.freeMonthlyCapacity) || 0;
  const daysCovered = Number(futureCoverage?.daysCovered) || 0;
  const adminRecommended = Boolean(adminAlert?.recommended);

  const occupancyTone = occupancyRate >= 85 ? 'critical' : occupancyRate >= 70 ? 'warning' : 'success';
  const capacityTone = bottleneck?.key === 'CONFIGURATION'
    ? 'critical'
    : freeMonthlyCapacity > 0
      ? 'success'
      : 'critical';

  const priorityInsight = (() => {
    if (bottleneck?.key === 'CONFIGURATION') {
      return {
        key: 'priority',
        badge: 'Config',
        tone: 'critical',
        title: 'Prioridad: completar la configuración operativa',
        detail: bottleneck?.description || 'No hay capacidad calculable con la configuración actual.',
      };
    }

    if (occupancyRate < 50) {
      return {
        key: 'priority',
        badge: 'Foco',
        tone: 'neutral',
        title: 'Prioridad: aumentar ocupación antes de contratar',
        detail: 'La capacidad disponible sigue siendo la palanca principal.',
      };
    }

    if (bottleneck?.key === 'ADMINISTRATION') {
      return {
        key: 'priority',
        badge: 'Foco',
        tone: 'warning',
        title: 'Prioridad: liberar carga administrativa',
        detail: bottleneck?.description || 'La carga operativa ya justifica soporte administrativo.',
      };
    }

    if (bottleneck?.key === 'CLINICAL_CAPACITY') {
      return {
        key: 'priority',
        badge: 'Foco',
        tone: 'warning',
        title: 'Prioridad: sumar capacidad clínica',
        detail: bottleneck?.description || 'La capacidad clínica es el límite principal.',
      };
    }

    if (daysCovered > 60) {
      return {
        key: 'priority',
        badge: 'Foco',
        tone: 'warning',
        title: 'Prioridad: ordenar demanda futura',
        detail: `La agenda futura cubre ${formatCount(daysCovered)} días.`,
      };
    }

    return {
      key: 'priority',
      badge: 'Foco',
      tone: 'neutral',
      title: 'Prioridad: monitorear el crecimiento',
      detail: 'El crecimiento todavía no exige nuevas estructuras.',
    };
  })();

  return [
    {
      key: 'occupancy',
      badge: occupancyRate >= 85 ? 'Riesgo' : occupancyRate >= 70 ? 'Alerta' : 'OK',
      tone: occupancyTone,
      title: `Ocupación actual: ${formatRate(occupancyRate)}`,
      detail: occupancyRate >= 70
        ? 'La agenda empieza a tensarse.'
        : 'Todavía hay margen para crecer.',
    },
    {
      key: 'admin',
      badge: adminRecommended ? 'Activado' : 'OK',
      tone: adminRecommended ? 'warning' : 'success',
      title: adminRecommended ? 'Se justifica soporte administrativo' : 'Todavía no se justifica administrativo',
      detail: adminRecommended
        ? `${adminAlert?.metCount || 0} criterios reales ya lo respaldan.`
        : 'La carga sigue dentro del rango operativo actual.',
    },
    {
      key: 'capacity',
      badge: bottleneck?.key === 'CONFIGURATION' ? 'Config' : freeMonthlyCapacity > 0 ? 'Libre' : 'Límite',
      tone: capacityTone,
      title: bottleneck?.key === 'CONFIGURATION'
        ? 'Todavía falta configurar horarios'
        : freeMonthlyCapacity > 0
          ? 'Hay capacidad disponible para crecer'
          : 'La capacidad calculada ya está al límite',
      detail: bottleneck?.key === 'CONFIGURATION'
        ? bottleneck?.description || 'No hay capacidad calculable con la configuración actual.'
        : freeMonthlyCapacity > 0
          ? `Quedan ${formatNumber(freeMonthlyCapacity)} turnos mensuales libres.`
          : 'La ocupación actual ya consume toda la capacidad modelada.',
    },
    priorityInsight,
  ];
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
          <span>Turnos registrados</span>
          <span className="font-black text-slate-900">{formatCount(row.turns ?? row.appointmentCount ?? row.completedCount)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Turnos asistidos</span>
          <span className="font-black text-teal-700">{formatCount(row.completedCount)}</span>
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
  const occupationTone = currentMonth?.level?.tone || 'neutral';
  const adminAlert = capacity?.alerts?.admin || {};
  const kinesiologistAlert = capacity?.alerts?.kinesiologist || {};
  const operationalInsights = buildOperationalInsights({
    currentMonth,
    futureCoverage,
    bottleneck,
    adminAlert,
  });
  const visibleMonthlyTrend = (capacity?.monthlyTrend || [])
    .filter((row) => (row.turns || 0) > 0 || (row.completed || row.completedCount || 0) > 0)
    .slice(-6);

  const summaryCards = [
    {
      label: 'Capacidad mensual',
      value: formatNumber(currentMonth.monthlyCapacity),
      description: `${formatNumber(currentMonth.weeklyCapacity)} turnos máximos por semana`,
      icon: Gauge,
      tone: 'neutral',
    },
    {
      label: 'Turnos realizados',
      value: formatCount(currentMonth.completedCount),
      description: 'Solo turnos asistidos',
      icon: CheckCircle2,
      tone: 'success',
    },
    {
      label: 'Ocupación real',
      value: formatRate(currentMonth.occupancyRate),
      description: currentMonth?.level?.label || 'Sin clasificación',
      icon: TrendingUp,
      tone: occupationTone,
    },
    {
      label: 'Capacidad libre',
      value: formatNumber(currentMonth.freeMonthlyCapacity),
      description: 'Turnos potenciales no usados',
      icon: Clock3,
      tone: 'warning',
    },
    {
      label: 'Pacientes activos',
      value: formatCount(currentMonth.activePatients),
      description: 'Con turnos activos en el mes',
      icon: Users,
      tone: 'neutral',
    },
    {
      label: 'Días cubiertos',
      value: formatCount(futureCoverage.daysCovered),
      description: `Último turno: ${formatDate(futureCoverage.farthestDate)}`,
      icon: CalendarDays,
      tone: futureCoverage.daysCovered > 60 ? 'warning' : 'neutral',
    },
    {
      label: 'Semanas cubiertas',
      value: formatNumber(futureCoverage.weeksCovered),
      description: `${formatNumber(futureCoverage.monthsCovered)} meses de agenda`,
      icon: BarChart3,
      tone: futureCoverage.weeksCovered > 8 ? 'warning' : 'neutral',
    },
    {
      label: 'Estado operativo',
      value: currentMonth?.level?.label || 'Sin datos',
      description: currentMonth?.level?.description || 'Faltan datos para clasificar',
      icon: AlertTriangle,
      tone: occupationTone,
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
          <div className={`rounded-2xl border p-5 shadow-sm ${getTone(occupationTone).card}`}>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-70">Cuello de botella actual</p>
            <h2 className="mt-2 text-2xl font-black">{bottleneck.label || 'Sin diagnóstico'}</h2>
            <p className="mt-2 text-sm font-bold opacity-80">{bottleneck.description || 'Todavía no hay datos suficientes.'}</p>
          </div>

          <div className={`rounded-2xl border bg-white p-5 shadow-sm ${adminAlert.recommended ? 'border-amber-200' : 'border-slate-200'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Soporte administrativo</p>
                <h2 className={`mt-2 text-xl font-black ${adminAlert.recommended ? 'text-amber-700' : 'text-slate-900'}`}>
                  {adminAlert.label || 'En observación'}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {adminAlert.metCount || 0} de {adminAlert.requiredCount || 3} criterios activos.
                </p>
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
                  {kinesiologistAlert.metCount || 0} de {kinesiologistAlert.requiredCount || 3} criterios activos.
                </p>
              </div>
              <UserPlus className={kinesiologistAlert.recommended ? 'text-rose-600' : 'text-slate-300'} size={24} />
            </div>
            <CriteriaList recommendation={kinesiologistAlert} />
          </div>
        </section>

        <section className="mb-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Histórico mensual</p>
                <h2 className="mt-2 text-xl font-black text-slate-900">Capacidad vs turnos asistidos</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Usa la capacidad actual configurada para comparar crecimiento real.
                </p>
              </div>
              <BarChart3 className="text-slate-300" size={24} />
            </div>

            {visibleMonthlyTrend.length > 0 ? (
              <ChartSurface>
                <ComposedChart data={visibleMonthlyTrend} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 700 }} tickLine={false} axisLine={false} minTickGap={12} />
                  <YAxis yAxisId="left" allowDecimals={false} tickLine={false} axisLine={false} width={38} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} width={44} />
                  <RechartsTooltip content={<CapacityTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: 12 }} />
                  <Bar yAxisId="left" dataKey="capacity" name="Capacidad" fill="#cbd5e1" radius={[8, 8, 0, 0]} />
                  <Bar yAxisId="left" dataKey="completedCount" name="Turnos asistidos" fill="#14b8a6" radius={[8, 8, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="occupancyRate" name="Ocupación %" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </ComposedChart>
              </ChartSurface>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm font-semibold text-slate-400">
                No hay meses con actividad suficiente.
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

                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
