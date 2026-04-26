import { formatCount } from './dashboardFormatters';

const InsuranceBreakdownSection = ({ monthly }) => {
  const items = Array.isArray(monthly?.insuranceBreakdown) ? monthly.insuranceBreakdown : [];

  return (
    <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6">
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-teal-600">Desglose por Cobertura</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
          {monthly?.label || 'Este mes'} - Obras Sociales y Particulares
        </h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Distribución de turnos activos por tipo de cobertura médica en el mes actual.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {items.length > 0 ? (
          items.map((item) => {
            const isRespiratory = item.name === 'PARTICULAR RESPIRATORIO';

            return (
              <div key={item.name} className={`flex flex-col rounded-[1.25rem] border p-4 transition-colors lg:p-5 ${
                isRespiratory
                  ? 'border-purple-200 bg-purple-50 hover:border-purple-300'
                  : 'border-slate-100 bg-slate-50/50 hover:border-teal-100'
              }`}
              >
                <span className={`truncate text-[10px] font-black uppercase tracking-[0.15em] ${
                  isRespiratory ? 'text-purple-600' : 'text-slate-400'
                }`} title={item.name}>
                  {item.name}
                </span>
                <span className={`mt-2 text-3xl font-black ${
                  isRespiratory ? 'text-purple-900' : 'text-slate-900'
                }`}
                >
                  {formatCount(item.count)}
                </span>
                <p className="mt-1 text-[10px] font-bold text-slate-500">turnos</p>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-8 text-center text-sm font-medium text-slate-400">
            No hay turnos registrados este mes.
          </div>
        )}
      </div>
    </section>
  );
};

export default InsuranceBreakdownSection;
