import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { createInternalError } from '../errors/AppError.js';

const MONTHLY_WEEK_FACTOR = 4.33;
const COMPLETED_STATUS = 'COMPLETED';
const CANCELLED_STATUS = 'CANCELLED';
const NO_SHOW_STATUS = 'NO_SHOW';

const DEFAULT_AGENDA_CONFIG = {
  slotDuration: 30,
  timerDurationMinutes: 25,
  capacityPerSlot: 1,
};

const formatMonthLabel = (date) => format(date, 'MMMM yyyy', { locale: es });
const formatChartMonth = (date) => format(date, 'MMM yy', { locale: es }).replace('.', '').toUpperCase();

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundOne = (value) => Math.round(toNumber(value) * 10) / 10;
const roundTwo = (value) => Math.round(toNumber(value) * 100) / 100;

const parseTimeToMinutes = (value) => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
};

const getScheduleMinutes = (schedule = []) => (
  schedule.reduce((sum, item) => {
    const start = parseTimeToMinutes(item.startTime);
    const end = parseTimeToMinutes(item.endTime);
    if (start === null || end === null || end <= start) return sum;
    return sum + (end - start);
  }, 0)
);

const getOccupationLevel = (occupancyRate) => {
  if (occupancyRate > 95) {
    return {
      key: 'OPERATIVE_RISK',
      label: 'Riesgo operativo',
      tone: 'critical',
      description: 'La agenda opera casi sin margen de absorción.',
    };
  }

  if (occupancyRate > 85) {
    return {
      key: 'SATURATION',
      label: 'Saturación',
      tone: 'danger',
      description: 'La capacidad clínica empieza a ser el principal límite.',
    };
  }

  if (occupancyRate >= 70) {
    return {
      key: 'HIGH',
      label: 'Alta ocupación',
      tone: 'warning',
      description: 'El crecimiento es fuerte y requiere seguimiento semanal.',
    };
  }

  if (occupancyRate >= 50) {
    return {
      key: 'HEALTHY',
      label: 'Saludable',
      tone: 'success',
      description: 'Hay uso razonable de capacidad con margen para crecer.',
    };
  }

  return {
    key: 'UNDERUSED',
    label: 'Infrautilizado',
    tone: 'neutral',
    description: 'Hay capacidad disponible para captar más demanda.',
  };
};

const buildCapacitySummary = (availableMinutes, sessionDurationMinutes, occupiedCount) => {
  const weeklyCapacity = sessionDurationMinutes > 0
    ? (availableMinutes / sessionDurationMinutes)
    : 0;
  const monthlyCapacity = weeklyCapacity * MONTHLY_WEEK_FACTOR;
  const occupancyRate = monthlyCapacity > 0
    ? (occupiedCount / monthlyCapacity) * 100
    : 0;

  return {
    availableHoursWeekly: roundTwo(availableMinutes / 60),
    weeklyCapacity: roundOne(weeklyCapacity),
    monthlyCapacity: roundOne(monthlyCapacity),
    completedCount: occupiedCount, // keeping name for backwards compatibility
    freeMonthlyCapacity: roundOne(Math.max(monthlyCapacity - occupiedCount, 0)),
    occupancyRate: roundOne(occupancyRate),
    level: getOccupationLevel(occupancyRate),
  };
};

const countByProfessional = (appointments = [], professionals = []) => {
  const counters = new Map(professionals.map((professional) => [professional.id, {
    completed: 0,
    total: 0,
    noShow: 0,
    activePatients: new Set(),
  }]));

  appointments.forEach((appointment) => {
    const current = counters.get(appointment.professionalId);
    if (!current) return;

    current.total += 1;
    if (appointment.status === COMPLETED_STATUS) current.completed += 1;
    if (appointment.status === NO_SHOW_STATUS) current.noShow += 1;
    if (appointment.patientId) current.activePatients.add(appointment.patientId);
  });

  return counters;
};

const buildCoverageByMonth = (futureAppointments = []) => {
  const coverageMap = new Map();

  futureAppointments.forEach((appointment) => {
    const monthKey = format(appointment.date, 'yyyy-MM');
    const current = coverageMap.get(monthKey) || {
      monthKey,
      month: formatChartMonth(appointment.date),
      label: formatMonthLabel(appointment.date),
      appointmentCount: 0,
      patientIds: new Set(),
    };

    current.appointmentCount += 1;
    if (appointment.patientId) current.patientIds.add(appointment.patientId);
    coverageMap.set(monthKey, current);
  });

  return Array.from(coverageMap.values())
    .map((row) => ({
      monthKey: row.monthKey,
      month: row.month,
      label: row.label,
      appointmentCount: row.appointmentCount,
      patientCount: row.patientIds.size,
    }))
    .sort((left, right) => left.monthKey.localeCompare(right.monthKey));
};

const buildFutureCoverage = (futureAppointments, now) => {
  const farthestAppointment = futureAppointments[futureAppointments.length - 1] || null;
  const farthestDate = farthestAppointment?.date || null;
  const daysCovered = farthestDate
    ? Math.max(0, differenceInCalendarDays(farthestDate, startOfDay(now)))
    : 0;
  const patientIds = new Set(futureAppointments.map((appointment) => appointment.patientId).filter(Boolean));

  return {
    farthestDate,
    farthestLabel: farthestDate ? format(farthestDate, "EEEE d 'de' MMMM yyyy", { locale: es }) : null,
    appointmentCount: futureAppointments.length,
    patientCount: patientIds.size,
    daysCovered,
    weeksCovered: roundOne(daysCovered / 7),
    monthsCovered: roundOne(daysCovered / 30.44),
    reaches30: daysCovered >= 30,
    reaches60: daysCovered >= 60,
    reaches90: daysCovered >= 90,
    coverageByMonth: buildCoverageByMonth(futureAppointments),
  };
};

const buildMonthlyTrend = (appointments, monthlyCapacity) => {
  const rowsByKey = new Map();

  appointments.forEach((appointment) => {
    if (appointment.status === CANCELLED_STATUS) return;

    const monthKey = format(appointment.date, 'yyyy-MM');
    const current = rowsByKey.get(monthKey) || {
      monthKey,
      month: formatChartMonth(appointment.date),
      label: formatMonthLabel(appointment.date),
      capacity: roundOne(monthlyCapacity),
      turns: 0,
      completedCount: 0,
      completed: 0,
      occupancyRate: 0,
    };

    current.turns += 1;
    if (appointment.status === COMPLETED_STATUS) current.completedCount += 1;
    rowsByKey.set(monthKey, current);
  });

  return Array.from(rowsByKey.values())
    .sort((left, right) => left.monthKey.localeCompare(right.monthKey))
    .map((row) => ({
      ...row,
      completed: row.completedCount,
      occupancyRate: row.capacity > 0 ? roundOne((row.completedCount / row.capacity) * 100) : 0,
    }));
};

const getSustainedGrowth = (monthlyTrend) => {
  const lastRows = monthlyTrend.slice(-3);
  if (lastRows.length < 3 || lastRows.some((row) => row.completedCount <= 0)) return false;

  return lastRows[0].completedCount <= lastRows[1].completedCount
    && lastRows[1].completedCount <= lastRows[2].completedCount
    && lastRows[2].completedCount > lastRows[0].completedCount;
};

const buildAdminRecommendation = ({
  monthlyAppointmentCount,
  activePatients,
  occupancyRate,
}) => {
  const criteria = [
    {
      key: 'monthly_appointments',
      label: 'Más de 120 turnos mensuales',
      met: monthlyAppointmentCount > 120,
      value: monthlyAppointmentCount,
      measured: true,
    },
    {
      key: 'active_patients',
      label: 'Más de 15 pacientes activos',
      met: activePatients > 15,
      value: activePatients,
      measured: true,
    },
    {
      key: 'occupancy',
      label: 'Más de 60% de ocupación',
      met: occupancyRate > 60,
      value: roundOne(occupancyRate),
      measured: true,
    },
  ];
  const metCount = criteria.filter((criterion) => criterion.met).length;

  return {
    recommended: metCount >= 2,
    metCount,
    requiredCount: 2,
    label: metCount >= 2 ? 'Administrativo recomendado' : 'Administrativo en observación',
    criteria,
  };
};

const buildKinesiologistRecommendation = ({
  occupancyRate,
  coverageDays,
  sustainedGrowth,
}) => {
  const criteria = [
    {
      key: 'occupancy',
      label: 'Ocupación mayor a 85%',
      met: occupancyRate > 85,
      value: roundOne(occupancyRate),
      measured: true,
    },
    {
      key: 'coverage',
      label: 'Agenda llena más de 60 días',
      met: coverageDays > 60,
      value: coverageDays,
      measured: true,
    },
    {
      key: 'growth',
      label: 'Crecimiento sostenido 3 meses',
      met: sustainedGrowth,
      value: sustainedGrowth ? 'Sí' : 'No',
      measured: true,
    },
  ];
  const metCount = criteria.filter((criterion) => criterion.met).length;

  return {
    recommended: metCount >= 3,
    metCount,
    requiredCount: 3,
    label: metCount >= 3 ? 'Segundo kinesiólogo recomendado' : 'Segundo kinesiólogo en observación',
    criteria,
  };
};

const buildBottleneckDiagnosis = ({
  totalCapacity,
  occupancyRate,
  coverageDays,
  activePatients,
  adminRecommendation,
  professionals,
}) => {
  if (totalCapacity <= 0) {
    return {
      key: 'CONFIGURATION',
      label: 'Falta configuración operativa',
      description: 'No hay capacidad calculable porque faltan horarios profesionales o duración de sesión.',
    };
  }

  const topProfessional = [...professionals]
    .sort((left, right) => right.completedCount - left.completedCount)[0] || null;

  if (occupancyRate > 85) {
    return {
      key: 'CLINICAL_CAPACITY',
      label: 'Falta capacidad clínica',
      description: topProfessional
        ? `El cuello de botella principal es la capacidad clínica de ${topProfessional.fullName}.`
        : 'El cuello de botella principal es la capacidad clínica disponible.',
    };
  }

  if (adminRecommendation.recommended) {
    return {
      key: 'ADMINISTRATION',
      label: 'Falta administración',
      description: 'La carga operativa ya justifica liberar tiempo administrativo para proteger producción clínica.',
    };
  }

  if (occupancyRate < 50 && activePatients <= 15 && coverageDays < 30) {
    return {
      key: 'DEMAND',
      label: 'Falta demanda',
      description: 'La capacidad disponible supera claramente el volumen actual de turnos y cobertura futura.',
    };
  }

  if (occupancyRate >= 70 && coverageDays >= 45) {
    return {
      key: 'NEAR_CLINICAL_CAPACITY',
      label: 'Capacidad clínica próxima',
      description: 'Todavía hay margen, pero la agenda futura y la ocupación indican presión creciente.',
    };
  }

  return {
    key: 'NO_CRITICAL_BOTTLENECK',
    label: 'Sin cuello crítico visible',
    description: 'La operación tiene margen y no muestra una restricción dominante con los datos actuales.',
  };
};

export const getCapacityMetrics = async (req, res, prisma) => {
  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 7);
    const monthStart = startOfMonth(now);
    const monthEnd = addMonths(monthStart, 1);
    const trendStart = startOfMonth(subMonths(now, 11));

    const [
      agendaConfig,
      professionals,
      currentMonthAppointments,
      currentWeekCompletedAppointments,
      historicalAppointments,
      futureAppointments,
    ] = await Promise.all([
      prisma.agendaConfig.findFirst(),
      prisma.professional.findMany({
        where: {
          isActive: true,
          isArchived: false,
        },
        orderBy: { fullName: 'asc' },
        include: {
          workSchedule: {
            orderBy: { dayOfWeek: 'asc' },
          },
        },
      }),
      prisma.appointment.findMany({
        where: {
          date: { gte: monthStart, lt: monthEnd },
          status: { not: CANCELLED_STATUS },
        },
        select: {
          id: true,
          date: true,
          status: true,
          patientId: true,
          professionalId: true,
          authorizationStatus: true,
        },
      }),
      prisma.appointment.findMany({
        where: {
          date: { gte: weekStart, lt: weekEnd },
          status: COMPLETED_STATUS,
        },
        select: {
          id: true,
          professionalId: true,
        },
      }),
      prisma.appointment.findMany({
        where: {
          date: { gte: trendStart, lt: monthEnd },
          status: { not: CANCELLED_STATUS },
        },
        select: {
          id: true,
          date: true,
          status: true,
        },
      }),
      prisma.appointment.findMany({
        where: {
          date: { gte: todayStart },
          status: { not: CANCELLED_STATUS },
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
    ]);

    const config = agendaConfig || DEFAULT_AGENDA_CONFIG;
    const sessionDurationMinutes = Math.max(1, Number(config.slotDuration || config.timerDurationMinutes || 30));
    const weeklyCompletedByProfessional = currentWeekCompletedAppointments.reduce((accumulator, appointment) => {
      accumulator.set(appointment.professionalId, (accumulator.get(appointment.professionalId) || 0) + 1);
      return accumulator;
    }, new Map());
    const monthlyCountersByProfessional = countByProfessional(currentMonthAppointments, professionals);
    const totalAvailableMinutes = professionals.reduce(
      (sum, professional) => sum + getScheduleMinutes(professional.workSchedule),
      0
    );
    const activePatients = new Set(currentMonthAppointments.map((appointment) => appointment.patientId).filter(Boolean)).size;
    const validCurrentMonth = currentMonthAppointments.length;
    const totalSummary = buildCapacitySummary(totalAvailableMinutes, sessionDurationMinutes, validCurrentMonth);

    const professionalsSummary = professionals.map((professional) => {
      const availableMinutes = getScheduleMinutes(professional.workSchedule);
      const monthlyCounters = monthlyCountersByProfessional.get(professional.id) || {
        completed: 0,
        total: 0,
        noShow: 0,
        activePatients: new Set(),
      };
      const summary = buildCapacitySummary(availableMinutes, sessionDurationMinutes, monthlyCounters.total);
      const weeklyCapacity = sessionDurationMinutes > 0 ? (availableMinutes / sessionDurationMinutes) : 0;
      const weeklyCompleted = weeklyCompletedByProfessional.get(professional.id) || 0;
      const weeklyOccupancyRate = weeklyCapacity > 0 ? (weeklyCompleted / weeklyCapacity) * 100 : 0;

      return {
        id: professional.id,
        fullName: professional.fullName,
        specialty: professional.specialty,
        workSchedule: professional.workSchedule,
        availableHoursWeekly: summary.availableHoursWeekly,
        weeklyCapacity: summary.weeklyCapacity,
        monthlyCapacity: summary.monthlyCapacity,
        weeklyCompletedCount: weeklyCompleted,
        weeklyOccupancyRate: roundOne(weeklyOccupancyRate),
        completedCount: summary.completedCount,
        monthlyAppointmentCount: monthlyCounters.total,
        noShowCount: monthlyCounters.noShow,
        activePatientCount: monthlyCounters.activePatients.size,
        freeMonthlyCapacity: summary.freeMonthlyCapacity,
        occupancyRate: summary.occupancyRate,
        level: summary.level,
      };
    });

    const futureCoverage = buildFutureCoverage(futureAppointments, now);
    const monthlyTrend = buildMonthlyTrend(historicalAppointments, totalSummary.monthlyCapacity);
    const sustainedGrowth = getSustainedGrowth(monthlyTrend);

    const adminRecommendation = buildAdminRecommendation({
      monthlyAppointmentCount: currentMonthAppointments.length,
      activePatients,
      occupancyRate: totalSummary.occupancyRate,
    });
    const kinesiologistRecommendation = buildKinesiologistRecommendation({
      occupancyRate: totalSummary.occupancyRate,
      coverageDays: futureCoverage.daysCovered,
      sustainedGrowth,
    });
    const bottleneck = buildBottleneckDiagnosis({
      totalCapacity: totalSummary.monthlyCapacity,
      occupancyRate: totalSummary.occupancyRate,
      coverageDays: futureCoverage.daysCovered,
      activePatients,
      adminRecommendation,
      professionals: professionalsSummary,
    });

    res.status(200).json({
      referenceDate: now,
      config: {
        sessionDurationMinutes,
        monthlyWeekFactor: MONTHLY_WEEK_FACTOR,
      },
      currentWeek: {
        start: weekStart,
        end: addDays(weekEnd, -1),
        completedCount: currentWeekCompletedAppointments.length,
        capacity: roundOne(totalAvailableMinutes / sessionDurationMinutes),
        occupancyRate: totalAvailableMinutes > 0
          ? roundOne((currentWeekCompletedAppointments.length / (totalAvailableMinutes / sessionDurationMinutes)) * 100)
          : 0,
      },
      currentMonth: {
        start: monthStart,
        end: addDays(monthEnd, -1),
        appointmentCount: currentMonthAppointments.length,
        completedCount: currentMonthAppointments.filter((a) => a.status === COMPLETED_STATUS).length,
        noShowCount: currentMonthAppointments.filter((appointment) => appointment.status === NO_SHOW_STATUS).length,
        activePatients,
        availableHoursWeekly: totalSummary.availableHoursWeekly,
        weeklyCapacity: totalSummary.weeklyCapacity,
        monthlyCapacity: totalSummary.monthlyCapacity,
        freeMonthlyCapacity: totalSummary.freeMonthlyCapacity,
        occupancyRate: totalSummary.occupancyRate,
        level: totalSummary.level,
      },
      professionals: professionalsSummary,
      futureCoverage,
      monthlyTrend,
      alerts: {
        admin: adminRecommendation,
        kinesiologist: kinesiologistRecommendation,
      },
      bottleneck,
    });
  } catch (error) {
    throw createInternalError(error, 'Error al obtener capacidad operativa');
  }
};
