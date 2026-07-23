const DashboardHeader = () => (
  <header className="rounded-4xl border border-slate-200 bg-white px-6 py-6 shadow-sm sm:px-8">
    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-teal-600">Panel de Control</p>
    <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
      Cómo viene el consultorio
    </h1>
    <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">
      Seguimiento semanal, resumen del mes actual y evolución de los últimos 12 meses.
      Los turnos cancelados no se incluyen en estas métricas.
    </p>
  </header>
);

export default DashboardHeader;
