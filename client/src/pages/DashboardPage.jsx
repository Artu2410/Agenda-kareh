import React, { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import api from '../services/api';
import toast from 'react-hot-toast';

const formatCount = (value) => new Intl.NumberFormat('es-AR').format(Number(value) || 0);
const formatRate = (value) => `${Number(value || 0).toFixed(1)}%`;
const formatVolumeChange = (value) => {
  if (value === null || value === undefined) return 'Sin base';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
};

const MonthlyTrendTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;

  const row = payload[0].payload;

  return (
    <div className="min-w-[220px] rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
        {row.label}
      </p>
      <div className="mt-3 space-y-2 text-sm font-semibold text-slate-600">
        <div className="flex items-center justify-between gap-3">
          <span>Turnos</span>
          <span className="font-black text-slate-900">{formatCount(row.appointmentCount)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Asistencias</span>
          <span className="font-black text-teal-700">{formatCount(row.completedCount)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Inasistencias</span>
          <span className="font-black text-rose-700">{formatCount(row.noShowCount)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Pendientes</span>
          <span className="font-black text-amber-700">{formatCount(row.scheduledCount)}</span>
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        Asistencia real: <span className="text-slate-900">{formatRate(row.attendanceRate)}</span>
      </div>
    </div>
  );
};

const DashboardPage = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState('bar');

  useEffect(() => {
    let isMounted = true;

    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/metrics');

        if (!isMounted) return;
        setMetrics(data);
      } catch {
        toast.error('Error al cargar métricas');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchMetrics();

    return () => {
      isMounted = false;
    };
  }, []);

  const monthlyRows = useMemo(() => {
    const trend = Array.isArray(metrics?.monthlyTrend) ? metrics.monthlyTrend : [];

    const rows = trend.map((row, index) => {
      const previousRow = index > 0 ? trend[index - 1] : null;
      const volumeChange = previousRow && previousRow.appointmentCount > 0
        ? Number((((row.appointmentCount - previousRow.appointmentCount) / previousRow.appointmentCount) * 100).toFixed(1))
        : null;

      return {
        ...row,
        volumeChange,
      };
    });

    return rows.reverse();
  }, [metrics]);

  const currentMonthRow = monthlyRows[0] || null;
  const chartData = Array.isArray(metrics?.monthlyTrend) ? metrics.monthlyTrend : [];

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 p-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-teal-600">Panel</p>
          <h1 className="mt-3 text-2xl font-black text-slate-900">Cargando métricas</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Preparando el resumen semanal, mensual y anual del consultorio.
          </p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return <div className="flex min-h-full items-center justify-center font-bold">Sin datos</div>;
  }

  return (
    <div className="min-h-full w-full overflow-auto bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 sm:gap-8">
        <header className="rounded-[2rem] border border-slate-200 bg-white px-6 py-6 shadow-sm sm:px-8">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-teal-600">Panel de Control</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Cómo viene el consultorio
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">
            Seguimiento semanal, resumen del mes actual y evolución de los últimos 12 meses.
            Los turnos cancelados no se incluyen en estas métricas.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">Esta Semana</p>
                <h2 className="mt-3 text-4xl font-black text-slate-900 sm:text-5xl">
                  {formatCount(metrics.weekly?.total)}
                </h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">Turnos activos esta semana</p>
              </div>
              <div className="rounded-full bg-teal-100 p-3 text-teal-700">
                <Calendar size={22} />
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-teal-700">Asistencia efectiva</p>
              <p className="mt-2 text-2xl font-black text-teal-700">
                {formatRate(metrics.weekly?.attendanceRate)}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-[10px] font-black uppercase tracking-wide">
              <div className="rounded-2xl bg-slate-50 px-3 py-4 text-slate-600">
                <p className="text-lg text-slate-900">{formatCount(metrics.weekly?.scheduled)}</p>
                <span className="text-slate-400">Pendientes</span>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-3 py-4 text-emerald-700">
                <p className="text-lg">{formatCount(metrics.weekly?.completed)}</p>
                <span className="text-emerald-500">Asistieron</span>
              </div>
              <div className="rounded-2xl bg-rose-50 px-3 py-4 text-rose-700">
                <p className="text-lg">{formatCount(metrics.weekly?.noShow)}</p>
                <span className="text-rose-500">Inasist.</span>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
                  {metrics.monthly?.label || 'Este Mes'}
                </p>
                <h2 className="mt-3 text-4xl font-black text-slate-900 sm:text-5xl">
                  {formatCount(metrics.monthly?.current)}
                </h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">Turnos del mes actual</p>
              </div>
              <div className="rounded-full bg-green-100 p-3 text-green-700">
                <TrendingUp size={22} />
              </div>
            </div>

            <div className={`mt-5 rounded-2xl border px-4 py-4 ${
              Number(metrics.monthly?.change) >= 0
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.24em]">Variación vs mes anterior</p>
              <p className="mt-2 text-2xl font-black">{metrics.monthly?.changeLabel || '0%'}</p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-[10px] font-black uppercase tracking-wide">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-emerald-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  <span>Asistencias</span>
                </div>
                <p className="mt-2 text-2xl">{formatCount(metrics.monthly?.completed)}</p>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4 text-amber-700">
                <div className="flex items-center gap-2">
                  <Clock3 size={14} />
                  <span>Pendientes</span>
                </div>
                <p className="mt-2 text-2xl">{formatCount(metrics.monthly?.scheduled)}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-2xl border border-rose-100 bg-rose-50 px-4 py-4">
              <div className="flex items-center gap-2 text-rose-700">
                <AlertTriangle size={16} />
                <span className="text-[10px] font-black uppercase tracking-[0.24em]">Inasistencias</span>
              </div>
              <span className="text-xl font-black text-rose-700">{formatCount(metrics.monthly?.noShow)}</span>
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Asistencia real del mes</p>
              <p className="mt-2 text-2xl font-black text-slate-900">
                {formatRate(metrics.monthly?.attendanceRate)}
              </p>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">Global del Año</p>
                <h2 className="mt-3 text-4xl font-black text-slate-900 sm:text-5xl">
                  {formatCount(metrics.annual?.patientCount)}
                </h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">Pacientes atendidos este año</p>
              </div>
              <div className="rounded-full bg-slate-100 p-3 text-slate-700">
                <Users size={22} />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Turnos del año</span>
                <span className="text-2xl font-black text-slate-900">{formatCount(metrics.annual?.appointmentCount)}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">Asistencias</span>
                <span className="text-2xl font-black text-emerald-700">{formatCount(metrics.annual?.completedCount)}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-rose-100 bg-rose-50 px-4 py-4">
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-600">Inasistencias</span>
                <span className="text-2xl font-black text-rose-700">{formatCount(metrics.annual?.noShowCount)}</span>
              </div>
            </div>
          </section>
        </div>

        <section className="min-w-0 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">Últimos 12 meses</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Evolución del consultorio</h2>
              <p className="mt-2 text-sm font-medium text-slate-500">
                Vista mensual de turnos, asistencias, inasistencias y pendientes.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setChartType('bar')}
                className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
                  chartType === 'bar' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Barras
              </button>
              <button
                type="button"
                onClick={() => setChartType('line')}
                className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
                  chartType === 'line' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Líneas
              </button>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Mes actual</p>
              <p className="mt-2 text-lg font-black text-slate-900">{currentMonthRow?.label || 'Sin datos'}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {formatCount(currentMonthRow?.appointmentCount)} turnos cargados
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">Asistencia del mes</p>
              <p className="mt-2 text-2xl font-black text-emerald-700">
                {formatRate(currentMonthRow?.attendanceRate)}
              </p>
            </div>
            <div className={`rounded-2xl border px-4 py-4 ${
              (currentMonthRow?.volumeChange ?? 0) >= 0
                ? 'border-green-100 bg-green-50 text-green-700'
                : 'border-rose-100 bg-rose-50 text-rose-700'
            }`}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.24em]">Cambio de volumen</p>
              <p className="mt-2 text-2xl font-black">
                {formatVolumeChange(currentMonthRow?.volumeChange)}
              </p>
            </div>
          </div>

          <div className="h-[340px] min-h-[340px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={280}>
              {chartType === 'bar' ? (
                <BarChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 700 }} tickLine={false} axisLine={false} minTickGap={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
                  <RechartsTooltip content={<MonthlyTrendTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: 12 }} />
                  <Bar dataKey="completedCount" name="Asistencias" stackId="turnos" fill="#14b8a6" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="noShowCount" name="Inasistencias" stackId="turnos" fill="#fb7185" />
                  <Bar dataKey="scheduledCount" name="Pendientes" stackId="turnos" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 700 }} tickLine={false} axisLine={false} minTickGap={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
                  <RechartsTooltip content={<MonthlyTrendTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: 12 }} />
                  <Line type="monotone" dataKey="appointmentCount" name="Turnos" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="completedCount" name="Asistencias" stroke="#14b8a6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="noShowCount" name="Inasistencias" stroke="#fb7185" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">Mes a mes</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
              Registro mensual del consultorio
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Últimos 12 meses con total de turnos, asistencias, inasistencias, pendientes y tasa de asistencia.
            </p>
          </div>

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
                      {index === 0 ? 'Mes actual' : 'Mes cerrado'}
                    </p>
                  </div>
                  <div className={`rounded-xl px-3 py-2 text-xs font-black ${
                    (row.volumeChange ?? 0) >= 0 ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'
                  }`}
                  >
                    {formatVolumeChange(row.volumeChange)}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm font-black">
                  <div className="rounded-2xl bg-white px-3 py-3 text-slate-900">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Turnos</p>
                    <p className="mt-1 text-xl">{formatCount(row.appointmentCount)}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-3 text-emerald-700">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-400">Asistieron</p>
                    <p className="mt-1 text-xl">{formatCount(row.completedCount)}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-3 text-rose-700">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-rose-400">Inasist.</p>
                    <p className="mt-1 text-xl">{formatCount(row.noShowCount)}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-3 text-amber-700">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400">Pendientes</p>
                    <p className="mt-1 text-xl">{formatCount(row.scheduledCount)}</p>
                  </div>
                </div>
                <div className="mt-3 rounded-2xl bg-white px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Asistencia real</p>
                  <p className="mt-1 text-xl font-black text-slate-900">{formatRate(row.attendanceRate)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default DashboardPage;
