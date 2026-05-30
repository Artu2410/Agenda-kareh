import { Users } from 'lucide-react';
import { formatCount } from './dashboardFormatters';
import { formatYearRange } from './dashboardPeriods';

const OverviewCard = ({ eyebrow, title, description, icon, iconClassName, children }) => (
  <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
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
  </div>
);

const AnnualSummaryRow = ({ label, value, rowClassName, labelClassName, valueClassName }) => (
  <div className={`flex items-center justify-between rounded-2xl px-4 py-4 ${rowClassName}`}>
    <span className={`text-[10px] font-black uppercase tracking-[0.24em] ${labelClassName}`}>{label}</span>
    <span className={`text-2xl font-black ${valueClassName}`}>{formatCount(value)}</span>
  </div>
);

const AnnualSection = ({ annual }) => {
  const yearRange = formatYearRange();

  return (
    <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-600">
            Año corrido (incluye agenda futura)
          </span>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Resumen anual del consultorio</h2>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Desde 1 de enero de 2026 hasta hoy, con agenda cargada hacia adelante dentro del mismo año.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
          {yearRange}
        </div>
      </div>

      <OverviewCard
        eyebrow="Global del año"
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
    </section>
  );
};

export default AnnualSection;
