import { CalendarClock, CalendarRange, CalendarSearch, CalendarDays, TrendingUp, Users } from 'lucide-react';
import { formatCount } from './dashboardFormatters';
import { formatShortDate, getFutureCoverageStats } from './dashboardPeriods';

const SectionBadge = ({ children, toneClassName = 'border-teal-100 bg-teal-50 text-teal-700' }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${toneClassName}`}>
    {children}
  </span>
);

const StatCard = ({ title, value, description, icon, toneClassName }) => (
  <div className={`rounded-3xl border px-4 py-4 sm:px-5 sm:py-5 ${toneClassName}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">{title}</p>
        <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
        {description && <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p>}
      </div>
      <div className="rounded-full bg-white/80 p-3 text-slate-600 shadow-sm">
        {icon}
      </div>
    </div>
  </div>
);

const HorizonPill = ({ label, covered, farthestDate }) => (
  <div className={`rounded-3xl border px-4 py-4 ${covered ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
    <p className="text-[10px] font-black uppercase tracking-[0.24em]">{label}</p>
    <p className="mt-1 text-lg font-black">{covered ? 'Sí' : 'No'}</p>
    <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em]">Hasta {formatShortDate(farthestDate)}</p>
  </div>
);

const FutureAgendaSection = ({ futureAgenda }) => {
  const activePatients = futureAgenda?.activePatients || {};
  const coverageStats = getFutureCoverageStats(futureAgenda?.farthestDate);
  const lastDateLabel = formatShortDate(futureAgenda?.farthestDate);
  const lastDateDescription = futureAgenda?.farthestLabel || 'Sin turnos futuros';

  return (
    <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionBadge>Desde hoy</SectionBadge>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Cobertura futura</h2>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Última fecha agendada, volumen futuro y alcance de la agenda cargada.
          </p>
        </div>
        <div className="rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-bold text-teal-700">
          {futureAgenda?.farthestLabel ? `Última fecha agendada: ${lastDateLabel}` : 'Sin turnos futuros'}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Última fecha agendada"
          value={lastDateLabel}
          description={lastDateDescription}
          icon={<CalendarClock size={18} />}
          toneClassName="border-teal-100 bg-teal-50/40"
        />
        <StatCard
          title="Turnos futuros"
          value={formatCount(futureAgenda?.appointmentCount)}
          description="Total de turnos cargados"
          icon={<TrendingUp size={18} />}
          toneClassName="border-slate-200 bg-slate-50"
        />
        <StatCard
          title="Pacientes con agenda futura"
          value={formatCount(futureAgenda?.patientCount)}
          description={`${formatCount(activePatients.new)} nuevos · ${formatCount(activePatients.recurrent)} recurrentes`}
          icon={<Users size={18} />}
          toneClassName="border-slate-200 bg-slate-50"
        />
        <StatCard
          title="Días cubiertos"
          value={coverageStats ? formatCount(coverageStats.daysCovered) : '0'}
          description="Desde hoy hasta el último turno"
          icon={<CalendarDays size={18} />}
          toneClassName="border-slate-200 bg-slate-50"
        />
        <StatCard
          title="Semanas cubiertas"
          value={coverageStats ? `${coverageStats.weeksCovered.toFixed(1)}` : '0.0'}
          description="Cobertura acumulada"
          icon={<CalendarSearch size={18} />}
          toneClassName="border-slate-200 bg-slate-50"
        />
        <StatCard
          title="Meses cubiertos"
          value={coverageStats ? `${coverageStats.monthsCovered.toFixed(1)}` : '0.0'}
          description="Horizonte proyectado"
          icon={<CalendarRange size={18} />}
          toneClassName="border-slate-200 bg-slate-50"
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <HorizonPill
          label="+30 días"
          covered={Boolean(coverageStats?.reaches30)}
          farthestDate={futureAgenda?.farthestDate}
        />
        <HorizonPill
          label="+60 días"
          covered={Boolean(coverageStats?.reaches60)}
          farthestDate={futureAgenda?.farthestDate}
        />
        <HorizonPill
          label="+90 días"
          covered={Boolean(coverageStats?.reaches90)}
          farthestDate={futureAgenda?.farthestDate}
        />
      </div>
    </section>
  );
};

export default FutureAgendaSection;
