import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  BriefcaseBusiness,
  Calculator,
  Clock3,
  FileText,
  Gauge,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Star,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
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

const formatRate = (value) => `${Number(value || 0).toFixed(1)}%`;

const formatDate = (value) => {
  if (!value) return 'Sin datos';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin datos';
  return date.toLocaleDateString('es-AR');
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

const ProfitabilityPage = () => {
  const [summary, setSummary] = useState(null);
  const [patients, setPatients] = useState(null);
  const [payers, setPayers] = useState(null);
  const [professionals, setProfessionals] = useState(null);
  const [equilibrium, setEquilibrium] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfitability = useCallback(async ({ silent = false } = {}) => {
    try {
      setLoading(true);
      const [
        summaryResponse,
        patientsResponse,
        payersResponse,
        professionalsResponse,
        equilibriumResponse,
      ] = await Promise.all([
        api.get('/profitability/summary'),
        api.get('/profitability/patients'),
        api.get('/profitability/payers'),
        api.get('/profitability/professionals'),
        api.get('/profitability/equilibrium'),
      ]);

      setSummary(summaryResponse.data);
      setPatients(patientsResponse.data);
      setPayers(payersResponse.data);
      setProfessionals(professionalsResponse.data);
      setEquilibrium(equilibriumResponse.data);
    } catch (error) {
      if (!silent) {
        showErrorToast(error?.friendlyMessage || 'No se pudo cargar rentabilidad.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfitability();
  }, [fetchProfitability]);

  const alerts = useMemo(() => {
    const items = [];

    (payers?.alerts?.payerDependency || []).forEach((row) => {
      items.push({
        key: `payer-${row.key}`,
        title: 'Dependencia alta de obra social',
        description: `${row.name} concentra ${formatRate(row.share)} de la facturación.`,
      });
    });

    (patients?.alerts?.patientDependency || []).forEach((row) => {
      items.push({
        key: `patient-${row.patientId}`,
        title: 'Dependencia alta de paciente',
        description: `${row.patientName} concentra ${formatRate(row.share)} de la facturación histórica.`,
      });
    });

    (professionals?.alerts?.professionalDependency || []).forEach((row) => {
      items.push({
        key: `professional-${row.professionalId}`,
        title: 'Dependencia alta de profesional',
        description: `${row.professionalName} concentra ${formatRate(row.share)} de la facturación asociada.`,
      });
    });

    if (summary?.alerts?.averageIncomeDescending) {
      items.push({
        key: 'average-descending',
        title: 'Ingreso promedio descendente',
        description: 'El ingreso promedio por turno cayó contra el mes anterior.',
      });
    }

    if (summary?.alerts?.growthWithoutCash) {
      items.push({
        key: 'growth-without-cash',
        title: 'Crecimiento sin cobro efectivo',
        description: 'La facturación crece, pero los cobros no acompañan.',
      });
    }

    return items;
  }, [patients, payers, professionals, summary]);

  const summaryCards = [
    {
      label: 'Facturación total',
      value: formatCurrency(summary?.totals?.invoiced),
      description: summary?.period?.label || 'Mes actual',
      icon: FileText,
      tone: 'slate',
    },
    {
      label: 'Cobrado total',
      value: formatCurrency(summary?.totals?.collected),
      description: 'Cobros imputados a facturas',
      icon: Banknote,
      tone: 'emerald',
    },
    {
      label: 'Pendiente',
      value: formatCurrency(summary?.totals?.pending),
      description: 'Cuentas por cobrar',
      icon: Wallet,
      tone: 'amber',
    },
    {
      label: 'Ingreso por turno',
      value: formatCurrency(summary?.averages?.perTurn),
      description: `${formatCount(summary?.activity?.completedAppointments)} turnos asistidos`,
      icon: TrendingUp,
      tone: 'teal',
    },
    {
      label: 'Ingreso por paciente',
      value: formatCurrency(summary?.averages?.perPatient),
      description: `${formatCount(summary?.activity?.activePatients)} pacientes activos`,
      icon: Users,
      tone: 'slate',
    },
    {
      label: 'Ingreso por profesional',
      value: formatCurrency(summary?.averages?.perProfessional),
      description: `${formatCount(summary?.activity?.productiveProfessionals)} profesionales productivos`,
      icon: Stethoscope,
      tone: 'slate',
    },
    {
      label: 'Ingreso por hora',
      value: formatCurrency(summary?.averages?.perOpenHour),
      description: 'Por hora abierta del período',
      icon: Clock3,
      tone: 'teal',
    },
    {
      label: 'Margen estimado',
      value: formatCurrency(summary?.margin?.amount),
      description: `${formatRate(summary?.margin?.rate)} vs gastos fijos`,
      icon: Gauge,
      tone: Number(summary?.margin?.amount) >= 0 ? 'emerald' : 'rose',
    },
  ];

  if (loading && !summary) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 p-8">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
          <Loader2 className="mx-auto animate-spin text-teal-600" size={32} />
          <p className="mt-4 text-sm font-black uppercase tracking-[0.24em] text-slate-400">Rentabilidad</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">Calculando unit economics</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-teal-600">KIS · Fase 3</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Rentabilidad y Unit Economics</h1>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-500">
              Mide qué pacientes, obras sociales, profesionales y horas abiertas generan valor económico real.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchProfitability()}
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
            <SectionHeader
              eyebrow="Punto de equilibrio"
              title={equilibrium?.covered ? 'Equilibrio cubierto' : 'Faltan turnos'}
              description={`Gastos fijos: ${formatCurrency(equilibrium?.fixedExpenses)}`}
              icon={Calculator}
            />
            <div className="grid gap-3">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-bold text-slate-500">Turnos necesarios</span>
                <span className="text-lg font-black text-slate-900">{formatCount(equilibrium?.requiredTurns)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-bold text-slate-500">Turnos realizados</span>
                <span className="text-lg font-black text-teal-700">{formatCount(equilibrium?.completedTurns)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3">
                <span className="text-sm font-bold text-amber-700">Turnos faltantes</span>
                <span className="text-lg font-black text-amber-800">{formatCount(equilibrium?.missingTurns)}</span>
              </div>
              <div className="rounded-xl bg-slate-900 px-4 py-3 text-white">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">% alcanzado</p>
                <p className="mt-1 text-2xl font-black">{formatRate(equilibrium?.reachedRate)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              eyebrow="Rentabilidad por hora"
              title="Hora abierta"
              description="Facturación dividida por horas abiertas"
              icon={Clock3}
            />
            <div className="grid gap-3">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-bold text-slate-500">Semana</span>
                <span className="text-lg font-black text-slate-900">{formatCurrency(summary?.hourlyRevenue?.week?.revenuePerOpenHour)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-teal-50 px-4 py-3">
                <span className="text-sm font-bold text-teal-700">Mes</span>
                <span className="text-lg font-black text-teal-800">{formatCurrency(summary?.hourlyRevenue?.month?.revenuePerOpenHour)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-bold text-slate-500">Últimos 90 días</span>
                <span className="text-lg font-black text-slate-900">{formatCurrency(summary?.hourlyRevenue?.last90Days?.revenuePerOpenHour)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              eyebrow="Alertas KIS"
              title={alerts.length ? `${alerts.length} alertas activas` : 'Sin alertas críticas'}
              description="Dependencia, cobros e ingreso promedio"
              icon={ShieldAlert}
            />
            {alerts.length === 0 ? (
              <div className="rounded-xl bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-700">
                No hay alertas automáticas con los datos actuales.
              </div>
            ) : (
              <div className="grid gap-2">
                {alerts.map((alert) => (
                  <div key={alert.key} className="rounded-xl bg-rose-50 px-4 py-3 text-rose-800">
                    <p className="text-sm font-black">{alert.title}</p>
                    <p className="mt-1 text-xs font-semibold">{alert.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader
            eyebrow="Pacientes"
            title="Top pacientes por facturación"
            description="LTV histórico, sesiones, cobrado y pendiente"
            icon={Star}
          />
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3 text-right">Turnos</th>
                  <th className="px-4 py-3 text-right">Facturado</th>
                  <th className="px-4 py-3 text-right">Cobrado</th>
                  <th className="px-4 py-3 text-right">Pendiente</th>
                  <th className="px-4 py-3">Primera / última</th>
                  <th className="px-4 py-3">Insignias</th>
                </tr>
              </thead>
              <tbody>
                {(patients?.topByRevenue || []).map((patient) => (
                  <tr key={patient.patientId} className="border-b border-slate-100">
                    <td className="px-4 py-4">
                      <p className="font-black text-slate-900">{patient.patientName}</p>
                      {patient.risk && <p className="mt-1 text-xs font-bold text-rose-600">Paciente en riesgo de abandono</p>}
                    </td>
                    <td className="px-4 py-4 text-right font-black text-slate-900">{formatCount(patient.sessionCount)}</td>
                    <td className="px-4 py-4 text-right font-black text-slate-900">{formatCurrency(patient.invoiced)}</td>
                    <td className="px-4 py-4 text-right font-black text-emerald-700">{formatCurrency(patient.collected)}</td>
                    <td className="px-4 py-4 text-right font-black text-amber-700">{formatCurrency(patient.pending)}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-500">
                      {formatDate(patient.firstAttention)} · {formatDate(patient.lastAttention)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {(patient.badges || []).map((badge) => (
                          <Badge key={badge} tone={badge === 'Alto Valor' ? 'teal' : 'slate'}>{badge}</Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 lg:hidden">
            {(patients?.topByRevenue || []).map((patient) => (
              <article key={patient.patientId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-slate-900">{patient.patientName}</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {formatCount(patient.sessionCount)} turnos · LTV {formatCurrency(patient.ltv)}
                    </p>
                  </div>
                  {patient.risk && <Badge tone="rose">Riesgo</Badge>}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white px-2 py-3">
                    <p className="text-[10px] font-black uppercase text-slate-400">Facturado</p>
                    <p className="mt-1 text-sm font-black text-slate-900">{formatCurrency(patient.invoiced)}</p>
                  </div>
                  <div className="rounded-xl bg-white px-2 py-3">
                    <p className="text-[10px] font-black uppercase text-slate-400">Cobrado</p>
                    <p className="mt-1 text-sm font-black text-emerald-700">{formatCurrency(patient.collected)}</p>
                  </div>
                  <div className="rounded-xl bg-white px-2 py-3">
                    <p className="text-[10px] font-black uppercase text-slate-400">Pendiente</p>
                    <p className="mt-1 text-sm font-black text-amber-700">{formatCurrency(patient.pending)}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-6 grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              eyebrow="Obras sociales y pagadores"
              title="Rentabilidad por pagador"
              description="Facturado, cobrado, pendiente y dependencia"
              icon={BriefcaseBusiness}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4 py-3">Pagador</th>
                    <th className="px-4 py-3 text-right">Turnos</th>
                    <th className="px-4 py-3 text-right">Facturado</th>
                    <th className="px-4 py-3 text-right">% total</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(payers?.rows || []).map((payer) => (
                    <tr key={payer.key} className="border-b border-slate-100">
                      <td className="px-4 py-4 font-black text-slate-900">{payer.name}</td>
                      <td className="px-4 py-4 text-right font-black text-slate-900">{formatCount(payer.turns)}</td>
                      <td className="px-4 py-4 text-right font-black text-slate-900">{formatCurrency(payer.invoiced)}</td>
                      <td className="px-4 py-4 text-right font-black text-slate-700">{formatRate(payer.share)}</td>
                      <td className="px-4 py-4">
                        {payer.dependency ? <Badge tone="rose">Dependencia alta</Badge> : <Badge>Normal</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              eyebrow="Profesionales"
              title="Rentabilidad por profesional"
              description="Preparado para múltiples kinesiólogos"
              icon={Stethoscope}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4 py-3">Profesional</th>
                    <th className="px-4 py-3 text-right">Turnos</th>
                    <th className="px-4 py-3 text-right">Facturado</th>
                    <th className="px-4 py-3 text-right">Promedio</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(professionals?.rows || []).map((professional) => (
                    <tr key={professional.professionalId} className="border-b border-slate-100">
                      <td className="px-4 py-4">
                        <p className="font-black text-slate-900">{professional.professionalName}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">{professional.specialty}</p>
                      </td>
                      <td className="px-4 py-4 text-right font-black text-slate-900">{formatCount(professional.turns)}</td>
                      <td className="px-4 py-4 text-right font-black text-slate-900">{formatCurrency(professional.invoiced)}</td>
                      <td className="px-4 py-4 text-right font-black text-teal-700">{formatCurrency(professional.averagePerTurn)}</td>
                      <td className="px-4 py-4">
                        {professional.dependency ? <Badge tone="rose">Dependencia alta</Badge> : <Badge>Normal</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader eyebrow="Sesiones" title="Top por sesiones" icon={UserRound} />
            <div className="grid gap-2">
              {(patients?.topBySessions || []).slice(0, 6).map((patient) => (
                <div key={patient.patientId} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="truncate text-sm font-black text-slate-800">{patient.patientName}</span>
                  <span className="text-sm font-black text-teal-700">{formatCount(patient.sessionCount)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader eyebrow="Permanencia" title="Top largo plazo" icon={Clock3} />
            <div className="grid gap-2">
              {(patients?.topByPermanence || []).slice(0, 6).map((patient) => (
                <div key={patient.patientId} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="truncate text-sm font-black text-slate-800">{patient.patientName}</span>
                  <span className="text-sm font-black text-slate-700">{formatCount(patient.permanenceDays)} días</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader eyebrow="Riesgo" title="Pacientes en riesgo" icon={TrendingDown} />
            <div className="grid gap-2">
              {(patients?.riskPatients || []).slice(0, 6).length === 0 ? (
                <div className="rounded-xl bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-700">
                  No hay pacientes en riesgo detectados.
                </div>
              ) : (
                patients.riskPatients.slice(0, 6).map((patient) => (
                  <div key={patient.patientId} className="rounded-xl bg-rose-50 px-4 py-3">
                    <p className="text-sm font-black text-rose-800">{patient.patientName}</p>
                    <p className="mt-1 text-xs font-semibold text-rose-700">{patient.riskReason}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ProfitabilityPage;
