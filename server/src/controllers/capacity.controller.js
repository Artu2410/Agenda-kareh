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

const buildCapacitySummary = (availableMinutes, sessionDurationMinutes, completedCount) => {
  const weeklyCapacity = sessionDurationMinutes > 0
    ? availableMinutes / sessionDurationMinutes
    : 0;
  const monthlyCapacity = weeklyCapacity * MONTHLY_WEEK_FACTOR;
  const occupancyRate = monthlyCapacity > 0
    ? (completedCount / monthlyCapacity) * 100
    : 0;

  return {
    availableHoursWeekly: roundTwo(availableMinutes / 60),
    weeklyCapacity: roundOne(weeklyCapacity),
    monthlyCapacity: roundOne(monthlyCapacity),
    completedCount,
    freeMonthlyCapacity: roundOne(Math.max(monthlyCapacity - completedCount, 0)),
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

const buildMonthlyTrend = (appointments, monthlyCapacity, now) => {
  const monthDates = Array.from({ length: 12 }, (_, index) => startOfMonth(subMonths(now, 11 - index)));
  const rows = monthDates.map((monthDate) => ({
    monthKey: format(monthDate, 'yyyy-MM'),
    month: formatChartMonth(monthDate),
    label: formatMonthLabel(monthDate),
    capacity: roundOne(monthlyCapacity),
    completedCount: 0,
    occupancyRate: 0,
  }));
  const rowsByKey = new Map(rows.map((row) => [row.monthKey, row]));

  appointments.forEach((appointment) => {
    if (appointment.status !== COMPLETED_STATUS) return;
    const monthKey = format(appointment.date, 'yyyy-MM');
    const row = rowsByKey.get(monthKey);
    if (!row) return;
    row.completedCount += 1;
  });

  rows.forEach((row) => {
    row.occupancyRate = row.capacity > 0 ? roundOne((row.completedCount / row.capacity) * 100) : 0;
  });

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
  delayedAuthorizations,
  overdueReceivables,
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
      key: 'admin_hours',
      label: 'Más de 5 horas administrativas semanales',
      met: false,
      value: null,
      measured: false,
    },
    {
      key: 'occupancy',
      label: 'Más de 60% de ocupación',
      met: occupancyRate > 60,
      value: roundOne(occupancyRate),
      measured: true,
    },
    {
      key: 'authorization_delays',
      label: 'Retrasos en autorizaciones',
      met: delayedAuthorizations > 0,
      value: delayedAuthorizations,
      measured: true,
    },
    {
      key: 'billing_delays',
      label: 'Retrasos en facturación o cobro',
      met: overdueReceivables > 0,
      value: roundTwo(overdueReceivables),
      measured: true,
    },
  ];
  const metCount = criteria.filter((criterion) => criterion.met).length;

  return {
    recommended: metCount >= 3,
    metCount,
    requiredCount: 3,
    label: metCount >= 3 ? 'Administrativo recomendado' : 'Administrativo en observación',
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
      key: 'rejected_patients',
      label: 'Pacientes rechazados por falta de horario',
      met: false,
      value: null,
      measured: false,
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
      delayedAuthorizations,
      overdueInvoices,
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
      prisma.appointment.count({
        where: {
          date: { lt: todayStart },
          status: { in: ['PENDING_AUTHORIZATION', 'AUTHORIZED'] },
          authorizationStatus: 'PENDING',
        },
      }),
      prisma.billingInvoice.findMany({
        where: {
          status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
          expectedPaymentDate: { lt: now },
        },
        select: {
          totalAmount: true,
          paidAmount: true,
        },
      }).catch(() => []),
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
    const completedCurrentMonth = currentMonthAppointments.filter((appointment) => appointment.status === COMPLETED_STATUS).length;
    const activePatients = new Set(currentMonthAppointments.map((appointment) => appointment.patientId).filter(Boolean)).size;
    const totalSummary = buildCapacitySummary(totalAvailableMinutes, sessionDurationMinutes, completedCurrentMonth);

    const professionalsSummary = professionals.map((professional) => {
      const availableMinutes = getScheduleMinutes(professional.workSchedule);
      const monthlyCounters = monthlyCountersByProfessional.get(professional.id) || {
        completed: 0,
        total: 0,
        noShow: 0,
        activePatients: new Set(),
      };
      const summary = buildCapacitySummary(availableMinutes, sessionDurationMinutes, monthlyCounters.completed);
      const weeklyCapacity = sessionDurationMinutes > 0 ? availableMinutes / sessionDurationMinutes : 0;
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
    const monthlyTrend = buildMonthlyTrend(historicalAppointments, totalSummary.monthlyCapacity, now);
    const sustainedGrowth = getSustainedGrowth(monthlyTrend);
    const overdueReceivables = overdueInvoices.reduce(
      (sum, invoice) => sum + Math.max(0, toNumber(invoice.totalAmount) - toNumber(invoice.paidAmount)),
      0
    );

    const adminRecommendation = buildAdminRecommendation({
      monthlyAppointmentCount: currentMonthAppointments.length,
      activePatients,
      occupancyRate: totalSummary.occupancyRate,
      delayedAuthorizations,
      overdueReceivables,
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
        capacityPerSlot: Number(config.capacityPerSlot || 1),
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
        completedCount: completedCurrentMonth,
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
      missingData: [
        {
          key: 'admin_hours',
          label: 'Horas administrativas semanales',
          reason: 'Todavía no existe registro horario de tareas administrativas.',
        },
        {
          key: 'rejected_patients',
          label: 'Pacientes rechazados por falta de horario',
          reason: 'Todavía no se registra demanda perdida.',
        },
        {
          key: 'rooms',
          label: 'Boxes o salas físicas disponibles',
          reason: 'La capacidad física no está modelada como entidad separada.',
        },
      ],
    });
  } catch (error) {
    throw createInternalError(error, 'Error al obtener capacidad operativa');
  }
};
