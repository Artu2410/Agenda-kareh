import {
  addDays,
  addMonths,
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
  getCapacityForDate,
  isCalendarDateOperational,
} from '../domain/metrics/capacity.service.js';
import { getHolidaysForDateRange } from '../services/holidayCalendar.service.js';
import { createInternalError } from '../errors/AppError.js';
import {
  DEFINITIONS,
  THRESHOLDS,
  buildAdminAssessment,
  buildBottleneck,
  buildFutureAgenda,
  buildKinesiologistAssessment,
  buildPatientBreakdown,
  buildPeriodBreakdown,
  buildSlotSaturation,
  buildWeeklySaturation,
  getOperationalStatus,
  getSustainedGrowth,
} from '../domain/metrics/operationalAnalysis.js';

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

const buildMonthlyTrend = ({
  appointments = [],
  professionals = [],
  agendaConfig,
  calendarEntries = [],
  holidays = [],
  startDate,
  endDate,
  now,
}) => {
  const rowsByKey = new Map();
  appointments.forEach((appointment) => {
    if (appointment.status === CANCELLED_STATUS) return;
    const monthKey = format(appointment.date, 'yyyy-MM');
    const current = rowsByKey.get(monthKey) || { occupiedCount: 0, attendedCount: 0, noShowCount: 0 };

    current.occupiedCount += 1;
    if (appointment.status === COMPLETED_STATUS) current.attendedCount += 1;
    if (appointment.status === NO_SHOW_STATUS) current.noShowCount += 1;
    rowsByKey.set(monthKey, current);
  });

  const currentMonthKey = format(now, 'yyyy-MM');
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
    const counters = rowsByKey.get(monthKey) || { occupiedCount: 0, attendedCount: 0, noShowCount: 0 };
    const capacity = monthlySummary.effectiveCapacity;
    const isCurrentMonth = monthKey === currentMonthKey;

    rows.push({
      monthKey,
      month: formatChartMonth(monthStart),
      label: isCurrentMonth ? `${formatMonthLabel(monthStart)} (en curso)` : formatMonthLabel(monthStart),
      capacity: roundOne(capacity),
      effectiveCapacity: roundOne(capacity),
      occupiedCount: counters.occupiedCount,
      attendedCount: counters.attendedCount,
      noShowCount: counters.noShowCount,
      turns: counters.occupiedCount,
      completedCount: counters.attendedCount,
      completed: counters.attendedCount,
      occupancyRate: capacity > 0 ? roundOne((counters.occupiedCount / capacity) * 100) : 0,
      isCurrentMonth,
      isClosed: !isCurrentMonth,
      asOf: isCurrentMonth ? format(now, 'yyyy-MM-dd') : null,
      capacityIsEstimated: true,
      historicalCapacitySource: 'CURRENT_CONFIGURATION_RECONSTRUCTION',
      historicalCapacityNote: DEFINITIONS.historicalCapacity,
      monthStart: format(monthStart, 'yyyy-MM-dd'),
      monthEnd: format(addDays(monthEnd, -1), 'yyyy-MM-dd'),
    });
  }

  return rows;
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
      allMonthAppointments,
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
        },
        select: {
          id: true,
          date: true,
          time: true,
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
          time: true,
          status: true,
          patientId: true,
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
          time: true,
          status: true,
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

    // Cancelados se informan en la conciliación pero nunca consumen capacidad.
    const currentMonthAppointments = allMonthAppointments.filter(
      (appointment) => appointment.status !== CANCELLED_STATUS,
    );
    const futureWindowEnd = addDays(todayStart, THRESHOLDS.futureWindowDays);
    const lastFutureAppointment = futureAppointments[futureAppointments.length - 1];
    const calendarRangeEnd = [
      addDays(monthEnd, -1),
      addDays(futureWindowEnd, -1),
      lastFutureAppointment?.date,
    ].filter(Boolean).reduce((max, date) => (date > max ? date : max));

    const calendarEntries = prisma.agendaCalendarEntry?.findMany
      ? await prisma.agendaCalendarEntry.findMany({
        where: {
          date: {
            gte: format(trendStart, 'yyyy-MM-dd'),
            lte: format(calendarRangeEnd, 'yyyy-MM-dd'),
          },
          isActive: true,
        },
        orderBy: [{ date: 'asc' }, { name: 'asc' }],
      })
      : [];
    const holidays = await getHolidaysForDateRange(
      format(trendStart, 'yyyy-MM-dd'),
      format(calendarRangeEnd, 'yyyy-MM-dd'),
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

    const capacityOptions = {
      professionals, agendaConfig, calendarEntries, holidays,
    };
    const futureOperationalAppointments = futureAppointments.filter((appointment) => (
      isCalendarDateOperational({
        date: appointment.date,
        professionalId: appointment.professionalId,
        calendarEntries,
        agendaConfig,
        holidays,
      })
    ));
    const futureAgenda = buildFutureAgenda({
      futureAppointments: futureOperationalAppointments,
      now,
      getDayCapacity: (date) => getCapacityForDate({ date, ...capacityOptions }).capacity,
    });
    const futureCoverage = {
      ...futureAgenda,
      // Alias de compatibilidad: siempre son días calendario, no días con turnos.
      farthestDate: futureAgenda.lastAppointmentDate,
      daysCovered: futureAgenda.calendarDaysToLastAppointment,
      weeksCovered: futureAgenda.calendarWeeksToLastAppointment,
      coverageByMonth: buildCoverageByMonth(futureOperationalAppointments),
    };

    const firstAppointment = historicalAppointments.reduce(
      (min, appointment) => (!min || appointment.date < min ? appointment.date : min),
      null,
    );
    const effectiveTrendStart = firstAppointment && startOfMonth(firstAppointment) > trendStart
      ? startOfMonth(firstAppointment)
      : trendStart;
    const monthlyTrend = buildMonthlyTrend({
      appointments: historicalAppointments,
      professionals,
      agendaConfig,
      calendarEntries,
      holidays,
      startDate: effectiveTrendStart,
      endDate: monthEnd,
      now,
    });
    const sustainedGrowth = getSustainedGrowth(monthlyTrend.filter((row) => row.isClosed));

    const breakdown = buildPeriodBreakdown({
      appointments: allMonthAppointments,
      capacity: monthlyCapacitySummary.totalCapacity,
      now,
    });
    const patients = buildPatientBreakdown({
      monthAppointments: currentMonthAppointments,
      futureAppointments: futureOperationalAppointments,
      historicalAppointments,
      monthStart,
    });
    const activePatients = patients.active;

    const saturationDays = [];
    for (let day = addDays(todayStart, -7 * THRESHOLDS.saturationWindowWeeks); day < todayStart; day = addDays(day, 1)) {
      saturationDays.push(getCapacityForDate({ date: day, ...capacityOptions }));
    }
    const saturation = buildSlotSaturation({
      days: saturationDays,
      appointments: historicalAppointments,
      professionals,
      slotDuration: operationalCapacity.sessionDurationMinutes,
      capacityPerSlot: operationalCapacity.capacityPerSlot,
    });

    const appointmentsById = new Map();
    [...historicalAppointments, ...futureAppointments].forEach((appointment) => {
      appointmentsById.set(appointment.id, appointment);
    });
    const weeklySaturation = buildWeeklySaturation({
      now,
      getWeekDays: (weekStartDate) => Array.from({ length: 7 }, (_, index) => (
        getCapacityForDate({ date: addDays(weekStartDate, index), ...capacityOptions })
      )),
      appointments: [...appointmentsById.values()],
      professionals,
      slotDuration: operationalCapacity.sessionDurationMinutes,
      capacityPerSlot: operationalCapacity.capacityPerSlot,
    });

    const adminRecommendation = buildAdminAssessment({ breakdown, patients });
    const kinesiologistRecommendation = buildKinesiologistAssessment({
      occupancyRate: breakdown.occupancyRate,
      futureOccupancyRate: futureAgenda.window.occupancyRate,
      sustainedGrowth,
      saturation,
    });
    const operationalStatus = getOperationalStatus({
      capacity: breakdown.capacity,
      occupancyRate: breakdown.occupancyRate,
      unclosedRate: breakdown.unclosedRate,
      saturation,
      sustainedGrowth,
    });
    const bottleneck = buildBottleneck({
      capacity: breakdown.capacity,
      occupancyRate: breakdown.occupancyRate,
      saturation,
    });
    const weekClosures = weeklyCapacitySummary.days
      .filter((day) => day.theoreticalCapacity > 0 && day.capacity < day.theoreticalCapacity)
      .map((day) => ({
        date: day.date,
        lostCapacity: day.theoreticalCapacity - day.capacity,
        reasons: (day.closureReasons || []).map((reason) => reason.name).filter(Boolean),
      }));

    res.status(200).json({
      referenceDate: now,
      generatedAt: now,
      definitions: DEFINITIONS,
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
        standardCapacity: weeklyCapacitySummary.theoreticalCapacity,
        effectiveCapacity: weeklyCapacitySummary.effectiveCapacity,
        availableCapacity: weeklyCapacitySummary.available,
        occupancyRate: roundOne(weeklyCapacitySummary.occupancyRate),
        closures: weekClosures,
        days: weeklyCapacitySummary.days,
      },
      currentMonth: {
        start: monthStart,
        end: addDays(monthEnd, -1),
        isPartial: true,
        asOf: breakdown.asOf,
        appointmentCount: currentMonthAppointments.length,
        occupiedCount: breakdown.reserved,
        reservedCount: breakdown.reserved,
        scheduledCount: monthlyCapacitySummary.scheduledCount,
        completedCount: breakdown.attended,
        noShowCount: breakdown.noShow,
        attendanceRate: breakdown.attendanceRate ?? 0,
        activePatients,
        patients,
        breakdown,
        availableHoursWeekly: operationalCapacity.availableHoursWeekly,
        weeklyCapacity: weeklyCapacitySummary.totalCapacity,
        standardWeeklyCapacity: weeklyCapacitySummary.theoreticalCapacity,
        monthlyCapacity: monthlyCapacitySummary.totalCapacity,
        theoreticalMonthlyCapacity: monthlyCapacitySummary.theoreticalCapacity,
        effectiveMonthlyCapacity: monthlyCapacitySummary.effectiveCapacity,
        freeMonthlyCapacity: breakdown.free,
        occupancyRate: breakdown.occupancyRate,
        level: getOccupationLevel(breakdown.occupancyRate),
        days: monthlyCapacitySummary.days,
      },
      operationalStatus,
      saturation,
      weeklySaturation,
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
