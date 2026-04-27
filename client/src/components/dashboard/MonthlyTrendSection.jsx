import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCount, formatRate, formatVolumeChange } from './dashboardFormatters';

const MonthlyTrendTooltip = ({ active, payload }) => {
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
      {row.insuranceBreakdown?.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Coberturas</p>
          <div className="space-y-1.5">
            {row.insuranceBreakdown.map((item) => (
              <div key={item.name} className="flex items-center justify-between gap-3 text-[11px] font-bold">
                <span className="truncate text-slate-500">{item.name}</span>
                <span className="text-slate-900">{formatCount(item.count)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({ title, value, description, className }) => (
  <div className={className}>
    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">{title}</p>
    <p className="mt-2 text-lg font-black text-slate-900">{value}</p>
    {description && <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p>}
  </div>
);

const ChartToggle = ({ selected, value, children, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(value)}
    className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
      selected === value ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
    }`}
  >
    {children}
  </button>
);

const MonthlyTrendSection = ({ chartData, chartType, currentMonthRow, onChartTypeChange }) => (
  <section className="min-w-0 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
    <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">Últimos 12 meses</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Evolución del consultorio</h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Vista mensual de turnos, asistencias, inasistencias y pendientes.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <ChartToggle selected={chartType} value="bar" onChange={onChartTypeChange}>Barras</ChartToggle>
        <ChartToggle selected={chartType} value="line" onChange={onChartTypeChange}>Líneas</ChartToggle>
      </div>
    </div>

    <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
      <SummaryCard
        title="Mes actual"
        value={currentMonthRow?.label || 'Sin datos'}
        description={`${formatCount(currentMonthRow?.appointmentCount)} turnos cargados`}
        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
      />
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">Asistencia del mes</p>
        <p className="mt-2 text-2xl font-black text-emerald-700">{formatRate(currentMonthRow?.attendanceRate)}</p>
      </div>
      <div className={`rounded-2xl border px-4 py-4 ${
        (currentMonthRow?.volumeChange ?? 0) >= 0
          ? 'border-green-100 bg-green-50 text-green-700'
          : 'border-rose-100 bg-rose-50 text-rose-700'
      }`}
      >
        <p className="text-[10px] font-black uppercase tracking-[0.24em]">Cambio de volumen</p>
        <p className="mt-2 text-2xl font-black">{formatVolumeChange(currentMonthRow?.volumeChange)}</p>
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
);

export default MonthlyTrendSection;
