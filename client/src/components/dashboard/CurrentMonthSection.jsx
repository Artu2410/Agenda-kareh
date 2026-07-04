import { AlertTriangle, Calendar, CheckCircle2, Clock3, TrendingUp } from 'lucide-react';
import { formatCount, formatRate } from './dashboardFormatters';
import { formatCurrentMonthRange } from './dashboardPeriods';

const formatCurrency = (value) => new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
}).format(Number(value) || 0);

const SectionBadge = ({ children, toneClassName = 'border-green-100 bg-green-50 text-green-700' }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${toneClassName}`}>
    {children}
  </span>
);

const MetricCard = ({ label, value, toneClassName, valueClassName, labelClassName, icon }) => (
  <div className={`rounded-3xl border px-4 py-4 ${toneClassName}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className={`text-[10px] font-black uppercase tracking-[0.24em] ${labelClassName}`}>{label}</p>
        <p className={`mt-2 text-2xl font-black ${valueClassName}`}>{value}</p>
      </div>
      {icon && <div className="rounded-full bg-white/70 p-2.5 text-current shadow-sm">{icon}</div>}
    </div>
  </div>
);

const InsuranceTag = ({ name, count }) => (
  <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-tight text-slate-500">
    {name}: {formatCount(count)}
  </span>
);

const CurrentMonthSection = ({ monthly, weekly, commercial, billingByCoverage, insights }) => {
  const currentMonthRange = formatCurrentMonthRange();
  const occupancyRate = Number(monthly?.occupancyRate || 0);
  const freeCapacity = Number(monthly?.freeCapacity || 0);

  return (
    <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionBadge>Mes actual</SectionBadge>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Mes completo del consultorio</h2>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Turnos del mes completo, asistencia y distribución por obra social.
          </p>
        </div>
        <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
          {currentMonthRange}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label="Turnos del mes"
              value={formatCount(monthly?.current)}
              toneClassName="border-slate-200 bg-slate-50"
              valueClassName="text-slate-900"
              labelClassName="text-slate-500"
            />
            <MetricCard
              label="Asistencias"
              value={formatCount(monthly?.completed)}
              toneClassName="border-emerald-100 bg-emerald-50"
              valueClassName="text-emerald-700"
              labelClassName="text-emerald-600"
              icon={<CheckCircle2 size={16} />}
            />
            <MetricCard
              label="Pendientes"
              value={formatCount(monthly?.scheduled)}
              toneClassName="border-amber-100 bg-amber-50"
              valueClassName="text-amber-700"
              labelClassName="text-amber-600"
              icon={<Clock3 size={16} />}
            />
            <MetricCard
              label="Inasistencias"
              value={formatCount(monthly?.noShow)}
              toneClassName="border-rose-100 bg-rose-50"
              valueClassName="text-rose-700"
              labelClassName="text-rose-600"
              icon={<AlertTriangle size={16} />}
            />
            <MetricCard
              label="% Asistencia"
              value={formatRate(monthly?.attendanceRate)}
              toneClassName="border-teal-100 bg-teal-50"
              valueClassName="text-teal-700"
              labelClassName="text-teal-600"
              icon={<TrendingUp size={16} />}
            />
          </div>

          <div className="mt-4 rounded-[1.8rem] border border-slate-200 bg-slate-50 px-5 py-5">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Desglose por obra social</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {monthly?.insuranceBreakdown?.length > 0 ? (
                monthly.insuranceBreakdown.map((item) => (
                  <InsuranceTag key={item.name} name={item.name} count={item.count} />
                ))
              ) : (
                <p className="text-sm font-semibold text-slate-400">Sin desglose para mostrar.</p>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-purple-200 bg-purple-50 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-purple-600">Respiratorios</p>
                <p className="mt-2 text-2xl font-black text-purple-700">{formatCount(monthly?.respiratory)}</p>
              </div>
              <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-600">I.U. / Piso Pélvico</p>
                <p className="mt-2 text-2xl font-black text-orange-700">{formatCount(monthly?.iu)}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[1.8rem] border border-slate-200 bg-slate-50 px-5 py-5">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Ocupación y capacidad</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Capacidad mensual</p>
                <p className="mt-2 text-xl font-black text-slate-900">{formatCount(monthly?.capacityMonthly)}</p>
              </div>
              <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-teal-600">Ocupación</p>
                <p className="mt-2 text-xl font-black text-teal-700">{formatRate(occupancyRate)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Capacidad libre</p>
                <p className="mt-2 text-xl font-black text-slate-900">{formatCount(freeCapacity)}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[1.8rem] border border-slate-200 bg-slate-50 px-5 py-5">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Embudo comercial</p>
            <h3 className="mt-2 text-lg font-black text-slate-900">Consultas, turnos y continuidad</h3>
            {commercial?.hasRealData ? (
              <>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Consultas</p>
                    <p className="mt-2 text-xl font-black text-slate-900">{formatCount(commercial?.consultations)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Turnos otorgados</p>
                    <p className="mt-2 text-xl font-black text-slate-900">{formatCount(commercial?.turnsGranted)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Asistencias</p>
                    <p className="mt-2 text-xl font-black text-emerald-700">{formatCount(commercial?.assistances)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Continuidad</p>
                    <p className="mt-2 text-xl font-black text-slate-900">{formatCount(commercial?.continuityCount)}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-600">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1">Consultas → Turnos: {formatRate(commercial?.conversions?.consultationsToTurns)}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">Turno → Asistencia: {formatRate(commercial?.conversions?.turnsToAssistances)}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">Asistencia → Continuidad: {formatRate(commercial?.conversions?.assistancesToContinuity)}</span>
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-500">
                    Pacientes con dos o más asistencias dentro del período y pacientes que solo asistieron una vez.
                  </p>
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm font-semibold text-slate-500">
                Sin datos
              </div>
            )}
          </div>

          <div className="mt-4 rounded-[1.8rem] border border-slate-200 bg-slate-50 px-5 py-5">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Facturación por cobertura</p>
            <h3 className="mt-2 text-lg font-black text-slate-900">Monto y volumen por cobertura</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                    <th className="pb-3 pr-4">Cobertura</th>
                    <th className="pb-3 pr-4">Pacientes</th>
                    <th className="pb-3 pr-4">Turnos</th>
                    <th className="pb-3 pr-4">Monto facturado</th>
                    <th className="pb-3">Promedio por paciente</th>
                  </tr>
                </thead>
                <tbody>
                  {billingByCoverage?.length > 0 ? (
                    billingByCoverage.map((item) => (
                      <tr key={item.name} className="border-b border-slate-100 text-slate-600">
                        <td className="py-3 pr-4 font-semibold text-slate-800">{item.name}</td>
                        <td className="py-3 pr-4">{formatCount(item.patients)}</td>
                        <td className="py-3 pr-4">{formatCount(item.turns)}</td>
                        <td className="py-3 pr-4">{formatCurrency(item.amount)}</td>
                        <td className="py-3">{formatCurrency(item.avgPerPatient)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="py-4 text-sm font-semibold text-slate-400">Sin datos</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 rounded-[1.8rem] border border-slate-200 bg-slate-50 px-5 py-5">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Insights automáticos</p>
            <ul className="mt-4 space-y-2">
              {insights?.length > 0 ? (
                insights.map((insight, index) => (
                  <li key={`${insight}-${index}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600">
                    {insight}
                  </li>
                ))
              ) : (
                <li className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-400">
                  Sin insights para mostrar.
                </li>
              )}
            </ul>
          </div>
        </div>

        <aside className="rounded-[1.8rem] border border-slate-200 bg-slate-50 px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <SectionBadge toneClassName="border-slate-200 bg-white text-slate-600">Semana actual</SectionBadge>
              <h3 className="mt-3 text-xl font-black text-slate-900">Desde lunes hasta domingo</h3>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Turnos activos esta semana.
              </p>
            </div>
            <div className="rounded-full bg-white p-3 text-teal-700 shadow-sm">
              <Calendar size={22} />
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-teal-200 bg-teal-50 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-teal-700">Asistencia efectiva</p>
            <p className="mt-2 text-2xl font-black text-teal-700">{formatRate(weekly?.attendanceRate)}</p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <MetricCard
              label="Turnos"
              value={formatCount(weekly?.total)}
              toneClassName="border-white bg-white"
              valueClassName="text-slate-900 text-xl"
              labelClassName="text-slate-400"
            />
            <MetricCard
              label="Asistieron"
              value={formatCount(weekly?.completed)}
              toneClassName="border-white bg-white"
              valueClassName="text-emerald-700 text-xl"
              labelClassName="text-emerald-500"
            />
            <MetricCard
              label="Inasist."
              value={formatCount(weekly?.noShow)}
              toneClassName="border-white bg-white"
              valueClassName="text-rose-700 text-xl"
              labelClassName="text-rose-500"
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-purple-200 bg-purple-50 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-purple-700">Respiratorios</p>
              <p className="mt-1 text-xl font-black text-purple-900">{formatCount(weekly?.respiratory)}</p>
            </div>
            <div className="rounded-2xl border border-orange-200 bg-orange-50 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-orange-700">I.U. / Piso Pélvico</p>
              <p className="mt-1 text-xl font-black text-orange-900">{formatCount(weekly?.iu)}</p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default CurrentMonthSection;
