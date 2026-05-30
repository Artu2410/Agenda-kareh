import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import FutureAgendaSection from '../components/dashboard/FutureAgendaSection';
import InsuranceBreakdownSection from '../components/dashboard/InsuranceBreakdownSection';
import MonthlyRecordsSection from '../components/dashboard/MonthlyRecordsSection';
import MonthlyTrendSection from '../components/dashboard/MonthlyTrendSection';
import OverviewSection from '../components/dashboard/OverviewSection';
import api from '../services/api';

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
  const futureAgenda = metrics?.futureAgenda || null;

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
        <DashboardHeader />
        <OverviewSection metrics={metrics} />
        <FutureAgendaSection futureAgenda={futureAgenda} />
        <MonthlyTrendSection
          chartData={chartData}
          chartType={chartType}
          currentMonthRow={currentMonthRow}
          onChartTypeChange={setChartType}
        />
        <InsuranceBreakdownSection monthly={metrics.monthly} />
        <MonthlyRecordsSection monthlyRows={monthlyRows} />
      </div>
    </div>
  );
};

export default DashboardPage;
