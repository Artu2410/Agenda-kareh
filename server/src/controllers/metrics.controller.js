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
  const totalTurnosMes = appointments.length;

  return {
    start,
    nextStart,
    appointmentCount,
    completedCount,
    noShowCount,
    scheduledCount,
    resolvedCount,
    attendanceRate,
    totalTurnosMes,
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

const buildCommercialMetrics = (appointments = []) => {
  const consultations = 0;
  const turnsGranted = 0;
  const assistances = 0;
  const continuityCount = 0;
  const abandonmentCount = 0;

  return {
    consultations,
    turnsGranted,
    assistances,
    continuityCount,
    abandonmentCount,
    continuityRate: 0,
    conversions: {
      consultationsToTurns: 0,
      turnsToAssistances: 0,
      assistancesToContinuity: 0,
    },
    hasRealData: false,
  };
};

const buildBillingByCoverage = async (prisma, { start, nextStart }) => {
  const cashFlowModel = prisma?.cashFlow?.findMany;
  const billingInvoiceModel = prisma?.billingInvoice?.findMany;

  if (!cashFlowModel && !billingInvoiceModel) {
    return [];
  }

  const [cashflows, invoices] = await Promise.all([
    cashFlowModel ? cashFlowModel({
      where: {
        date: { gte: start, lt: nextStart },
        type: 'INCOME',
      },
      select: {
        amount: true,
        concept: true,
        appointment: { select: { id: true, patientId: true } }
      },
    }) : Promise.resolve([]),
    billingInvoiceModel ? billingInvoiceModel({
      where: {
        issueDate: { gte: start, lt: nextStart },
      },
      select: {
        payerName: true,
        totalAmount: true,
        obraSocialId: true,
        patientId: true,
        obraSocial: {
          select: { nombreOs: true },
        },
        items: {
          select: {
            appointmentId: true,
            patientId: true,
          }
        }
      },
    }) : Promise.resolve([]),
  ]);

  const realRows = [];

  invoices.forEach((invoice) => {
    if (!invoice.totalAmount) return;
    const coverageName = invoice.obraSocial?.nombreOs || invoice.payerName || 'Sin datos';
    
    const patientIds = new Set();
    if (invoice.patientId) patientIds.add(invoice.patientId);
    let turns = 0;
    
    invoice.items?.forEach(item => {
      if (item.patientId) patientIds.add(item.patientId);
      if (item.appointmentId) turns++;
    });

    realRows.push({
      name: coverageName,
      patients: patientIds.size > 0 ? patientIds.size : null,
      turns: turns > 0 ? turns : null,
      amount: Number(invoice.totalAmount.toString()),
    });
  });

  if (cashflows.length > 0) {
    cashflows.forEach((cashflow) => {
      if (!cashflow.amount) return;
      const hasAppt = !!cashflow.appointment;
      
      realRows.push({
        name: cashflow.concept || 'Sin datos',
        patients: hasAppt && cashflow.appointment.patientId ? 1 : null,
        turns: hasAppt ? 1 : null,
        amount: Number(cashflow.amount.toString()),
      });
    });
  }

  if (realRows.length === 0) {
    return [];
  }

  return realRows
    .reduce((acc, row) => {
      const existing = acc.find((item) => item.name === row.name);
      if (existing) {
        existing.amount += row.amount;
        if (row.patients !== null) existing.patients = (existing.patients || 0) + row.patients;
        if (row.turns !== null) existing.turns = (existing.turns || 0) + row.turns;
        return acc;
      }
      acc.push({ ...row });
      return acc;
    }, [])
    .map(row => ({
      ...row,
      patients: row.patients !== null ? row.patients : "-",
      turns: row.turns !== null ? row.turns : "-",
      avgPerPatient: row.patients > 0 ? (row.amount / row.patients) : "-"
    }))
    .sort((left, right) => right.amount - left.amount);
};

const buildInsights = ({ monthly, commercial, billingByCoverage }) => {
  const insights = [];

  if (monthly?.capacityMonthly > 0) {
    insights.push(`La ocupación del consultorio es del ${monthly.occupancyRate.toFixed(1)}%.`);
    insights.push(`Aún existe capacidad para aproximadamente ${Math.round(monthly.freeCapacity)} turnos más este mes.`);
  }

  if (billingByCoverage?.length > 0) {
    const topCoverage = billingByCoverage[0];
    insights.push(`La mayor facturación proviene de pacientes ${topCoverage.name.toLowerCase()}.`);
    const coverageWithMostPatients = [...billingByCoverage].sort((left, right) => right.patients - left.patients)[0];
    insights.push(`La cobertura con mayor cantidad de pacientes es ${coverageWithMostPatients.name}.`);
  }

  if (commercial?.hasRealData && commercial?.consultations > 0) {
    insights.push(`El porcentaje de conversión de consultas a turnos es del ${commercial.conversions.consultationsToTurns.toFixed(1)}%.`);
  }

  if (commercial?.assistances > 0 && commercial?.continuityCount > 0) {
    insights.push(`La tasa de continuidad es del ${commercial.continuityRate.toFixed(1)}%.`);
  }

  return insights;
};

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

const resolveReferenceDate = (req) => {
  const query = req?.query || {};
  const requestedMonth = query.month;
  const requestedYear = query.year;

  if (requestedYear && requestedMonth) {
    const parsedMonth = Number.parseInt(requestedMonth, 10);
    const parsedYear = Number.parseInt(requestedYear, 10);

    if (Number.isInteger(parsedMonth) && Number.isInteger(parsedYear)) {
      const normalizedMonth = Math.min(Math.max(parsedMonth, 1), 12);
      return new Date(parsedYear, normalizedMonth - 1, 1, 12, 0, 0, 0);
    }
  }

  return new Date();
};

export const getMetrics = async (req, res, prisma) => {
  try {
    const now = resolveReferenceDate(req);

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
    const agendaConfig = prisma?.agendaConfig?.findFirst ? await prisma.agendaConfig.findFirst() : null;
    
    const professionals = await prisma.professional.findMany({
      where: { isActive: true, isArchived: false },
      include: { workSchedule: true },
    });
    
    const totalAvailableMinutes = professionals.reduce(
      (sum, prof) => sum + getScheduleMinutes(prof.workSchedule),
      0
    );

    const configuredSlotDuration = Math.max(1, Number(agendaConfig?.slotDuration || agendaConfig?.timerDurationMinutes || 30));
    const weeklyCapacity = configuredSlotDuration > 0
      ? (totalAvailableMinutes / configuredSlotDuration)
      : 0;
    const monthlyCapacity = weeklyCapacity * 4.33;
    const occupancyRate = monthlyCapacity > 0
      ? Number(((currentMonthSnapshot.totalTurnosMes / monthlyCapacity) * 100).toFixed(1))
      : 0;
    const freeCapacity = Math.max(monthlyCapacity - currentMonthSnapshot.totalTurnosMes, 0);

    const appointmentRows = await prisma.appointment.findMany({
      where: {
        date: { gte: currentMonthSnapshot.start, lt: currentMonthSnapshot.nextStart },
        status: { not: 'CANCELLED' },
      },
      include: {
        patient: {
          select: {
            id: true,
            healthInsurance: true,
            treatAsParticular: true,
          },
        },
      },
    });
    const commercial = buildCommercialMetrics(appointmentRows);
    const billingByCoverage = await buildBillingByCoverage(prisma, currentMonthSnapshot);
    const insights = buildInsights({
      monthly: {
        capacityMonthly: monthlyCapacity,
        occupancyRate,
        freeCapacity,
      },
      commercial,
      billingByCoverage,
    });

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
        capacityMonthly: monthlyCapacity,
        occupancyRate,
        freeCapacity,
      },
      commercial,
      billingByCoverage,
      insights,
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

// ------------------------------------------------------------------
// DEBUG TEMPORAL — eliminar después de validación en producción
// ------------------------------------------------------------------
export const getMetricsDebug = async (req, res, prisma) => {
  try {
    const now = resolveReferenceDate(req);
    const { start, nextStart } = buildMonthlyRange(now);

    // Config de agenda
    const agendaConfig = prisma?.agendaConfig?.findFirst
      ? await prisma.agendaConfig.findFirst()
      : null;

    const configuredSlotDuration = Math.max(
      1,
      Number(agendaConfig?.slotDuration || agendaConfig?.timerDurationMinutes || 30)
    );
    const capacityPerSlot = Math.max(1, Number(agendaConfig?.capacityPerSlot || 1));

    // Profesionales y horarios
    const professionals = await prisma.professional.findMany({
      where: { isActive: true, isArchived: false },
      include: { workSchedule: true },
    });

    const totalAvailableMinutes = professionals.reduce(
      (sum, prof) => sum + getScheduleMinutes(prof.workSchedule),
      0
    );

    const weeklyCapacity = configuredSlotDuration > 0
      ? (totalAvailableMinutes / configuredSlotDuration) * capacityPerSlot
      : 0;
    const monthlyCapacity = weeklyCapacity * 4.33;

    // Turnos del mes
    const [totalCount, completedCount, noShowCount, scheduledCount, cancelledCount] = await Promise.all([
      prisma.appointment.count({ where: { date: { gte: start, lt: nextStart } } }),
      prisma.appointment.count({ where: { date: { gte: start, lt: nextStart }, status: 'COMPLETED' } }),
      prisma.appointment.count({ where: { date: { gte: start, lt: nextStart }, status: 'NO_SHOW' } }),
      prisma.appointment.count({ where: { date: { gte: start, lt: nextStart }, status: 'SCHEDULED' } }),
      prisma.appointment.count({ where: { date: { gte: start, lt: nextStart }, status: 'CANCELLED' } }),
    ]);

    const validTurns = totalCount - cancelledCount; // completed + noShow + scheduled
    const occupancyRate = monthlyCapacity > 0
      ? Number(((validTurns / monthlyCapacity) * 100).toFixed(2))
      : 0;

    // Facturación por cobertura (misma lógica corregida)
    const billingByCoverage = await buildBillingByCoverage(prisma, { start, nextStart });

    // Insights
    const insights = buildInsights({
      monthly: { capacityMonthly: monthlyCapacity, occupancyRate, freeCapacity: Math.max(monthlyCapacity - validTurns, 0) },
      commercial: { hasRealData: false, consultations: 0, assistances: 0, continuityCount: 0, conversions: {} },
      billingByCoverage,
    });

    return res.json({
      _debug: true,
      _note: 'Endpoint temporal — eliminar tras validación',
      referenceMonth: format(now, 'MMMM yyyy', { locale: es }),
      config: {
        slotDuration: configuredSlotDuration,
        capacityPerSlot,
        professionalsCount: professionals.length,
        totalAvailableMinutesWeekly: totalAvailableMinutes,
      },
      capacity: {
        weeklyCapacity: Number(weeklyCapacity.toFixed(2)),
        monthlyCapacity: Number(monthlyCapacity.toFixed(2)),
      },
      appointments: {
        total: totalCount,
        completed: completedCount,
        noShow: noShowCount,
        scheduled: scheduledCount,
        cancelled: cancelledCount,
        validTurns,
      },
      occupancyRate,
      billingByCoverage,
      insights,
    });
  } catch (error) {
    throw createInternalError(error, 'Error en debug de métricas');
  }
};
