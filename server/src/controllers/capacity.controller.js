import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  calculateOperationalCapacity,
  getCapacityForMonth,
  getProfessionalCapacityFromSummary,
  getCapacityForWeek,
  isCalendarDateOperational,
} from '../domain/metrics/capacity.service.js';
import { getHolidaysForDateRange } from '../services/holidayCalendar.service.js';
import { createInternalError } from '../errors/AppError.js';

const COMPLETED_STATUS = 'COMPLETED';
const CANCELLED_STATUS = 'CANCELLED';
const NO_SHOW_STATUS = 'NO_SHOW';
const BUSINESS_START_DATE = new Date(2026, 2, 1);

const formatMonthLabel = (date) => format(date, 'MMMM yyyy', { locale: es });
const formatChartMonth = (date) => format(date, 'MMM yy', { locale: es }).replace('.', '').toUpperCase();

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundOne = (value) => Math.round(toNumber(value) * 10) / 10;

export const getOccupationLevel = (occupancyRate) => {
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

  if (occupancyRate >= 10) {
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

const buildMonthlyTrend = ({
  appointments = [],
  professionals = [],
  agendaConfig,
  calendarEntries = [],
  holidays = [],
  startDate,
  endDate,
}) => {
  const rowsByKey = new Map();
  appointments.forEach((appointment) => {
    const monthKey = format(appointment.date, 'yyyy-MM');
    const current = rowsByKey.get(monthKey) || {
      occupiedCount: 0,
      attendedCount: 0,
    };

    current.occupiedCount += 1;
    if (appointment.status === COMPLETED_STATUS) current.attendedCount += 1;
    rowsByKey.set(monthKey, current);
  });

  const rows = [];
  for (let monthStart = startOfMonth(startDate); monthStart < endDate; monthStart = addMonths(monthStart, 1)) {
    const monthKey = format(monthStart, 'yyyy-MM');
    const monthEnd = addMonths(monthStart, 1);
    const monthlySummary = getCapacityForMonth({
      year: monthStart.getFullYear(),
      month: monthStart.getMonth() + 1,
      professionals,
      agendaConfig,
      calendarEntries,
      holidays,
    });
    const counters = rowsByKey.get(monthKey) || { occupiedCount: 0, attendedCount: 0 };
    const capacity = monthlySummary.effectiveCapacity;

    rows.push({
      monthKey,
      month: formatChartMonth(monthStart),
      label: formatMonthLabel(monthStart),
      capacity: roundOne(capacity),
      effectiveCapacity: roundOne(capacity),
      occupiedCount: counters.occupiedCount,
      attendedCount: counters.attendedCount,
      turns: counters.occupiedCount,
      completedCount: counters.attendedCount,
      completed: counters.attendedCount,
      occupancyRate: capacity > 0 ? roundOne((counters.occupiedCount / capacity) * 100) : 0,
      historicalCapacitySource: 'CURRENT_CONFIGURATION_RECONSTRUCTION',
      historicalCapacityNote: 'No hay snapshots versionados de AgendaConfig ni WorkSchedule; la capacidad histórica fue reconstruida con la configuración actual.',
      monthStart: format(monthStart, 'yyyy-MM-dd'),
      monthEnd: format(addDays(monthEnd, -1), 'yyyy-MM-dd'),
    });
  }

  return rows;
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
    const weekStart = startOfWeek(now);
    const weekEnd = addDays(weekStart, 7);
    const monthStart = startOfMonth(now);
    const monthEnd = addMonths(monthStart, 1);
    const trendStart = BUSINESS_START_DATE < monthStart ? BUSINESS_START_DATE : monthStart;

    const [
      agendaConfig,
      professionals,
      currentMonthAppointments,
      currentWeekAppointments,
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
          status: { not: CANCELLED_STATUS },
        },
        select: {
          id: true,
          date: true,
          status: true,
          patientId: true,
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
          professionalId: true,
        },
        orderBy: [
          { date: 'asc' },
          { time: 'asc' },
          { slotNumber: 'asc' },
        ],
      }),
    ]);

    const calendarEntries = prisma.agendaCalendarEntry?.findMany
      ? await prisma.agendaCalendarEntry.findMany({
        where: {
          date: {
            gte: format(trendStart, 'yyyy-MM-dd'),
            lte: format(addDays(monthEnd, -1), 'yyyy-MM-dd'),
          },
          isActive: true,
        },
        orderBy: [{ date: 'asc' }, { name: 'asc' }],
      })
      : [];
    const lastFutureAppointment = futureAppointments[futureAppointments.length - 1];
    const holidayRangeEnd = lastFutureAppointment?.date && lastFutureAppointment.date > addDays(monthEnd, -1)
      ? lastFutureAppointment.date
      : addDays(monthEnd, -1);
    const holidays = await getHolidaysForDateRange(
      format(trendStart, 'yyyy-MM-dd'),
      format(holidayRangeEnd, 'yyyy-MM-dd'),
      { nationalHolidaysClose: agendaConfig?.nationalHolidaysClose !== false },
    );
    const operationalCapacity = calculateOperationalCapacity({
      professionals,
      agendaConfig,
      appointments: currentMonthAppointments,
      referenceDate: now,
      calendarEntries,
      holidays,
    });
    const weeklyCapacitySummary = getCapacityForWeek({
      startDate: weekStart,
      professionals,
      agendaConfig,
      appointments: currentWeekAppointments,
      calendarEntries,
      holidays,
    });
    const monthlyCapacitySummary = getCapacityForMonth({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      professionals,
      agendaConfig,
      appointments: currentMonthAppointments,
      calendarEntries,
      holidays,
    });
    const weeklyCountersByProfessional = countByProfessional(currentWeekAppointments, professionals);
    const monthlyCountersByProfessional = countByProfessional(currentMonthAppointments, professionals);
    const activePatients = new Set(currentMonthAppointments.map((appointment) => appointment.patientId).filter(Boolean)).size;
    const totalSummary = {
      availableHoursWeekly: operationalCapacity.availableHoursWeekly,
      weeklyCapacity: weeklyCapacitySummary.totalCapacity,
      monthlyCapacity: monthlyCapacitySummary.totalCapacity,
      freeMonthlyCapacity: monthlyCapacitySummary.available,
      occupancyRate: monthlyCapacitySummary.occupancyRate,
      level: getOccupationLevel(monthlyCapacitySummary.occupancyRate),
    };

    const professionalsSummary = professionals.map((professional) => {
      const capacity = operationalCapacity.professionals.find((row) => row.id === professional.id);
      const monthlyCounters = monthlyCountersByProfessional.get(professional.id) || {
        completed: 0,
        total: 0,
        noShow: 0,
        activePatients: new Set(),
      };
      const weeklyCounters = weeklyCountersByProfessional.get(professional.id) || {
        completed: 0,
        total: 0,
        noShow: 0,
        activePatients: new Set(),
      };
      const weeklyCapacity = getProfessionalCapacityFromSummary(weeklyCapacitySummary, professional.id);
      const monthlyCapacity = getProfessionalCapacityFromSummary(monthlyCapacitySummary, professional.id);
      const occupancyRate = monthlyCapacity > 0 ? (monthlyCounters.total / monthlyCapacity) * 100 : 0;
      const weeklyOccupancyRate = weeklyCapacity > 0 ? (weeklyCounters.total / weeklyCapacity) * 100 : 0;

      return {
        id: professional.id,
        fullName: professional.fullName,
        specialty: professional.specialty,
        workSchedule: professional.workSchedule,
        availableHoursWeekly: capacity?.availableHoursWeekly || 0,
        weeklyCapacity,
        monthlyCapacity,
        weeklyCompletedCount: weeklyCounters.completed,
        weeklyOccupiedCount: weeklyCounters.total,
        weeklyOccupancyRate: roundOne(weeklyOccupancyRate),
        completedCount: monthlyCounters.completed,
        occupiedCount: monthlyCounters.total,
        monthlyAppointmentCount: monthlyCounters.total,
        noShowCount: monthlyCounters.noShow,
        activePatientCount: monthlyCounters.activePatients.size,
        freeMonthlyCapacity: roundOne(Math.max(monthlyCapacity - monthlyCounters.total, 0)),
        occupancyRate: roundOne(occupancyRate),
        attendanceRate: monthlyCounters.completed + monthlyCounters.noShow > 0
          ? roundOne((monthlyCounters.completed / (monthlyCounters.completed + monthlyCounters.noShow)) * 100)
          : 0,
        level: getOccupationLevel(occupancyRate),
      };
    });

    const futureOperationalAppointments = futureAppointments.filter((appointment) => (
      isCalendarDateOperational({
        date: appointment.date,
        professionalId: appointment.professionalId,
        calendarEntries,
        agendaConfig,
        holidays,
      })
    ));
    const futureCoverage = buildFutureCoverage(futureOperationalAppointments, now);
    const monthlyTrend = buildMonthlyTrend({
      appointments: historicalAppointments,
      professionals,
      agendaConfig,
      calendarEntries,
      holidays,
      startDate: trendStart,
      endDate: monthEnd,
    });
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
        sessionDurationMinutes: operationalCapacity.sessionDurationMinutes,
        capacityPerSlot: operationalCapacity.capacityPerSlot,
      },
      currentWeek: {
        start: weekStart,
        end: addDays(weekEnd, -1),
        occupiedCount: weeklyCapacitySummary.occupied,
        reservedCount: weeklyCapacitySummary.reservedCount,
        scheduledCount: weeklyCapacitySummary.scheduledCount,
        completedCount: weeklyCapacitySummary.attendedCount,
        noShowCount: weeklyCapacitySummary.noShowCount,
        attendanceRate: roundOne(weeklyCapacitySummary.attendanceRate),
        capacity: weeklyCapacitySummary.totalCapacity,
        theoreticalCapacity: weeklyCapacitySummary.theoreticalCapacity,
        effectiveCapacity: weeklyCapacitySummary.effectiveCapacity,
        availableCapacity: weeklyCapacitySummary.available,
        occupancyRate: roundOne(weeklyCapacitySummary.occupancyRate),
        days: weeklyCapacitySummary.days,
      },
      currentMonth: {
        start: monthStart,
        end: addDays(monthEnd, -1),
        appointmentCount: currentMonthAppointments.length,
        occupiedCount: monthlyCapacitySummary.occupied,
        reservedCount: monthlyCapacitySummary.reservedCount,
        scheduledCount: monthlyCapacitySummary.scheduledCount,
        completedCount: currentMonthAppointments.filter((a) => a.status === COMPLETED_STATUS).length,
        noShowCount: currentMonthAppointments.filter((appointment) => appointment.status === NO_SHOW_STATUS).length,
        attendanceRate: roundOne(monthlyCapacitySummary.attendanceRate),
        activePatients,
        availableHoursWeekly: totalSummary.availableHoursWeekly,
        weeklyCapacity: weeklyCapacitySummary.totalCapacity,
        monthlyCapacity: monthlyCapacitySummary.totalCapacity,
        theoreticalMonthlyCapacity: monthlyCapacitySummary.theoreticalCapacity,
        effectiveMonthlyCapacity: monthlyCapacitySummary.effectiveCapacity,
        freeMonthlyCapacity: monthlyCapacitySummary.available,
        occupancyRate: roundOne(monthlyCapacitySummary.occupancyRate),
        level: totalSummary.level,
        days: monthlyCapacitySummary.days,
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
