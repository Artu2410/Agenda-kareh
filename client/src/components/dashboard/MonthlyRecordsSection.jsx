import { formatCount, formatRate, formatVolumeChange } from './dashboardFormatters';

const InsuranceTags = ({ items, className }) => (
  <div className={className}>
    {items?.map((item) => (
      <span key={item.name} className="rounded-md border border-slate-200/50 bg-slate-100/80 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-tight text-slate-400">
        {item.name}: {item.count}
      </span>
    ))}
  </div>
);

const MobileInsuranceTags = ({ items }) => (
  <div className="mt-2 flex flex-wrap gap-1.5">
    {items?.map((item) => (
      <span key={item.name} className="rounded-lg border border-slate-200/60 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-tight text-slate-500 shadow-sm">
        {item.name}: {item.count}
      </span>
    ))}
  </div>
);

const MobileMetricCard = ({ label, value, toneClassName, labelClassName }) => (
  <div className={`rounded-2xl bg-white px-3 py-3 ${toneClassName}`}>
    <p className={`text-[10px] uppercase tracking-[0.2em] ${labelClassName}`}>{label}</p>
    <p className="mt-1 text-xl font-black">{formatCount(value)}</p>
  </div>
);

const MonthlyRecordsSection = ({ monthlyRows }) => (
  <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
    <div className="mb-6">
      <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">Mes a mes con actividad</p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
        Registro mensual del consultorio
      </h2>
      <p className="mt-2 text-sm font-medium text-slate-500">
        Meses con actividad real, total de turnos, asistencias, inasistencias, pendientes y tasa de asistencia.
      </p>
    </div>

    {monthlyRows.length > 0 ? (
      <>
        <div className="hidden overflow-x-auto lg:block">
      <table className="min-w-full text-left">
        <thead>
          <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
            <th className="px-4 py-3">Mes</th>
            <th className="px-4 py-3 text-right">Turnos</th>
            <th className="px-4 py-3 text-right">Asistieron</th>
            <th className="px-4 py-3 text-right">Inasist.</th>
            <th className="px-4 py-3 text-right">Pendientes</th>
            <th className="px-4 py-3 text-right">% Asistencia</th>
            <th className="px-4 py-3 text-right">Vs mes previo</th>
          </tr>
        </thead>
        <tbody>
          {monthlyRows.map((row, index) => (
            <tr key={row.monthKey} className={`border-b border-slate-100 ${index === 0 ? 'bg-teal-50/40' : 'bg-white'}`}>
              <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm font-black capitalize text-slate-900">{row.label}</p>
                    {index === 0 && (
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-teal-600">Mes actual</p>
                    )}
                    <InsuranceTags items={row.insuranceBreakdown} className="mt-1.5 flex flex-wrap gap-1" />
                  </div>
                </div>
              </td>
              <td className="px-4 py-4 text-right text-sm font-black text-slate-900">{formatCount(row.appointmentCount)}</td>
              <td className="px-4 py-4 text-right text-sm font-black text-emerald-700">{formatCount(row.completedCount)}</td>
              <td className="px-4 py-4 text-right text-sm font-black text-rose-700">{formatCount(row.noShowCount)}</td>
              <td className="px-4 py-4 text-right text-sm font-black text-amber-700">{formatCount(row.scheduledCount)}</td>
              <td className="px-4 py-4 text-right text-sm font-black text-slate-900">{formatRate(row.attendanceRate)}</td>
              <td className={`px-4 py-4 text-right text-sm font-black ${
                (row.volumeChange ?? 0) >= 0 ? 'text-green-700' : 'text-rose-700'
              }`}
              >
                {formatVolumeChange(row.volumeChange)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
        </div>

        <div className="grid gap-3 lg:hidden">
          {monthlyRows.map((row, index) => (
            <article
              key={row.monthKey}
              className={`rounded-[1.6rem] border px-4 py-4 ${
                index === 0
                  ? 'border-teal-200 bg-teal-50/50'
                  : 'border-slate-200 bg-slate-50/60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black capitalize text-slate-900">{row.label}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                    {index === 0 ? 'Último mes con actividad' : 'Mes cerrado'}
                  </p>
                  <MobileInsuranceTags items={row.insuranceBreakdown} />
                </div>
                <div className={`rounded-xl px-3 py-2 text-xs font-black ${
                  (row.volumeChange ?? 0) >= 0 ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'
                }`}
                >
                  {formatVolumeChange(row.volumeChange)}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <MobileMetricCard
                  label="Turnos"
                  value={row.appointmentCount}
                  toneClassName="text-slate-900"
                  labelClassName="text-slate-400"
                />
                <MobileMetricCard
                  label="Asistieron"
                  value={row.completedCount}
                  toneClassName="text-emerald-700"
                  labelClassName="text-emerald-400"
                />
                <MobileMetricCard
                  label="Inasist."
                  value={row.noShowCount}
                  toneClassName="text-rose-700"
                  labelClassName="text-rose-400"
                />
                <MobileMetricCard
                  label="Pendientes"
                  value={row.scheduledCount}
                  toneClassName="text-amber-700"
                  labelClassName="text-amber-400"
                />
              </div>
              <div className="mt-3 rounded-2xl bg-white px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Asistencia real</p>
                <p className="mt-1 text-xl font-black text-slate-900">{formatRate(row.attendanceRate)}</p>
              </div>
            </article>
          ))}
        </div>
      </>
    ) : (
      <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm font-semibold text-slate-400">
        No hay meses con actividad para mostrar.
      </div>
    )}
  </section>
);

export default MonthlyRecordsSection;
