import { useEffect, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartBarBig } from 'lucide-react';
import { formatCount, formatRate } from './dashboardFormatters';

const ChartSurface = ({ children }) => {
  const containerRef = useRef(null);
  const [canRenderChart, setCanRenderChart] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return undefined;
    }

    const updateAvailability = () => {
      const { width, height } = node.getBoundingClientRect();
      setCanRenderChart(width > 0 && height > 0);
    };

    updateAvailability();

    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      updateAvailability();
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="h-[320px] min-h-[320px] w-full min-w-0">
      {canRenderChart ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={320}>
          {children}
        </ResponsiveContainer>
      ) : (
        <div className="h-full w-full animate-pulse rounded-[1.75rem] bg-slate-100" />
      )}
    </div>
  );
};

const SectionBadge = ({ children, toneClassName = 'border-teal-100 bg-teal-50 text-teal-700' }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${toneClassName}`}>
    {children}
  </span>
);

const CoverageTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;

  const row = payload[0].payload;

  return (
    <div className="min-w-[220px] rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">{row.label}</p>
      <div className="mt-3 space-y-2 text-sm font-semibold text-slate-600">
        <div className="flex items-center justify-between gap-3">
          <span>Turnos</span>
          <span className="font-black text-slate-900">{formatCount(row.appointmentCount)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Pacientes únicos del mes</span>
          <span className="font-black text-teal-700">{formatCount(row.patientCount)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>% del total futuro</span>
          <span className="font-black text-slate-900">{formatRate(row.shareOfTotal)}</span>
        </div>
      </div>
    </div>
  );
};

const FutureCoverageSection = ({ futureAgenda }) => {
  const coverage = Array.isArray(futureAgenda?.coverageByMonth)
    ? futureAgenda.coverageByMonth.map((row) => ({
      ...row,
      shareOfTotal: futureAgenda?.appointmentCount > 0
        ? (row.appointmentCount / futureAgenda.appointmentCount) * 100
        : 0,
    }))
    : [];

  return (
    <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionBadge>Desde hoy hacia adelante</SectionBadge>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Turnos futuros por mes</h2>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Mes, cantidad de turnos y pacientes únicos para anticipar la carga futura del consultorio.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
          Cobertura de agenda desde hoy
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[1.8rem] border border-slate-200 bg-slate-50 px-5 py-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Cobertura futura</p>
              <h3 className="mt-2 text-xl font-black text-slate-900">Turnos futuros por mes</h3>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Vista mensual desde hoy hacia adelante.
              </p>
              <span className="mt-3 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-600">
                Pacientes únicos del mes
              </span>
            </div>
            <div className="rounded-full bg-white p-3 text-teal-700 shadow-sm">
              <ChartBarBig size={22} />
            </div>
          </div>

          {coverage.length > 0 ? (
            <ChartSurface>
              <BarChart data={coverage} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 700 }} tickLine={false} axisLine={false} minTickGap={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
                <RechartsTooltip content={<CoverageTooltip />} />
                <Legend wrapperStyle={{ paddingTop: 12 }} />
                <Bar dataKey="appointmentCount" name="Turnos" fill="#14b8a6" radius={[8, 8, 0, 0]} />
                <Bar dataKey="patientCount" name="Pacientes únicos del mes" fill="#0f172a" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartSurface>
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm font-semibold text-slate-400">
              No hay turnos futuros cargados.
            </div>
          )}
        </div>

        <div className="rounded-[1.8rem] border border-slate-200 bg-white px-5 py-5">
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Cobertura de agenda</p>
            <h3 className="mt-2 text-xl font-black text-slate-900">Distribución por mes</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              Meses futuros con actividad real, turnos y pacientes únicos.
            </p>
          </div>

          {coverage.length > 0 ? (
            <div className="overflow-hidden rounded-[1.5rem] border border-slate-200">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                    <th className="px-4 py-3">Mes</th>
                    <th className="px-4 py-3 text-right">Turnos</th>
                    <th className="px-4 py-3 text-right">Pacientes únicos</th>
                    <th className="px-4 py-3 text-right">% del total futuro</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.map((row) => (
                    <tr key={row.monthKey} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-4 py-4">
                        <p className="text-sm font-black capitalize text-slate-900">{row.label}</p>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{row.month}</p>
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-black text-teal-700">{formatCount(row.appointmentCount)}</td>
                      <td className="px-4 py-4 text-right text-sm font-black text-slate-900">{formatCount(row.patientCount)}</td>
                      <td className="px-4 py-4 text-right text-sm font-black text-slate-700">{formatRate(row.shareOfTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm font-semibold text-slate-400">
              No hay cobertura futura para mostrar.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default FutureCoverageSection;
