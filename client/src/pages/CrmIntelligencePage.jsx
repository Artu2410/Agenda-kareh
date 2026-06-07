import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Clock3,
  HeartHandshake,
  Loader2,
  PhoneCall,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Star,
  UserCheck,
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

const formatDate = (value) => {
  if (!value) return 'Sin datos';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin datos';
  return date.toLocaleDateString('es-AR');
};

const formatRate = (value) => `${Number(value || 0).toFixed(1)}%`;

const getWhatsappUrl = (phone, message) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const normalizedDigits = digits.startsWith('54') ? digits : `54${digits}`;
  return `https://wa.me/${normalizedDigits}?text=${encodeURIComponent(message || '')}`;
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

const PatientMiniCard = ({ patient, tone = 'slate' }) => (
  <article className="rounded-xl border border-slate-100 bg-slate-50 p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="truncate font-black text-slate-900">{patient.patientName}</h3>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          {formatCount(patient.completedCount)} sesiones · última {formatDate(patient.lastAttention)}
        </p>
      </div>
      <Badge tone={tone}>{formatCurrency(patient.invoiced)}</Badge>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      {(patient.badges || []).slice(0, 3).map((badge) => (
        <Badge key={badge} tone={badge.includes('estratégico') ? 'teal' : 'slate'}>{badge}</Badge>
      ))}
    </div>
  </article>
);

const CrmIntelligencePage = () => {
  const [crm, setCrm] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCrm = useCallback(async ({ silent = false } = {}) => {
    try {
      setLoading(true);
      const { data } = await api.get('/crm-intelligence/summary');
      setCrm(data);
    } catch (error) {
      if (!silent) {
        showErrorToast(error?.friendlyMessage || 'No se pudo cargar CRM inteligente.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCrm();
  }, [fetchCrm]);

  const summaryCards = useMemo(() => [
    {
      label: 'Acciones recomendadas',
      value: formatCount(crm?.summary?.actionQueue),
      description: 'Pacientes que conviene contactar',
      icon: PhoneCall,
      tone: Number(crm?.summary?.actionQueue || 0) > 0 ? 'amber' : 'emerald',
    },
    {
      label: 'En riesgo',
      value: formatCount(crm?.summary?.atRisk),
      description: `${formatCurrency(crm?.summary?.strategicValueAtRisk)} de valor histórico`,
      icon: ShieldAlert,
      tone: Number(crm?.summary?.atRisk || 0) > 0 ? 'rose' : 'emerald',
    },
    {
      label: 'Recuperables',
      value: formatCount(crm?.summary?.recoverable),
      description: 'Buen historial y sin agenda futura',
      icon: HeartHandshake,
      tone: 'teal',
    },
    {
      label: 'VIP',
      value: formatCount(crm?.summary?.vip),
      description: 'Alto valor o alta recurrencia',
      icon: Star,
      tone: 'amber',
    },
    {
      label: 'Promotores',
      value: formatCount(crm?.summary?.promoters),
      description: 'Requiere dato de derivaciones',
      icon: Sparkles,
      tone: 'slate',
    },
    {
      label: 'Activos',
      value: formatCount(crm?.summary?.activePatients),
      description: `${formatCount(crm?.summary?.totalPatients)} pacientes con datos útiles`,
      icon: Users,
      tone: 'emerald',
    },
  ], [crm]);

  if (loading && !crm) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 p-8">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
          <Loader2 className="mx-auto animate-spin text-teal-600" size={32} />
          <p className="mt-4 text-sm font-black uppercase tracking-[0.24em] text-slate-400">KIS · Fase 5</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">Detectando pacientes accionables</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-teal-600">KIS · Fase 5</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">CRM Inteligente y Recuperación</h1>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-500">
              Convierte agenda, asistencia y facturación en una cola concreta de pacientes para contactar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchCrm()}
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
            eyebrow="Cola de crecimiento"
            title="A quién conviene contactar primero"
            description="Ordenado por urgencia, valor económico y riesgo de abandono"
            icon={PhoneCall}
          />
          {(crm?.actionQueue || []).length === 0 ? (
            <div className="rounded-xl bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-700">
              No hay pacientes que requieran contacto prioritario con las reglas actuales.
            </div>
          ) : (
            <div className="grid gap-3">
              {(crm?.actionQueue || []).slice(0, 12).map((item) => {
                const whatsappUrl = getWhatsappUrl(item.normalizedPhone, item.messageSuggestion);
                return (
                  <article key={`${item.patientId}-${item.actionType}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black text-slate-900">{item.patientName}</h3>
                          <Badge tone={item.actionType === 'CALL_TODAY' ? 'rose' : 'teal'}>{item.actionLabel}</Badge>
                          <Badge tone="slate">Score {formatCount(item.urgencyScore)}</Badge>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-600">{item.reason}</p>
                        <p className="mt-2 text-xs font-semibold text-slate-500">
                          {formatCount(item.completedCount)} sesiones · {formatRate(item.attendanceRate)} asistencia · {item.weeklyFrequency} sesiones/semana · última {formatDate(item.lastAttention)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {whatsappUrl ? (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-teal-700"
                          >
                            <PhoneCall size={16} />
                            WhatsApp
                          </a>
                        ) : (
                          <Badge tone="rose">Sin teléfono</Badge>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                      <div className="rounded-xl bg-white px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Mensaje sugerido</p>
                        <p className="mt-2 text-sm font-semibold text-slate-700">{item.messageSuggestion}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-white px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Facturado</p>
                          <p className="mt-1 font-black text-slate-900">{formatCurrency(item.invoiced)}</p>
                        </div>
                        <div className="rounded-xl bg-white px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Pendiente</p>
                          <p className="mt-1 font-black text-amber-700">{formatCurrency(item.pending)}</p>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mb-6 grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              eyebrow="Abandono"
              title="Pacientes en riesgo"
              description="Alta recurrencia histórica, sin agenda futura y más de 21 días sin asistir"
              icon={ShieldAlert}
            />
            <div className="grid gap-3">
              {(crm?.segments?.atRisk || []).slice(0, 8).map((patient) => (
                <article key={patient.patientId} className="rounded-xl bg-rose-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-rose-950">{patient.patientName}</h3>
                      <p className="mt-1 text-xs font-semibold text-rose-800">
                        {formatCount(patient.completedCount)} sesiones · {patient.weeklyFrequency} sesiones/semana · {formatCount(patient.daysSinceLastAttention)} días sin asistir
                      </p>
                    </div>
                    <Badge tone="rose">Riesgo</Badge>
                  </div>
                  <ul className="mt-3 grid gap-1 text-xs font-semibold text-rose-800">
                    {(patient.riskReasons || []).slice(0, 3).map((reason) => (
                      <li key={reason}>• {reason}</li>
                    ))}
                  </ul>
                </article>
              ))}
              {(crm?.segments?.atRisk || []).length === 0 && (
                <div className="rounded-xl bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-700">
                  No hay pacientes en riesgo detectados.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              eyebrow="Reactivación"
              title="Pacientes recuperables"
              description="Buena asistencia, historial suficiente y sin agenda futura"
              icon={HeartHandshake}
            />
            <div className="grid gap-3">
              {(crm?.segments?.recoverable || []).slice(0, 8).map((patient) => (
                <article key={patient.patientId} className="rounded-xl bg-teal-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-teal-950">{patient.patientName}</h3>
                      <p className="mt-1 text-xs font-semibold text-teal-800">
                        {formatRate(patient.attendanceRate)} asistencia · {formatCount(patient.activeDays)} días de permanencia
                      </p>
                    </div>
                    <Badge tone="teal">Contactar</Badge>
                  </div>
                  <ul className="mt-3 grid gap-1 text-xs font-semibold text-teal-800">
                    {(patient.recoveryReasons || []).slice(0, 3).map((reason) => (
                      <li key={reason}>• {reason}</li>
                    ))}
                  </ul>
                </article>
              ))}
              {(crm?.segments?.recoverable || []).length === 0 && (
                <div className="rounded-xl bg-slate-50 px-4 py-4 text-sm font-bold text-slate-600">
                  No hay recuperables con las reglas actuales.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              eyebrow="Alto valor"
              title="Pacientes VIP"
              description="Más de $300.000 facturados o 20+ sesiones"
              icon={Star}
            />
            <div className="grid gap-3 md:grid-cols-2">
              {(crm?.segments?.vip || []).slice(0, 8).map((patient) => (
                <PatientMiniCard key={patient.patientId} patient={patient} tone="amber" />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              eyebrow="Derivaciones"
              title="Promotores y candidatos"
              description="No se inventan derivaciones: se muestran candidatos hasta registrar fuente real"
              icon={Sparkles}
            />
            <div className="grid gap-3">
              {(crm?.segments?.promoterCandidates || []).slice(0, 6).map((patient) => (
                <PatientMiniCard key={patient.patientId} patient={patient} tone="teal" />
              ))}
              {(crm?.segments?.promoterCandidates || []).length === 0 && (
                <div className="rounded-xl bg-slate-50 px-4 py-4 text-sm font-bold text-slate-600">
                  Todavía no hay candidatos claros a promotor.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              eyebrow="Reglas activas"
              title="Cómo decide el CRM"
              description="Criterios explícitos para evitar intuición o etiquetas arbitrarias"
              icon={UserCheck}
            />
            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(crm?.rules || {}).map(([key, rules]) => (
                <div key={key} className="rounded-xl bg-slate-50 px-4 py-4">
                  <p className="font-black capitalize text-slate-900">{key}</p>
                  <ul className="mt-2 grid gap-1 text-xs font-semibold text-slate-500">
                    {rules.map((rule) => (
                      <li key={rule}>• {rule}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              eyebrow="Datos faltantes"
              title="Lo que falta para CRM completo"
              description="Sin estos datos, el sistema no debe afirmar más de lo que sabe"
              icon={AlertTriangle}
            />
            <div className="grid gap-3">
              {(crm?.missingData || []).map((item) => (
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

export default CrmIntelligencePage;
