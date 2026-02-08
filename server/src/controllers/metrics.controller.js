import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';

export const getMetrics = async (req, res, prisma) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // --- SEMANAL ---
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Lunes
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const weeklyAppointments = await prisma.appointment.findMany({
      where: {
        date: { gte: weekStart, lte: weekEnd },
        status: { not: 'CANCELLED' }
      },
      select: { id: true, status: true }
    });

    const weeklyScheduled = weeklyAppointments.filter(a => a.status === 'SCHEDULED').length;
    const weeklyCompleted = weeklyAppointments.filter(a => a.status !== 'SCHEDULED').length;
    const weeklyTotal = weeklyAppointments.length;

    // --- MENSUAL (este mes vs mes anterior) ---
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    const currentMonthAppointments = await prisma.appointment.count({
      where: {
        date: { gte: monthStart, lte: monthEnd },
        status: { not: 'CANCELLED' }
      }
    });

    const lastMonthAppointments = await prisma.appointment.count({
      where: {
        date: { gte: lastMonthStart, lte: lastMonthEnd },
        status: { not: 'CANCELLED' }
      }
    });

    const monthlyChange = lastMonthAppointments > 0
      ? ((currentMonthAppointments - lastMonthAppointments) / lastMonthAppointments * 100).toFixed(1)
      : (currentMonthAppointments > 0 ? 100 : 0);

    // --- ANUAL (pacientes únicos) ---
    const yearStart = startOfYear(now);
    const yearEnd = endOfYear(now);

    const uniquePatients = await prisma.appointment.groupBy({
      by: ['patientId'],
      where: {
        date: { gte: yearStart, lte: yearEnd },
        status: { not: 'CANCELLED' }
      }
    });

    const annualPatientCount = uniquePatients.length;
    const annualAppointmentCount = await prisma.appointment.count({
      where: {
        date: { gte: yearStart, lte: yearEnd },
        status: { not: 'CANCELLED' }
      }
    });

    // --- GRÁFICO: Evolución mensual (12 meses) ---
    const monthlyData = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const mStart = startOfMonth(monthDate);
      const mEnd = endOfMonth(monthDate);
      const count = await prisma.appointment.count({
        where: {
          date: { gte: mStart, lte: mEnd },
          status: { not: 'CANCELLED' }
        }
      });
      monthlyData.push({
        month: format(monthDate, 'MMM', { locale: es }).toUpperCase(),
        appointmentCount: count,
        label: format(monthDate, 'MMMM yyyy', { locale: es })
      });
    }

    // --- RESPUESTA ---
    res.json({
      weekly: {
        total: weeklyTotal,
        scheduled: weeklyScheduled,
        completed: weeklyCompleted,
        percentage: weeklyTotal > 0 ? ((weeklyCompleted / weeklyTotal) * 100).toFixed(1) : 0
      },
      monthly: {
        current: currentMonthAppointments,
        previous: lastMonthAppointments,
        change: monthlyChange,
        changeLabel: monthlyChange >= 0 ? `+${monthlyChange}%` : `${monthlyChange}%`
      },
      annual: {
        patientCount: annualPatientCount,
        appointmentCount: annualAppointmentCount
      },
      monthlyTrend: monthlyData
    });
  } catch (error) {
    console.error('❌ Error en getMetrics:', error);
    res.status(500).json({ message: 'Error al obtener métricas', error: error.message });
  }
};
