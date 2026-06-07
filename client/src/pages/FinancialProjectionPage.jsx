import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Calculator,
  Clock3,
  FileText,
  Gauge,
  Loader2,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Wallet,
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

const formatDate = (value) => {
  if (!value) return 'Sin datos';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin datos';
  return date.toLocaleDateString('es-AR');
};

const formatMonths = (value) => `${Number(value || 0).toFixed(1)} meses`;

const formatDelta = (value) => {
  const number = Number(value) || 0;
  const sign = number > 0 ? '+' : '';
  return `${sign}${formatCurrency(number)}`;
};

const toneByMoney = (value) => (Number(value || 0) >= 0 ? 'emerald' : 'rose');

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
        <div className="min-w-0">
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

const MoneyCell = ({ value, tone = 'slate' }) => {
  const toneMap = {
    slate: 'text-slate-900',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700',
    teal: 'text-teal-700',
  };

  return <span className={`font-black ${toneMap[tone] || toneMap.slate}`}>{formatCurrency(value)}</span>;
};

const FinancialProjectionPage = () => {
  const [projection, setProjection] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProjection = useCallback(async ({ silent = false } = {}) => {
    try {
      setLoading(true);
      const { data } = await api.get('/financial-projection/summary');
      setProjection(data);
    } catch (error) {
      if (!silent) {
        showErrorToast(error?.friendlyMessage || 'No se pudo cargar proyección financiera.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProjection();
  }, [fetchProjection]);

  const horizon90 = useMemo(
    () => (projection?.incoming?.horizons || []).find((horizon) => horizon.days === 90),
    [projection]
  );

  const summaryCards = useMemo(() => [
    {
      label: 'Caja actual',
      value: formatCurrency(projection?.currentCash?.total),
      description: 'Caja + Mercado Pago según movimientos',
      icon: Wallet,
      tone: toneByMoney(projection?.currentCash?.total),
    },
    {
      label: 'Entra esta semana',
      value: formatCurrency(projection?.incoming?.week?.collections),
      description: `${formatDate(projection?.incoming?.week?.startDate)} a ${formatDate(projection?.incoming?.week?.endDate)}`,
      icon: Banknote,
      tone: 'emerald',
    },
    {
      label: 'Próximo mes',
      value: formatCurrency(projection?.incoming?.nextMonth?.collections),
      description: projection?.incoming?.nextMonth?.month || 'Cobros esperados',
      icon: TrendingUp,
      tone: 'teal',
    },
    {
      label: 'Pendiente total',
      value: formatCurrency(projection?.receivables?.totalPending),
      description: `${formatCount(projection?.receivables?.invoices)} facturas pendientes`,
      icon: FileText,
      tone: 'amber',
    },
    {
      label: 'Runway',
      value: formatMonths(projection?.runway?.months),
      description: projection?.runway?.shortfallDate
        ? `Quiebre estimado: ${formatDate(projection.runway.shortfallDate)}`
        : 'Sin quiebre en el horizonte modelado',
      icon: Clock3,
      tone: Number(projection?.runway?.months || 0) >= 3 ? 'emerald' : 'rose',
    },
    {
      label: 'Caja a 90 días',
      value: formatCurrency(horizon90?.projectedCash),
      description: `Incluye ${formatCurrency(horizon90?.collections)} de cobros y gastos proyectados`,
      icon: Gauge,
      tone: toneByMoney(horizon90?.projectedCash),
    },
  ], [horizon90, projection]);

  if (loading && !projection) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 p-8">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
          <Loader2 className="mx-auto animate-spin text-teal-600" size={32} />
          <p className="mt-4 text-sm font-black uppercase tracking-[0.24em] text-slate-400">KIS · Fase 4</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">Calculando caja futura</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-teal-600">KIS · Fase 4</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Motor de Proyección Financiera</h1>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-500">
              Proyecta caja real, cuentas por cobrar, runway y stress tests para decidir con datos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchProjection()}
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

        <section className="mb-6 grid gap-4 lg:grid-cols-3">
          {(projection?.incoming?.horizons || []).map((horizon) => (
            <div key={horizon.days} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <SectionHeader
                eyebrow={`Horizonte ${horizon.days} días`}
                title={formatCurrency(horizon.projectedCash)}
                description={`Caja proyectada al ${formatDate(horizon.date)}`}
                icon={Calculator}
              />
              <div className="grid gap-3">
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
                  <span className="text-sm font-bold text-emerald-700">Cobros</span>
                  <MoneyCell value={horizon.collections} tone="emerald" />
                </div>
                <div className="flex items-center justify-between rounded-xl bg-rose-50 px-4 py-3">
                  <span className="text-sm font-bold text-rose-700">Gastos</span>
                  <MoneyCell value={horizon.projectedExpenses} tone="rose" />
                </div>
                {Number(horizon.revenueAdjustment || 0) !== 0 && (
                  <div className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3">
                    <span className="text-sm font-bold text-amber-700">Ajuste ingresos</span>
                    <MoneyCell value={horizon.revenueAdjustment} tone="amber" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>

        <section className="mb-6 grid gap-4 xl:grid-cols-[1fr_1.4fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              eyebrow="Decisión CFO"
              title={projection?.decision?.status || 'Sin datos'}
              description={projection?.decision?.summary}
              icon={ShieldAlert}
            />
            {(projection?.decision?.warnings || []).length === 0 ? (
              <div className="rounded-xl bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-700">
                No hay alertas críticas con la información disponible.
              </div>
            ) : (
              <div className="grid gap-2">
                {projection.decision.warnings.map((warning) => (
                  <div key={warning} className="rounded-xl bg-rose-50 px-4 py-3 text-rose-800">
                    <p className="text-sm font-black">{warning}</p>
                  </div>
                ))}
              </div>
            )}
            {(projection?.decision?.recommendations || []).length > 0 && (
              <div className="mt-4 rounded-xl bg-slate-900 px-4 py-4 text-white">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">Recomendaciones</p>
                <ul className="mt-3 grid gap-2 text-sm font-semibold">
                  {projection.decision.recommendations.map((recommendation) => (
                    <li key={recommendation}>• {recommendation}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              eyebrow="Runway"
              title="Sin pacientes nuevos"
              description={projection?.runway?.answer}
              icon={Clock3}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Meses</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{formatMonths(projection?.runway?.months)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Días</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{formatCount(projection?.runway?.days)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Quiebre</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{formatDate(projection?.runway?.shortfallDate)}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {(projection?.currentCash?.accounts || []).map((account) => (
                <div key={account.account} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-sm font-bold text-slate-500">{account.account}</span>
                  <MoneyCell value={account.balance} tone={toneByMoney(account.balance)} />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader
            eyebrow="Flujo esperado"
            title="Caja inicial · Cobros · Gastos · Caja final"
            description={`Gastos fijos modelados: ${formatCurrency(projection?.assumptions?.fixedExpenses)} mensuales`}
            icon={Banknote}
          />
          <div className="mb-4 rounded-xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-900">
            Resto de {projection?.currentMonthRemainder?.month}: caja inicial {formatCurrency(projection?.currentMonthRemainder?.startingCash)}, cobros {formatCurrency(projection?.currentMonthRemainder?.collections)}, gastos {formatCurrency(projection?.currentMonthRemainder?.projectedExpenses)}, caja final {formatCurrency(projection?.currentMonthRemainder?.endingCash)}.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4 py-3">Mes</th>
                  <th className="px-4 py-3 text-right">Caja inicial</th>
                  <th className="px-4 py-3 text-right">Cobros</th>
                  <th className="px-4 py-3 text-right">Gastos</th>
                  <th className="px-4 py-3 text-right">Caja final</th>
                </tr>
              </thead>
              <tbody>
                {(projection?.monthlyFlow || []).map((row) => (
                  <tr key={row.month} className="border-b border-slate-100">
                    <td className="px-4 py-4 font-black capitalize text-slate-900">{row.month}</td>
                    <td className="px-4 py-4 text-right"><MoneyCell value={row.startingCash} /></td>
                    <td className="px-4 py-4 text-right"><MoneyCell value={row.collections} tone="emerald" /></td>
                    <td className="px-4 py-4 text-right"><MoneyCell value={row.projectedExpenses} tone="rose" /></td>
                    <td className="px-4 py-4 text-right"><MoneyCell value={row.endingCash} tone={toneByMoney(row.endingCash)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              eyebrow="Obras sociales pendientes"
              title="Pendiente por pagador"
              description="Facturado, cobrado, pendiente y próxima fecha esperada"
              icon={FileText}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4 py-3">Pagador</th>
                    <th className="px-4 py-3 text-right">Facturado</th>
                    <th className="px-4 py-3 text-right">Cobrado</th>
                    <th className="px-4 py-3 text-right">Pendiente</th>
                    <th className="px-4 py-3">Fecha esperada</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(projection?.receivables?.byPayer || []).map((payer) => (
                    <tr key={payer.payerKey} className="border-b border-slate-100">
                      <td className="px-4 py-4">
                        <p className="font-black text-slate-900">{payer.payerName}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">{formatCount(payer.invoices)} facturas · {Number(payer.pendingShare || 0).toFixed(1)}% del pendiente</p>
                      </td>
                      <td className="px-4 py-4 text-right"><MoneyCell value={payer.invoiced} /></td>
                      <td className="px-4 py-4 text-right"><MoneyCell value={payer.collected} tone="emerald" /></td>
                      <td className="px-4 py-4 text-right"><MoneyCell value={payer.pending} tone="amber" /></td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-500">{formatDate(payer.nextExpectedPaymentDate)}</td>
                      <td className="px-4 py-4">
                        {payer.pendingShare >= 50 ? <Badge tone="rose">Dependencia alta</Badge> : <Badge>Normal</Badge>}
                        {payer.overduePending > 0 && <span className="ml-2"><Badge tone="amber">Vencido</Badge></span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              eyebrow="Facturas críticas"
              title="Próximos cobros"
              description="Primeras facturas pendientes por fecha de ingreso"
              icon={AlertTriangle}
            />
            <div className="grid gap-3">
              {(projection?.receivables?.rows || []).slice(0, 8).map((invoice) => (
                <article key={invoice.invoiceId} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-900">{invoice.payerName}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {invoice.invoiceNumber || 'Sin número'} · {formatDate(invoice.forecastDate)}
                      </p>
                    </div>
                    <MoneyCell value={invoice.pendingAmount} tone="amber" />
                  </div>
                  {invoice.overdue && (
                    <p className="mt-2 text-xs font-black text-rose-600">
                      Vencida hace {formatCount(invoice.overdueDays)} días.
                    </p>
                  )}
                </article>
              ))}
              {(projection?.receivables?.rows || []).length === 0 && (
                <div className="rounded-xl bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-700">
                  No hay cuentas por cobrar pendientes.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader
            eyebrow="Stress tests"
            title="Qué pasa si el escenario empeora"
            description="Demoras de obras sociales y caída de pacientes de Kati"
            icon={TrendingDown}
          />
          <div className="grid gap-4 lg:grid-cols-3">
            {(projection?.stressTests || []).map((scenario) => {
              const cashAt90 = (scenario.projection?.horizons || []).find((horizon) => horizon.days === 90)?.projectedCash;
              return (
                <article key={scenario.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-slate-900">{scenario.title}</h3>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{scenario.description}</p>
                    </div>
                    <Badge tone={Number(scenario.impact?.cashAt90Delta || 0) < 0 ? 'rose' : 'emerald'}>
                      {formatDelta(scenario.impact?.cashAt90Delta)}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-2">
                    <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                      <span className="text-sm font-bold text-slate-500">Caja 90 días</span>
                      <MoneyCell value={cashAt90} tone={toneByMoney(cashAt90)} />
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                      <span className="text-sm font-bold text-slate-500">Runway</span>
                      <span className="font-black text-slate-900">{formatMonths(scenario.projection?.runway?.months)}</span>
                    </div>
                    {scenario.revenueRisk && (
                      <div className="rounded-xl bg-amber-50 px-4 py-3 text-amber-900">
                        <p className="text-xs font-black">Pérdida mensual estimada: {formatCurrency(scenario.revenueRisk.lostMonthlyRevenue)}</p>
                        <p className="mt-1 text-[11px] font-semibold">{scenario.revenueRisk.source}</p>
                      </div>
                    )}
                    <div className="rounded-xl bg-white px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Supuestos</p>
                      <ul className="mt-2 grid gap-1 text-xs font-semibold text-slate-500">
                        {(scenario.assumptions || []).map((assumption) => (
                          <li key={assumption}>• {assumption}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader
            eyebrow="Datos faltantes"
            title="Mejoras para elevar precisión"
            description="Elementos que convertirían la proyección en simulación económica avanzada"
            icon={AlertTriangle}
          />
          <div className="grid gap-3 md:grid-cols-3">
            {(projection?.missingData || []).map((item) => (
              <div key={item.key} className="rounded-xl bg-slate-50 px-4 py-4">
                <p className="font-black text-slate-900">{item.label}</p>
                <p className="mt-2 text-sm font-semibold text-slate-500">{item.reason}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default FinancialProjectionPage;
