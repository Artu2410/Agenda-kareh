import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, Calendar } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api'; // CAMBIO: Ruta relativa consistente
import toast from 'react-hot-toast';

const DashboardPage = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState('bar');

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/metrics'); // Llama a /api/metrics
        setMetrics(data);
      } catch (err) {
        toast.error('Error al cargar métricas');
      } finally { setLoading(false); }
    };
    fetchMetrics();
  }, []);

  if (loading) return <div className="flex h-full items-center justify-center font-bold">Cargando métricas...</div>;
  if (!metrics) return <div className="flex h-full items-center justify-center font-bold">Sin datos</div>;

  return (
    <div className="w-full h-full overflow-auto bg-slate-50 p-6 sm:p-8 flex flex-col gap-8">
      <header className="sticky top-0 bg-slate-50 z-10 pb-4">
        <h1 className="text-4xl font-black text-slate-800 uppercase tracking-tighter">Panel de Control</h1>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Métricas Operacionales</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* SEMANAL */}
        <div className="bg-white p-8 rounded-[2rem] border shadow-sm">
          <div className="flex justify-between mb-6">
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Esta Semana</h2>
            <div className="bg-teal-100 p-2 rounded-full"><Calendar className="text-teal-600" /></div>
          </div>
          <p className="text-5xl font-black text-slate-800">{metrics.weekly?.total || 0}</p>
          <div className="mt-4 bg-teal-50 p-3 rounded-lg border border-teal-200">
            <p className="text-[10px] text-teal-700 font-bold uppercase">Completitud</p>
            <p className="text-2xl font-black text-teal-600">{metrics.weekly?.percentage || 0}%</p>
          </div>
        </div>

        {/* MENSUAL */}
        <div className="bg-white p-8 rounded-[2rem] border shadow-sm">
          <div className="flex justify-between mb-6">
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Este Mes</h2>
            <div className="bg-green-100 p-2 rounded-full"><TrendingUp className="text-green-600" /></div>
          </div>
          <p className="text-5xl font-black text-slate-800">{metrics.monthly?.current || 0}</p>
          <div className={`mt-4 p-3 rounded-lg border ${metrics.monthly?.change >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50'}`}>
            <p className="text-[10px] font-bold uppercase">Variación</p>
            <p className="text-2xl font-black">{metrics.monthly?.changeLabel || '0%'}</p>
          </div>
        </div>

        {/* ANUAL */}
        <div className="bg-white p-8 rounded-[2rem] border shadow-sm">
          <div className="flex justify-between mb-6">
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Global</h2>
            <div className="bg-slate-100 p-2 rounded-full"><Users className="text-slate-600" /></div>
          </div>
          <p className="text-5xl font-black text-slate-800">{metrics.annual?.patientCount || 0}</p>
          <p className="text-xs font-bold text-slate-400 uppercase mt-4">Pacientes registrados</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] border shadow-sm flex-1">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-black uppercase tracking-tighter">Evolución</h2>
          <div className="flex gap-2">
            <button onClick={() => setChartType('bar')} className={`px-4 py-1 rounded-lg text-xs font-bold ${chartType === 'bar' ? 'bg-teal-600 text-white' : 'bg-slate-100'}`}>BARRAS</button>
            <button onClick={() => setChartType('line')} className={`px-4 py-1 rounded-lg text-xs font-bold ${chartType === 'line' ? 'bg-teal-600 text-white' : 'bg-slate-100'}`}>LINEAS</button>
          </div>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer>
            {chartType === 'bar' ? (
              <BarChart data={metrics.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{fontSize: 12, fontWeight: 'bold'}} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="appointmentCount" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={metrics.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="appointmentCount" stroke="#14b8a6" strokeWidth={3} dot={{r: 6}} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;