import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  BriefcaseBusiness,
  Calculator,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Stethoscope,
  TrendingUp,
  Users,
} from 'lucide-react';
import api from '../services/api';
import { showErrorToast } from '../components/toastHelpers';

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatCount = (value) =>
  new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Number(value) || 0);

const formatNumber = (value) =>
  new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(Number(value) || 0);

const formatRate = (value) => `${Number(value || 0).toFixed(1)}%`;

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
};

const getStatusTone = (status) => {
  if (['HIRE', 'IMMINENT'].includes(status)) return 'rose';
  if (['EVALUATE', 'NEXT_90_DAYS'].includes(status)) return 'amber';
  return 'emerald';
};

const SummaryCard = ({ label, value, description, icon, tone = 'slate' }) => {
  const toneMap = {
    slate: 'bg-slate-100 text-slate-700',
    teal: 'bg-teal-100 text-teal-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-800',
    rose: 'bg-rose-100 text-rose-700',
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-black leading-tight text-slate-900">{value}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{description}</p>
        </div>
        <div className={`shrink-0 rounded-xl p-3 ${toneMap[tone] || toneMap.slate}`}>
          {React.createElement(icon, { size: 20 })}
        </div>
      </div>
    </section>
  );
};

const SectionHeader = ({ eyebrow, title, description, icon }) => (
  <div className="mb-4 flex items-start justify-between gap-4">
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-black text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p>}
    </div>
    <div className="rounded-xl bg-slate-100 p-3 text-slate-500">
      {React.createElement(icon, { size: 20 })}
    </div>
  </div>
);

const Badge = ({ children, tone = 'slate' }) => {
  const toneMap = {
    slate: 'bg-slate-100 text-slate-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-800',
    rose: 'bg-rose-100 text-rose-700',
    teal: 'bg-teal-100 text-teal-700',
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${toneMap[tone] || toneMap.slate}`}>
      {children}
    </span>
  );
};

const Metric = ({ label, value, tone = 'slate' }) => {
  const toneMap = {
    slate: 'text-slate-900',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700',
    teal: 'text-teal-700',
  };

  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className={`mt-1 text-lg font-black ${toneMap[tone] || toneMap.slate}`}>{value}</p>
    </div>
  );
};

const CriteriaList = ({ criteria }) => (
  <div className="grid gap-2">
    {(criteria || []).map((criterion) => (
      <div key={criterion.key} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-800">{criterion.label}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {criterion.measured ? `Valor: ${criterion.value ?? 'Sin datos'}` : 'No medido todavía'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={criterion.met ? 'emerald' : (criterion.score > 0 ? 'amber' : 'slate')}>
            {formatCount(criterion.score)}/{formatCount(criterion.weight)}
          </Badge>
          {criterion.met ? <CheckCircle2 size={18} className="text-emerald-600" /> : <AlertTriangle size={18} className="text-slate-300" />}
        </div>
      </div>
    ))}
  </div>
);

const HiringDecisionCard = ({ decision, icon }) => {
  const tone = getStatusTone(decision?.status);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <SectionHeader
        eyebrow="Recomendación"
        title={decision?.title || 'Sin datos'}
        description={decision?.recommendation}
        icon={icon}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Estado" value={decision?.statusLabel || 'Sin datos'} tone={tone} />
        <Metric label="Score" value={`${formatCount(decision?.score)}/100`} tone={tone} />
        <Metric label="Fecha estimada" value={formatDate(decision?.projectedDate)} tone="teal" />
      </div>
      <CriteriaList criteria={decision?.criteria} />
    </section>
  );
};

const HiringPage = () => {
  const [hiring, setHiring] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchHiring = useCallback(async ({ silent = false } = {}) => {
    try {
      setLoading(true);
      const { data } = await api.get('/hiring/summary');
      setHiring(data);
    } catch (error) {
      if (!silent) {
        showErrorToast(error?.friendlyMessage || 'No se pudo cargar motor de contratación.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHiring();
  }, [fetchHiring]);

  const summaryCards = useMemo(() => [
    {
      label: 'Administrativa',
      value: hiring?.administrative?.statusLabel || 'Sin datos',
      description: `Score ${formatCount(hiring?.administrative?.score)}/100`,
      icon: BriefcaseBusiness,
      tone: getStatusTone(hiring?.administrative?.status),
    },
    {
      label: 'Kinesiólogo',
      value: hiring?.kinesiologist?.statusLabel || 'Sin datos',
      description: `Score ${formatCount(hiring?.kinesiologist?.score)}/100`,
      icon: Stethoscope,
      tone: getStatusTone(hiring?.kinesiologist?.status),
    },
    {
      label: 'Riesgo operativo',
      value: hiring?.summary?.risk?.level || 'Sin datos',
      description: hiring?.summary?.risk?.description || 'Sin evaluación',
      icon: ShieldAlert,
      tone: hiring?.summary?.risk?.level === 'ALTO' ? 'rose' : (hiring?.summary?.risk?.level === 'MEDIO' ? 'amber' : 'emerald'),
    },
    {
      label: 'Ocupación actual',
      value: formatRate(hiring?.operational?.occupancyRate),
      description: `${formatNumber(hiring?.operational?.freeMonthlyCapacity)} turnos libres/mes`,
      icon: Users,
      tone: Number(hiring?.operational?.occupancyRate || 0) > 85 ? 'rose' : 'teal',
    },
    {
      label: 'Caja 90 días',
      value: formatCurrency(hiring?.financial?.projectedCash90),
      description: `Presupuesto seguro: ${formatCurrency(hiring?.financial?.safeMonthlyHiringBudget)}`,
      icon: Banknote,
      tone: Number(hiring?.financial?.projectedCash90 || 0) >= 0 ? 'emerald' : 'rose',
    },
    {
      label: 'Crecimiento turnos',
      value: `${formatNumber(hiring?.summary?.monthlyTurnGrowth)} / mes`,
      description: `${formatRate(hiring?.summary?.monthlyTurnGrowthRate)} vs período previo`,
      icon: TrendingUp,
      tone: Number(hiring?.summary?.monthlyTurnGrowth || 0) > 0 ? 'emerald' : 'slate',
    },
  ], [hiring]);

  if (loading && !hiring) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 p-8">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
          <Loader2 className="mx-auto animate-spin text-teal-600" size={32} />
          <p className="mt-4 text-sm font-black uppercase tracking-[0.24em] text-slate-400">KIS · Fase 6</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">Calculando escalabilidad</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-teal-600">KIS · Fase 6</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Motor de Contratación y Escalabilidad</h1>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-500">
              Decide cuándo contratar administrativa o segundo kinesiólogo usando capacidad, caja, crecimiento y carga operativa.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchHiring()}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600 shadow-sm transition hover:bg-slate-100 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </header>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </section>

        <section className="mb-6 grid gap-4 xl:grid-cols-2">
          <HiringDecisionCard decision={hiring?.administrative} icon={BriefcaseBusiness} />
          <HiringDecisionCard decision={hiring?.kinesiologist} icon={Stethoscope} />
        </section>

        <section className="mb-6 grid gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
            <SectionHeader
              eyebrow="Simulación económica"
              title="Antes de sumar costo fijo"
              description="Cuánto debe producir la contratación para pagarse"
              icon={Calculator}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <h3 className="font-black text-slate-900">Administrativa parcial</h3>
                <div className="mt-3 grid gap-2">
                  <Metric label="Costo mensual" value={formatCurrency(hiring?.administrative?.simulation?.monthlyCost)} />
                  <Metric label="Horas liberadas" value={`${formatNumber(hiring?.administrative?.simulation?.assumedWeeklyHours)} hs/sem`} tone="teal" />
                  <Metric label="Turnos potenciales" value={formatNumber(hiring?.administrative?.simulation?.additionalTurnsFromFreedTime)} tone="teal" />
                  <Metric label="Turnos equilibrio" value={hiring?.administrative?.simulation?.turnsToBreakEven ? formatCount(hiring.administrative.simulation.turnsToBreakEven) : 'Sin datos'} tone="amber" />
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <h3 className="font-black text-slate-900">Segundo kinesiólogo</h3>
                <div className="mt-3 grid gap-2">
                  <Metric label="Costo mensual" value={formatCurrency(hiring?.kinesiologist?.simulation?.monthlyCost)} />
                  <Metric label="Turnos adicionales" value={formatNumber(hiring?.kinesiologist?.simulation?.additionalMonthlyTurns)} tone="teal" />
                  <Metric label="Facturación 60%" value={formatCurrency(hiring?.kinesiologist?.simulation?.expectedRevenueAt60Occupancy)} tone="emerald" />
                  <Metric label="Ocupación equilibrio" value={hiring?.kinesiologist?.simulation?.occupancyToBreakEven ? formatRate(hiring.kinesiologist.simulation.occupancyToBreakEven) : 'Sin datos'} tone="amber" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              eyebrow="Guardrail financiero"
              title="Cuánto puede pagar Kareh"
              description="Con caja, cuentas por cobrar y gastos actuales"
              icon={Banknote}
            />
            <div className="grid gap-2">
              <Metric label="Caja actual" value={formatCurrency(hiring?.financial?.currentCash)} />
              <Metric label="Pendiente 90 días" value={formatCurrency(hiring?.financial?.pendingDue90)} tone="emerald" />
              <Metric label="Margen mensual" value={formatCurrency(hiring?.financial?.monthlyMargin)} tone={Number(hiring?.financial?.monthlyMargin || 0) >= 0 ? 'emerald' : 'rose'} />
              <Metric label="Budget seguro" value={formatCurrency(hiring?.financial?.safeMonthlyHiringBudget)} tone="teal" />
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              eyebrow="Operación actual"
              title={hiring?.operational?.month || 'Mes actual'}
              description="Capacidad, ocupación y respuesta operativa"
              icon={Clock3}
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Pacientes activos" value={formatCount(hiring?.operational?.activePatients)} />
              <Metric label="Turnos mes" value={formatCount(hiring?.operational?.currentMonthTurns)} />
              <Metric label="Horas admin est." value={`${formatNumber(hiring?.administrative?.metrics?.estimatedAdminHoursWeekly)} hs/sem`} tone="amber" />
              <Metric label="Mensajes pendientes" value={formatCount(hiring?.operational?.response?.pendingMessages)} tone={Number(hiring?.operational?.response?.pendingMessages || 0) > 10 ? 'rose' : 'slate'} />
              <Metric label="Respuesta promedio" value={hiring?.operational?.response?.averageResponseHours !== null ? `${formatNumber(hiring?.operational?.response?.averageResponseHours)} hs` : 'Sin datos'} />
              <Metric label="Cobertura agenda" value={`${formatCount(hiring?.operational?.coverageDays)} días`} tone="teal" />
              <Metric label="Capacidad mensual" value={formatNumber(hiring?.operational?.monthlyCapacity)} />
              <Metric label="Capacidad libre" value={formatNumber(hiring?.operational?.freeMonthlyCapacity)} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              eyebrow="Fecha estimada"
              title="Saturación y contratación"
              description="Basado en tendencia de turnos y ocupación"
              icon={CalendarClock}
            />
            <div className="grid gap-3">
              <div className="rounded-xl bg-slate-50 px-4 py-4">
                <p className="text-sm font-black text-slate-900">Administrativa</p>
                <p className="mt-1 text-2xl font-black text-teal-700">{formatDate(hiring?.administrative?.projectedDate)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-4 py-4">
                <p className="text-sm font-black text-slate-900">Segundo kinesiólogo</p>
                <p className="mt-1 text-2xl font-black text-teal-700">{formatDate(hiring?.kinesiologist?.projectedDate)}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Saturación objetivo: {formatNumber(hiring?.kinesiologist?.metrics?.saturationTargetTurns)} turnos/mes.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader
            eyebrow="Histórico"
            title="Tendencia de crecimiento"
            description="Sin gráficos: sólo la tabla que alimenta la decisión"
            icon={TrendingUp}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4 py-3">Mes</th>
                  <th className="px-4 py-3 text-right">Turnos realizados</th>
                  <th className="px-4 py-3 text-right">Turnos totales</th>
                  <th className="px-4 py-3 text-right">Pacientes activos</th>
                  <th className="px-4 py-3 text-right">Pacientes nuevos</th>
                </tr>
              </thead>
              <tbody>
                {(hiring?.monthlyTrend || []).map((row) => (
                  <tr key={row.monthKey} className="border-b border-slate-100">
                    <td className="px-4 py-4 font-black capitalize text-slate-900">{row.month}</td>
                    <td className="px-4 py-4 text-right font-black text-slate-900">{formatCount(row.completedTurns)}</td>
                    <td className="px-4 py-4 text-right font-black text-slate-700">{formatCount(row.totalTurns)}</td>
                    <td className="px-4 py-4 text-right font-black text-teal-700">{formatCount(row.activePatients)}</td>
                    <td className="px-4 py-4 text-right font-black text-emerald-700">{formatCount(row.newPatients)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              eyebrow="Supuestos"
              title="Parámetros usados"
              description="Configurable por query o variables de entorno"
              icon={Calculator}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <Metric label="Gastos fijos" value={formatCurrency(hiring?.assumptions?.fixedExpenses)} />
              <Metric label="Costo administrativa" value={formatCurrency(hiring?.assumptions?.adminMonthlyCost)} />
              <Metric label="Costo kinesiólogo" value={formatCurrency(hiring?.assumptions?.kinesiologistMonthlyCost)} />
              <Metric label="Horas kine nuevo" value={`${formatNumber(hiring?.assumptions?.newKinesiologistWeeklyHours)} hs/sem`} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              eyebrow="Datos faltantes"
              title="Lo que falta para decidir mejor"
              description="No se ocultan las limitaciones del modelo"
              icon={AlertTriangle}
            />
            <div className="grid gap-3">
              {(hiring?.missingData || []).map((item) => (
                <div key={item.key} className="rounded-xl bg-amber-50 px-4 py-4">
                  <p className="font-black text-amber-950">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-amber-800">{item.reason}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HiringPage;
