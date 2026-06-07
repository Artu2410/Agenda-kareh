import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Calculator,
  Loader2,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
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

const getRiskTone = (riskLevel) => {
  if (riskLevel === 'ALTO') return 'rose';
  if (riskLevel === 'MEDIO') return 'amber';
  return 'emerald';
};

const humanizeMetric = (key) => String(key || '')
  .replace(/([A-Z])/g, ' $1')
  .replace(/_/g, ' ')
  .trim()
  .replace(/^./, (char) => char.toUpperCase());

const formatMetricValue = (key, value) => {
  if (value === null || value === undefined) return 'Sin datos';
  if (/pct|rate|share|utilization|occupancy/i.test(key)) return formatRate(value);
  if (/revenue|cash|cost|impact|loss|fee|invoiced|collected|pending/i.test(key)) return formatCurrency(value);
  if (/hours/i.test(key)) return `${formatNumber(value)} hs`;
  if (/turns|capacity|days|months/i.test(key)) return formatNumber(value);
  return String(value);
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

const MoneyDelta = ({ value }) => {
  const number = Number(value) || 0;
  const tone = number >= 0 ? 'text-emerald-700' : 'text-rose-700';
  const sign = number > 0 ? '+' : '';
  return <span className={`font-black ${tone}`}>{sign}{formatCurrency(number)}</span>;
};

const ScenarioCard = ({ scenario }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-black text-slate-900">{scenario.title}</h3>
          <Badge tone={getRiskTone(scenario.riskLevel)}>Riesgo {scenario.riskLevel}</Badge>
          <Badge tone="slate">{scenario.category}</Badge>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-500">{scenario.summary}</p>
      </div>
      <MoneyDelta value={scenario.financialImpact?.monthlyCashDelta} />
    </div>

    <div className="mb-4 rounded-xl bg-slate-900 px-4 py-3 text-white">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">Recomendación</p>
      <p className="mt-1 text-sm font-semibold">{scenario.recommendation}</p>
    </div>

    <div className="grid gap-3 md:grid-cols-3">
      <div className="rounded-xl bg-slate-50 px-4 py-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Revenue mensual</p>
        <p className="mt-1 text-lg font-black text-slate-900">
          <MoneyDelta value={scenario.financialImpact?.monthlyRevenueDelta} />
        </p>
      </div>
      <div className="rounded-xl bg-slate-50 px-4 py-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Caja mensual</p>
        <p className="mt-1 text-lg font-black text-slate-900">
          <MoneyDelta value={scenario.financialImpact?.monthlyCashDelta} />
        </p>
      </div>
      <div className="rounded-xl bg-slate-50 px-4 py-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Impacto anual</p>
        <p className="mt-1 text-lg font-black text-slate-900">
          <MoneyDelta value={scenario.financialImpact?.annualRevenueDelta} />
        </p>
      </div>
    </div>

    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Métricas</p>
        <div className="grid gap-2">
          {Object.entries(scenario.metrics || {}).slice(0, 8).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-2">
              <span className="text-xs font-bold text-slate-500">{humanizeMetric(key)}</span>
              <span className="text-sm font-black text-slate-900">{formatMetricValue(key, value)}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Supuestos</p>
        <ul className="grid gap-2">
          {(scenario.assumptions || []).map((assumption) => (
            <li key={assumption} className="rounded-xl bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
              {assumption}
            </li>
          ))}
        </ul>
      </div>
    </div>
  </article>
);

const StrategicSimulatorPage = () => {
  const [simulator, setSimulator] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSimulator = useCallback(async ({ silent = false } = {}) => {
    try {
      setLoading(true);
      const { data } = await api.get('/strategic-simulator/summary');
      setSimulator(data);
    } catch (error) {
      if (!silent) {
        showErrorToast(error?.friendlyMessage || 'No se pudo cargar simulador estratégico.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSimulator();
  }, [fetchSimulator]);

  const topPositiveScenario = useMemo(() => (
    [...(simulator?.scenarios || [])]
      .filter((scenario) => Number(scenario.financialImpact?.monthlyCashDelta || 0) > 0)
      .sort((left, right) => Number(right.financialImpact?.monthlyCashDelta || 0) - Number(left.financialImpact?.monthlyCashDelta || 0))[0]
  ), [simulator]);

  const summaryCards = [
    {
      label: 'Caja actual',
      value: formatCurrency(simulator?.baseline?.currentCash),
      description: `Caja 90 días: ${formatCurrency(simulator?.baseline?.projectedCash90)}`,
      icon: Banknote,
      tone: Number(simulator?.baseline?.projectedCash90 || 0) >= 0 ? 'emerald' : 'rose',
    },
    {
      label: 'Facturación mensual',
      value: formatCurrency(simulator?.baseline?.monthlyRevenue),
      description: `Cobro mensual: ${formatCurrency(simulator?.baseline?.monthlyCollected)}`,
      icon: TrendingUp,
      tone: 'teal',
    },
    {
      label: 'Ingreso por turno',
      value: formatCurrency(simulator?.baseline?.averageRevenuePerTurn),
      description: `Cobranza reciente: ${formatRate(simulator?.baseline?.collectionRate)}`,
      icon: Calculator,
      tone: 'slate',
    },
    {
      label: 'Ocupación',
      value: formatRate(simulator?.baseline?.occupancyRate),
      description: `${formatNumber(simulator?.baseline?.freeMonthlyCapacity)} turnos libres/mes`,
      icon: Users,
      tone: Number(simulator?.baseline?.occupancyRate || 0) > 85 ? 'rose' : 'teal',
    },
    {
      label: 'Mejor escenario',
      value: topPositiveScenario?.title || 'Sin positivo',
      description: topPositiveScenario ? `Caja mensual ${formatCurrency(topPositiveScenario.financialImpact.monthlyCashDelta)}` : 'No hay upside con supuestos actuales',
      icon: SlidersHorizontal,
      tone: topPositiveScenario ? 'emerald' : 'amber',
    },
    {
      label: 'Riesgo clave',
      value: simulator?.baseline?.topProfessional?.professionalName || 'Sin datos',
      description: 'Dependencia operativa simulada a 30 días',
      icon: ShieldAlert,
      tone: 'amber',
    },
  ];

  if (loading && !simulator) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 p-8">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
          <Loader2 className="mx-auto animate-spin text-teal-600" size={32} />
          <p className="mt-4 text-sm font-black uppercase tracking-[0.24em] text-slate-400">KIS · Fase 7</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">Simulando decisiones</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-teal-600">KIS · Fase 7</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Simulador Estratégico Kareh</h1>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-500">
              Responde qué pasa antes de gastar dinero: contratación, horarios, precios, pagadores y ausencia clínica.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchSimulator()}
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

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader
            eyebrow="Comparador"
            title="Impacto de decisiones"
            description="Tabla ejecutiva para priorizar qué decisión conviene evaluar primero"
            icon={SlidersHorizontal}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4 py-3">Escenario</th>
                  <th className="px-4 py-3">Riesgo</th>
                  <th className="px-4 py-3 text-right">Revenue mensual</th>
                  <th className="px-4 py-3 text-right">Caja mensual</th>
                  <th className="px-4 py-3 text-right">Equilibrio</th>
                  <th className="px-4 py-3">Decisión</th>
                </tr>
              </thead>
              <tbody>
                {(simulator?.scenarios || []).map((scenario) => (
                  <tr key={scenario.key} className="border-b border-slate-100">
                    <td className="px-4 py-4">
                      <p className="font-black text-slate-900">{scenario.title}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">{scenario.category}</p>
                    </td>
                    <td className="px-4 py-4"><Badge tone={getRiskTone(scenario.riskLevel)}>{scenario.riskLevel}</Badge></td>
                    <td className="px-4 py-4 text-right"><MoneyDelta value={scenario.financialImpact?.monthlyRevenueDelta} /></td>
                    <td className="px-4 py-4 text-right"><MoneyDelta value={scenario.financialImpact?.monthlyCashDelta} /></td>
                    <td className="px-4 py-4 text-right font-black text-slate-900">
                      {scenario.financialImpact?.breakEvenTurns ? `${formatCount(scenario.financialImpact.breakEvenTurns)} turnos` : 'No aplica'}
                    </td>
                    <td className="max-w-sm px-4 py-4 text-sm font-semibold text-slate-600">{scenario.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-6 grid gap-4 xl:grid-cols-2">
          {(simulator?.scenarios || []).map((scenario) => (
            <ScenarioCard key={scenario.key} scenario={scenario} />
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              eyebrow="Supuestos"
              title="Parámetros de simulación"
              description="Estos defaults se pueden ajustar por query o variables de entorno"
              icon={Calculator}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(simulator?.assumptions || {}).map(([key, value]) => (
                <div key={key} className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{humanizeMetric(key)}</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{formatMetricValue(key, value)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              eyebrow="Límites"
              title="Datos que mejorarían la simulación"
              description="El sistema no inventa variables que todavía no se miden"
              icon={AlertTriangle}
            />
            <div className="grid gap-3">
              {(simulator?.missingData || []).map((item) => (
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

export default StrategicSimulatorPage;
