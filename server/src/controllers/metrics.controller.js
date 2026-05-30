import {
  addMonths,
  endOfWeek,
  format,
  startOfMonth,
  startOfDay,
  startOfWeek,
  startOfYear,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { getCoverageLabel } from '../utils/coverage.js';
import { createInternalError } from '../errors/AppError.js';

const RESPIRATORY_BUCKET = 'PARTICULAR RESPIRATORIO';
const IU_BUCKET = 'PARTICULAR IU';

const formatMonthLabel = (date) => format(date, 'MMMM yyyy', { locale: es });
const formatChartMonth = (date) => format(date, 'MMM yy', { locale: es }).replace('.', '').toUpperCase();

const buildMonthlyRange = (baseDate) => {
  const start = startOfMonth(baseDate);
  const nextStart = startOfMonth(addMonths(baseDate, 1));

  return { start, nextStart };
};

const buildMonthlySnapshot = async (prisma, baseDate) => {
  const { start, nextStart } = buildMonthlyRange(baseDate);

  const [appointments, completedCount, noShowCount, scheduledCount] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        date: { gte: start, lt: nextStart },
        status: { not: 'CANCELLED' },
      },
      include: {
        patient: {
          select: {
            healthInsurance: true,
            treatAsParticular: true,
            isRespiratory: true,
            isIU: true,
          },
        },
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

  const appointmentCount = appointments.length;

  const insuranceMap = {};
  appointments.forEach((apt) => {
    let insurance = '';
    
    if (apt.patient.isRespiratory) {
      insurance = RESPIRATORY_BUCKET;
    } else if (apt.patient.isIU) {
      insurance = IU_BUCKET;
    } else {
      insurance = getCoverageLabel(apt.patient.healthInsurance, apt.patient.treatAsParticular);
    }

    insurance = insurance.toUpperCase().trim();
    if (!insurance) insurance = 'PARTICULAR';
    insuranceMap[insurance] = (insuranceMap[insurance] || 0) + 1;
  });

  const insuranceBreakdown = Object.entries(insuranceMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

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
    insuranceBreakdown,
    respiratoryCount: appointments.filter((appointment) => appointment.patient.isRespiratory).length,
    iuCount: appointments.filter((appointment) => appointment.patient.isIU).length,
  };
};

const formatFutureMonthLabel = (date) => format(date, 'MMM yy', { locale: es }).replace('.', '').toUpperCase();

const buildFutureAgendaSnapshot = async (prisma, now) => {
  const todayStart = startOfDay(now);

  const [futureAppointments, firstAppointments] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        date: { gte: todayStart },
        status: { not: 'CANCELLED' },
      },
      select: {
        id: true,
        date: true,
        patientId: true,
      },
      orderBy: [
        { date: 'asc' },
        { time: 'asc' },
        { slotNumber: 'asc' },
      ],
    }),
    prisma.appointment.groupBy({
      by: ['patientId'],
      where: {
        status: { not: 'CANCELLED' },
      },
      _min: {
        date: true,
      },
    }),
  ]);

  const farthestAppointment = futureAppointments[futureAppointments.length - 1] || null;
  const futurePatientIds = new Set();
  const coverageMap = new Map();

  futureAppointments.forEach((appointment) => {
    if (appointment.patientId) {
      futurePatientIds.add(appointment.patientId);
    }

    const monthKey = format(appointment.date, 'yyyy-MM');
    const current = coverageMap.get(monthKey) || {
      monthKey,
      month: formatFutureMonthLabel(appointment.date),
      label: format(appointment.date, 'MMMM yyyy', { locale: es }),
      appointmentCount: 0,
      patientIds: new Set(),
    };

    current.appointmentCount += 1;
    if (appointment.patientId) {
      current.patientIds.add(appointment.patientId);
    }
    coverageMap.set(monthKey, current);
  });

  const firstAppointmentByPatient = new Map(
    firstAppointments.map((entry) => [entry.patientId, entry._min?.date || null]),
  );

  let newPatients = 0;
  futurePatientIds.forEach((patientId) => {
    const firstDate = firstAppointmentByPatient.get(patientId);
    if (!firstDate) return;

    const normalizedFirstDate = startOfDay(new Date(firstDate));
    if (normalizedFirstDate >= todayStart) {
      newPatients += 1;
    }
  });

  const coverageByMonth = Array.from(coverageMap.values())
    .map((item) => ({
      monthKey: item.monthKey,
      month: item.month,
      label: item.label,
      appointmentCount: item.appointmentCount,
      patientCount: item.patientIds.size,
    }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  return {
    farthestDate: farthestAppointment?.date || null,
    farthestLabel: farthestAppointment ? format(farthestAppointment.date, "EEEE d 'de' MMMM yyyy", { locale: es }) : null,
    appointmentCount: futureAppointments.length,
    patientCount: futurePatientIds.size,
    activePatients: {
      total: futurePatientIds.size,
      new: newPatients,
      recurrent: Math.max(futurePatientIds.size - newPatients, 0),
    },
    coverageByMonth,
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
    const [weeklyRespiratory, weeklyIU] = await Promise.all([
      prisma.appointment.count({
        where: {
          date: { gte: weekStart, lte: weekEnd },
          status: { not: 'CANCELLED' },
          patient: { isRespiratory: true },
        },
      }),
      prisma.appointment.count({
        where: {
          date: { gte: weekStart, lte: weekEnd },
          status: { not: 'CANCELLED' },
          patient: { isIU: true },
        },
      }),
    ]);
    const weeklyResolved = weeklyCompleted + weeklyNoShow;

    const currentMonthSnapshot = await buildMonthlySnapshot(prisma, now);
    const previousMonthSnapshot = await buildMonthlySnapshot(prisma, subMonths(now, 1));
    const futureAgendaSnapshot = await buildFutureAgendaSnapshot(prisma, now);

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
          insuranceBreakdown: snapshot.insuranceBreakdown,
        };
      }),
    );
    const activeMonthlyTrend = monthlyTrend.filter((item) => item.appointmentCount > 0);

    res.json({
      weekly: {
        total: weeklyTotal,
        scheduled: weeklyScheduled,
        completed: weeklyCompleted,
        noShow: weeklyNoShow,
        resolved: weeklyResolved,
        respiratory: weeklyRespiratory,
        iu: weeklyIU,
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
        insuranceBreakdown: currentMonthSnapshot.insuranceBreakdown,
        respiratory: currentMonthSnapshot.respiratoryCount,
        iu: currentMonthSnapshot.iuCount,
      },
      annual: {
        patientCount: uniquePatients.length,
        appointmentCount: annualAppointmentCount,
        completedCount: annualCompletedCount,
        noShowCount: annualNoShowCount,
      },
      monthlyTrend: activeMonthlyTrend,
      futureAgenda: futureAgendaSnapshot,
    });
  } catch (error) {
    throw createInternalError(error, 'Error al obtener métricas');
  }
};
