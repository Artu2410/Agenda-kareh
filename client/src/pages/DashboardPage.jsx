import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, Calendar, Activity } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '@/services/api';
import toast from 'react-hot-toast';

const DashboardPage = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState('bar'); // 'bar' o 'line'

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/metrics');
        setMetrics(data);
      } catch (err) {
        console.error('Error fetching metrics:', err);
        toast.error('Error al cargar las métricas');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 font-bold text-lg">Cargando métricas...</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 font-bold text-lg">Sin datos disponibles</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto bg-slate-50 flex flex-col">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-100 px-6 sm:px-8 py-6 sm:py-8 no-print sticky top-0 z-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-5xl font-black text-slate-800 uppercase tracking-tighter">
              Panel de Control
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm font-bold uppercase tracking-widest mt-2">
              Métricas y Rendimiento Operacional
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 transition-all text-sm"
            >
              📄 Imprimir
            </button>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 p-6 sm:p-8 overflow-auto custom-scrollbar">
        {/* TARJETAS DE MÉTRICAS CLAVE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mb-8">
          {/* TARJETA SEMANAL */}
          <div className="bg-white border border-slate-100 rounded-[2rem] p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Esta Semana</h2>
              <div className="bg-teal-100 p-3 rounded-full">
                <Calendar size={24} className="text-teal-600" />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">Turno Totales</p>
                <p className="text-4xl sm:text-5xl font-black text-slate-800 leading-none">
                  {metrics.weekly.total}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Programados</p>
                  <p className="text-2xl font-black text-slate-700">{metrics.weekly.scheduled}</p>
                </div>
                <div className="bg-teal-50 p-3 rounded-lg">
                  <p className="text-[10px] text-teal-600 uppercase font-bold">Completados</p>
                  <p className="text-2xl font-black text-teal-700">{metrics.weekly.completed}</p>
                </div>
              </div>
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                <p className="text-[10px] text-teal-700 uppercase font-bold">Tasa de Completitud</p>
                <p className="text-3xl font-black text-teal-600">{metrics.weekly.percentage}%</p>
              </div>
            </div>
          </div>

          {/* TARJETA MENSUAL */}
          <div className="bg-white border border-slate-100 rounded-[2rem] p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Este Mes</h2>
              <div className={`${metrics.monthly.change >= 0 ? 'bg-green-100' : 'bg-red-100'} p-3 rounded-full`}>
                <TrendingUp
                  size={24}
                  className={metrics.monthly.change >= 0 ? 'text-green-600' : 'text-red-600'}
                />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">Turnos Este Mes</p>
                <p className="text-4xl sm:text-5xl font-black text-slate-800 leading-none">
                  {metrics.monthly.current}
                </p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Mes Anterior</p>
                <p className="text-xl font-bold text-slate-700">{metrics.monthly.previous} turnos</p>
              </div>
              <div
                className={`${
                  metrics.monthly.change >= 0
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                } border rounded-lg p-3`}
              >
                <p className={`text-[10px] ${metrics.monthly.change >= 0 ? 'text-green-700' : 'text-red-700'} uppercase font-bold`}>
                  Variación
                </p>
                <p
                  className={`text-3xl font-black ${
                    metrics.monthly.change >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {metrics.monthly.changeLabel}
                </p>
              </div>
            </div>
          </div>

          {/* TARJETA ANUAL */}
          <div className="bg-white border border-slate-100 rounded-[2rem] p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Este Año</h2>
              <div className="bg-slate-100 p-3 rounded-full">
                <Users size={24} className="text-slate-600" />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">Pacientes Únicos</p>
                <p className="text-4xl sm:text-5xl font-black text-slate-800 leading-none">
                  {metrics.annual.patientCount}
                </p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Turnos Totales</p>
                <p className="text-2xl font-bold text-slate-700">{metrics.annual.appointmentCount}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-[10px] text-slate-600 uppercase font-bold">Promedio por Paciente</p>
                <p className="text-2xl font-black text-slate-700">
                  {metrics.annual.patientCount > 0
                    ? (metrics.annual.appointmentCount / metrics.annual.patientCount).toFixed(1)
                    : 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN DE GRÁFICO */}
        <div className="bg-white border border-slate-100 rounded-[2rem] p-6 sm:p-8 shadow-sm">
          {/* ENCABEZADO CON FILTROS */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 pb-6 border-b border-slate-100">
            <div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">
                Evolución de Turnos
              </h2>
              <p className="text-slate-400 text-xs uppercase font-bold tracking-widest mt-1">
                Últimos 12 meses
              </p>
            </div>
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <button
                onClick={() => setChartType('bar')}
                className={`px-4 py-2 rounded-lg font-bold text-sm uppercase transition-all ${
                  chartType === 'bar'
                    ? 'bg-teal-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                📊 Barras
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`px-4 py-2 rounded-lg font-bold text-sm uppercase transition-all ${
                  chartType === 'line'
                    ? 'bg-teal-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                📈 Líneas
              </button>
            </div>
          </div>

          {/* GRÁFICO */}
          <div className="w-full" style={{ height: '400px', minHeight: '300px' }}>
            {chartType === 'bar' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.monthlyTrend} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#699', fontSize: 12, fontWeight: 'bold' }}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis tick={{ fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '8px',
                    }}
                    formatter={(value) => [`${value} turnos`, 'Turnos']}
                  />
                  <Bar dataKey="appointmentCount" fill="#14b8a6" radius={[8, 8, 0, 0]} name="Turnos" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.monthlyTrend} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#699', fontSize: 12, fontWeight: 'bold' }}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis tick={{ fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '8px',
                    }}
                    formatter={(value) => [`${value} turnos`, 'Turnos']}
                  />
                  <Line
                    type="monotone"
                    dataKey="appointmentCount"
                    stroke="#14b8a6"
                    strokeWidth={3}
                    dot={{ fill: '#14b8a6', r: 5 }}
                    activeDot={{ r: 7 }}
                    name="Turnos"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* NOTA DE DATOS */}
          <div className="mt-8 pt-6 border-t border-slate-100 text-center text-xs text-slate-400">
            <p className="font-bold uppercase tracking-widest">
              Datos actualizados en tiempo real • Última sincronización:{' '}
              {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
