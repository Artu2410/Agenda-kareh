import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock3,
  TrendingUp,
  Users,
} from 'lucide-react';
import { formatCount, formatRate } from './dashboardFormatters';

const OverviewCard = ({ eyebrow, title, description, icon, iconClassName, children }) => (
  <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">{eyebrow}</p>
        <h2 className="mt-3 text-4xl font-black text-slate-900 sm:text-5xl">{title}</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">{description}</p>
      </div>
      <div className={`rounded-full p-3 ${iconClassName}`}>
        {icon}
      </div>
    </div>

    {children}
  </section>
);

const WeeklyMetricTile = ({ value, label, tileClassName, valueClassName, labelClassName }) => (
  <div className={`rounded-2xl px-3 py-4 text-center text-[10px] font-black uppercase tracking-wide ${tileClassName}`}>
    <p className={`text-lg ${valueClassName}`}>{formatCount(value)}</p>
    <span className={labelClassName}>{label}</span>
  </div>
);

const AnnualSummaryRow = ({ label, value, rowClassName, labelClassName, valueClassName }) => (
  <div className={`flex items-center justify-between rounded-2xl px-4 py-4 ${rowClassName}`}>
    <span className={`text-[10px] font-black uppercase tracking-[0.24em] ${labelClassName}`}>{label}</span>
    <span className={`text-2xl font-black ${valueClassName}`}>{formatCount(value)}</span>
  </div>
);

const WeeklyCard = ({ weekly }) => (
  <OverviewCard
    eyebrow="Esta Semana"
    title={formatCount(weekly?.total)}
    description="Turnos activos esta semana"
    icon={<Calendar size={22} />}
    iconClassName="bg-teal-100 text-teal-700"
  >
    <div className="mt-5 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-4">
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-teal-700">Asistencia efectiva</p>
      <p className="mt-2 text-2xl font-black text-teal-700">{formatRate(weekly?.attendanceRate)}</p>
    </div>

    <div className="mt-5 grid grid-cols-3 gap-2">
      <WeeklyMetricTile
        value={weekly?.scheduled}
        label="Pendientes"
        tileClassName="bg-slate-50 text-slate-600"
        valueClassName="text-slate-900"
        labelClassName="text-slate-400"
      />
      <WeeklyMetricTile
        value={weekly?.completed}
        label="Asistieron"
        tileClassName="bg-emerald-50 text-emerald-700"
        valueClassName=""
        labelClassName="text-emerald-500"
      />
      <WeeklyMetricTile
        value={weekly?.noShow}
        label="Inasist."
        tileClassName="bg-rose-50 text-rose-700"
        valueClassName=""
        labelClassName="text-rose-500"
      />
    </div>

    <div className="mt-4 flex items-center justify-between rounded-2xl border border-purple-200 bg-purple-50 p-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-700">Respiratorios</p>
        <p className="mt-0.5 text-sm font-bold text-slate-600">Semana actual</p>
      </div>
      <span className="text-2xl font-black text-purple-900">{formatCount(weekly?.respiratory)}</span>
    </div>
  </OverviewCard>
);

const MonthlyCard = ({ monthly }) => (
  <OverviewCard
    eyebrow={monthly?.label || 'Este Mes'}
    title={formatCount(monthly?.current)}
    description="Turnos del mes actual"
    icon={<TrendingUp size={22} />}
    iconClassName="bg-green-100 text-green-700"
  >
    <div className={`mt-5 rounded-2xl border px-4 py-4 ${
      Number(monthly?.change) >= 0
        ? 'border-green-200 bg-green-50 text-green-700'
        : 'border-rose-200 bg-rose-50 text-rose-700'
    }`}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.24em]">Variación vs mes anterior</p>
      <p className="mt-2 text-2xl font-black">{monthly?.changeLabel || '0%'}</p>
    </div>

    <div className="mt-5 grid grid-cols-2 gap-3 text-[10px] font-black uppercase tracking-wide">
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-emerald-700">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={14} />
          <span>Asistencias</span>
        </div>
        <p className="mt-2 text-2xl">{formatCount(monthly?.completed)}</p>
      </div>
      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4 text-amber-700">
        <div className="flex items-center gap-2">
          <Clock3 size={14} />
          <span>Pendientes</span>
        </div>
        <p className="mt-2 text-2xl">{formatCount(monthly?.scheduled)}</p>
      </div>
    </div>

    <div className="mt-3 flex items-center justify-between rounded-2xl border border-rose-100 bg-rose-50 px-4 py-4">
      <div className="flex items-center gap-2 text-rose-700">
        <AlertTriangle size={16} />
        <span className="text-[10px] font-black uppercase tracking-[0.24em]">Inasistencias</span>
      </div>
      <span className="text-xl font-black text-rose-700">{formatCount(monthly?.noShow)}</span>
    </div>

    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Asistencia real del mes</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{formatRate(monthly?.attendanceRate)}</p>
    </div>
  </OverviewCard>
);

const AnnualCard = ({ annual }) => (
  <OverviewCard
    eyebrow="Global del Año"
    title={formatCount(annual?.patientCount)}
    description="Pacientes atendidos este año"
    icon={<Users size={22} />}
    iconClassName="bg-slate-100 text-slate-700"
  >
    <div className="mt-5 grid grid-cols-1 gap-3">
      <AnnualSummaryRow
        label="Turnos del año"
        value={annual?.appointmentCount}
        rowClassName="border border-slate-200 bg-slate-50"
        labelClassName="text-slate-500"
        valueClassName="text-slate-900"
      />
      <AnnualSummaryRow
        label="Asistencias"
        value={annual?.completedCount}
        rowClassName="border border-emerald-100 bg-emerald-50"
        labelClassName="text-emerald-600"
        valueClassName="text-emerald-700"
      />
      <AnnualSummaryRow
        label="Inasistencias"
        value={annual?.noShowCount}
        rowClassName="border border-rose-100 bg-rose-50"
        labelClassName="text-rose-600"
        valueClassName="text-rose-700"
      />
    </div>
  </OverviewCard>
);

const OverviewSection = ({ metrics }) => (
  <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
    <WeeklyCard weekly={metrics?.weekly} />
    <MonthlyCard monthly={metrics?.monthly} />
    <AnnualCard annual={metrics?.annual} />
  </div>
);

export default OverviewSection;
