import {
  addMonths,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';

const formatMonthLabel = (date) => format(date, 'MMMM yyyy', { locale: es });
const formatChartMonth = (date) => format(date, 'MMM yy', { locale: es }).replace('.', '').toUpperCase();

const buildMonthlyRange = (baseDate) => {
  const start = startOfMonth(baseDate);
  const nextStart = startOfMonth(addMonths(baseDate, 1));

  return { start, nextStart };
};

const buildMonthlySnapshot = async (prisma, baseDate) => {
  const { start, nextStart } = buildMonthlyRange(baseDate);

  const [appointmentCount, completedCount, noShowCount, scheduledCount] = await Promise.all([
    prisma.appointment.count({
      where: {
        date: { gte: start, lt: nextStart },
        status: { not: 'CANCELLED' },
      },
    }),
    prisma.appointment.count({
      where: {
        date: { gte: start, lt: nextStart },
        status: 'COMPLETED',
      },
    }),
    prisma.appointment.count({
      where: {
        date: { gte: start, lt: nextStart },
        status: 'NO_SHOW',
      },
    }),
    prisma.appointment.count({
      where: {
        date: { gte: start, lt: nextStart },
        status: 'SCHEDULED',
      },
    }),
  ]);

  const resolvedCount = completedCount + noShowCount;
  const attendanceRate = resolvedCount > 0
    ? Number(((completedCount / resolvedCount) * 100).toFixed(1))
    : 0;

  return {
    start,
    nextStart,
    appointmentCount,
    completedCount,
    noShowCount,
    scheduledCount,
    resolvedCount,
    attendanceRate,
  };
};

export const getMetrics = async (req, res, prisma) => {
  try {
    const now = new Date();

    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const weeklyAppointments = await prisma.appointment.findMany({
      where: {
        date: { gte: weekStart, lte: weekEnd },
        status: { not: 'CANCELLED' },
      },
      select: { id: true, status: true },
    });

    const weeklyScheduled = weeklyAppointments.filter((appointment) => appointment.status === 'SCHEDULED').length;
    const weeklyCompleted = weeklyAppointments.filter((appointment) => appointment.status === 'COMPLETED').length;
    const weeklyNoShow = weeklyAppointments.filter((appointment) => appointment.status === 'NO_SHOW').length;
    const weeklyTotal = weeklyAppointments.length;
    const weeklyResolved = weeklyCompleted + weeklyNoShow;

    const currentMonthSnapshot = await buildMonthlySnapshot(prisma, now);
    const previousMonthSnapshot = await buildMonthlySnapshot(prisma, subMonths(now, 1));

    const monthlyChange = previousMonthSnapshot.appointmentCount > 0
      ? Number((((currentMonthSnapshot.appointmentCount - previousMonthSnapshot.appointmentCount) / previousMonthSnapshot.appointmentCount) * 100).toFixed(1))
      : (currentMonthSnapshot.appointmentCount > 0 ? 100 : 0);

    const yearStart = startOfYear(now);
    const uniquePatients = await prisma.appointment.groupBy({
      by: ['patientId'],
      where: {
        date: { gte: yearStart },
        status: { not: 'CANCELLED' },
      },
    });

    const [annualAppointmentCount, annualCompletedCount, annualNoShowCount] = await Promise.all([
      prisma.appointment.count({
        where: {
          date: { gte: yearStart },
          status: { not: 'CANCELLED' },
        },
      }),
      prisma.appointment.count({
        where: {
          date: { gte: yearStart },
          status: 'COMPLETED',
        },
      }),
      prisma.appointment.count({
        where: {
          date: { gte: yearStart },
          status: 'NO_SHOW',
        },
      }),
    ]);

    const trendDates = Array.from({ length: 12 }, (_, index) => subMonths(now, 11 - index));
    const monthlyTrend = await Promise.all(
      trendDates.map(async (monthDate) => {
        const snapshot = await buildMonthlySnapshot(prisma, monthDate);

        return {
          monthKey: format(monthDate, 'yyyy-MM'),
          month: formatChartMonth(monthDate),
          label: formatMonthLabel(monthDate),
          appointmentCount: snapshot.appointmentCount,
          completedCount: snapshot.completedCount,
          noShowCount: snapshot.noShowCount,
          scheduledCount: snapshot.scheduledCount,
          resolvedCount: snapshot.resolvedCount,
          attendanceRate: snapshot.attendanceRate,
        };
      }),
    );

    res.json({
      weekly: {
        total: weeklyTotal,
        scheduled: weeklyScheduled,
        completed: weeklyCompleted,
        noShow: weeklyNoShow,
        resolved: weeklyResolved,
        percentage: weeklyTotal > 0 ? Number(((weeklyCompleted / weeklyTotal) * 100).toFixed(1)) : 0,
        attendanceRate: weeklyResolved > 0 ? Number(((weeklyCompleted / weeklyResolved) * 100).toFixed(1)) : 0,
      },
      monthly: {
        current: currentMonthSnapshot.appointmentCount,
        previous: previousMonthSnapshot.appointmentCount,
        scheduled: currentMonthSnapshot.scheduledCount,
        completed: currentMonthSnapshot.completedCount,
        noShow: currentMonthSnapshot.noShowCount,
        resolved: currentMonthSnapshot.resolvedCount,
        attendanceRate: currentMonthSnapshot.attendanceRate,
        change: monthlyChange,
        changeLabel: monthlyChange >= 0 ? `+${monthlyChange}%` : `${monthlyChange}%`,
        label: formatMonthLabel(now),
      },
      annual: {
        patientCount: uniquePatients.length,
        appointmentCount: annualAppointmentCount,
        completedCount: annualCompletedCount,
        noShowCount: annualNoShowCount,
      },
      monthlyTrend,
    });
  } catch (error) {
    console.error('❌ Error en getMetrics:', error);
    res.status(500).json({ message: 'Error al obtener métricas', error: error.message });
  }
};
