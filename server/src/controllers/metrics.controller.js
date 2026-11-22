import {
  addDays,
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
import { getCapacityForDate, getCapacityForMonth, getCapacityForWeek } from '../domain/metrics/capacity.service.js';
import {
  PENDING_STATUSES,
  buildFutureAgenda,
  buildPeriodBreakdown,
  classifyStatus,
} from '../domain/metrics/operationalAnalysis.js';
import { getHolidaysForDateRange } from '../services/holidayCalendar.service.js';
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

const buildMonthlySnapshot = async (prisma, baseDate, now = new Date()) => {
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
        status: { in: PENDING_STATUSES },
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
  // Sin turnos resueltos no hay tasa de asistencia: null se muestra como "-".
  const attendanceRate = resolvedCount > 0
    ? Number(((completedCount / resolvedCount) * 100).toFixed(1))
    : null;
  const totalTurnosMes = appointments.length;
  const breakdown = buildPeriodBreakdown({ appointments, capacity: 0, now });

  return {
    start,
    nextStart,
    appointments,
    appointmentCount,
    completedCount,
    noShowCount,
    scheduledCount,
    pendingPastCount: breakdown.pendingPast,
    upcomingCount: breakdown.upcoming,
    otherStatusCount: breakdown.otherStatus,
    authorizationAttentionCount: breakdown.authorizationAttention,
    resolvedCount,
    attendanceRate,
    totalTurnosMes,
    insuranceBreakdown,
    respiratoryCount: appointments.filter((appointment) => appointment.patient.isRespiratory).length,
    iuCount: appointments.filter((appointment) => appointment.patient.isIU).length,
  };
};

const formatFutureMonthLabel = (date) => format(date, 'MMM yy', { locale: es }).replace('.', '').toUpperCase();

const buildFutureAgendaSnapshot = async (prisma, now, getDayCapacity = () => 0) => {
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
        status: true,
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

  const agenda = buildFutureAgenda({ futureAppointments, now, getDayCapacity });

  return {
    calendarDaysToLastAppointment: agenda.calendarDaysToLastAppointment,
    daysWithAppointments: agenda.daysWithAppointments,
    weeksWithAppointments: agenda.weeksWithAppointments,
    window: agenda.window,
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

/**
 * Embudo comercial del mes desde la agenda real:
 * - Pacientes nuevos: su primer turno (no cancelado) de la historia cae en el mes.
 * - Renovaciones: turno marcado como primera sesión de ciclo de un paciente que ya tenía turnos antes.
 * - Continuidad: pacientes con 2 o más asistencias en el mes.
 * - Abandonos: turnos del mes marcados a mano como abandono de tratamiento.
 */
const buildCommercialMetrics = (appointments = [], firstAppointmentByPatient = new Map(), monthStart) => {
  const valid = appointments.filter((appointment) => appointment.status !== 'CANCELLED');
  const patientIds = new Set(valid.map((appointment) => appointment.patientId).filter(Boolean));
  const newPatientIds = new Set([...patientIds].filter((patientId) => {
    const first = firstAppointmentByPatient.get(patientId);
    return first && new Date(first) >= monthStart;
  }));
  const renewalPatientIds = new Set(valid
    .filter((appointment) => appointment.isFirstSession && !newPatientIds.has(appointment.patientId))
    .map((appointment) => appointment.patientId));
  const attendedByPatient = new Map();
  valid.filter((appointment) => appointment.status === 'COMPLETED').forEach((appointment) => {
    attendedByPatient.set(appointment.patientId, (attendedByPatient.get(appointment.patientId) || 0) + 1);
  });
  const assistances = [...attendedByPatient.values()].reduce((sum, count) => sum + count, 0);
  const attendedPatients = attendedByPatient.size;
  const continuityCount = [...attendedByPatient.values()].filter((count) => count >= 2).length;
  const abandonmentCount = new Set(valid.filter((appointment) => appointment.treatmentAbandoned)
    .map((appointment) => appointment.patientId)).size;
  const rate = (part, total) => (total > 0 ? Number(((part / total) * 100).toFixed(1)) : null);

  return {
    activePatients: patientIds.size,
    newPatients: newPatientIds.size,
    renewals: renewalPatientIds.size,
    turnsGranted: valid.length,
    assistances,
    attendedPatients,
    continuityCount,
    singleVisitCount: attendedPatients - continuityCount,
    abandonmentCount,
    continuityRate: rate(continuityCount, attendedPatients),
    renewalRate: rate(renewalPatientIds.size, patientIds.size - newPatientIds.size),
    hasRealData: valid.length > 0,
  };
};

export const buildCommercialMetricsForTest = buildCommercialMetrics;

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

  if (commercial?.hasRealData) {
    insights.push(`Este mes ingresaron ${commercial.newPatients} pacientes nuevos y ${commercial.renewals} renovaron su ciclo.`);
  }

  if (commercial?.continuityRate !== null && commercial?.continuityRate !== undefined) {
    insights.push(`El ${commercial.continuityRate.toFixed(1)}% de los pacientes atendidos vino 2 o más veces en el mes.`);
  }

  return insights;
};

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

    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);

    const weeklyAppointments = await prisma.appointment.findMany({
      where: {
        date: { gte: weekStart, lte: weekEnd },
        status: { not: 'CANCELLED' },
      },
      select: { id: true, date: true, status: true, professionalId: true, slotNumber: true },
    });

    const weeklyScheduled = weeklyAppointments.filter((appointment) => classifyStatus(appointment.status) === 'pending').length;
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

    const currentMonthSnapshot = await buildMonthlySnapshot(prisma, now, now);
    const previousMonthSnapshot = await buildMonthlySnapshot(prisma, subMonths(now, 1), now);
    const agendaConfig = prisma?.agendaConfig?.findFirst ? await prisma.agendaConfig.findFirst() : null;
    const calendarEntries = prisma?.agendaCalendarEntry?.findMany
      ? await prisma.agendaCalendarEntry.findMany({
        where: { isActive: true },
        orderBy: [{ date: 'asc' }, { name: 'asc' }],
      })
      : [];
    // El rango de feriados debe cubrir el mes completo (no solo desde esta
    // semana) y la agenda futura; antes los feriados previos a la semana actual
    // no se descontaban y la capacidad mensual quedaba inflada.
    const lastFutureDate = prisma.appointment.findFirst && await prisma.appointment.findFirst({
      where: { date: { gte: startOfDay(now) }, status: { not: 'CANCELLED' } },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    const capacityRangeStart = new Date(Math.min(weekStart.getTime(), currentMonthSnapshot.start.getTime()));
    const capacityRangeEnd = new Date(Math.max(
      endOfWeek(now).getTime(),
      currentMonthSnapshot.nextStart.getTime() - 1,
      addDays(startOfDay(now), 60).getTime(),
      lastFutureDate?.date ? new Date(lastFutureDate.date).getTime() : 0,
    ));
    const holidays = await getHolidaysForDateRange(
      format(capacityRangeStart, 'yyyy-MM-dd'),
      format(capacityRangeEnd, 'yyyy-MM-dd'),
      { nationalHolidaysClose: agendaConfig?.nationalHolidaysClose !== false },
    );

    const professionals = prisma?.professional?.findMany
      ? await prisma.professional.findMany({
        where: { isActive: true, isArchived: false },
        include: { workSchedule: true },
      })
      : [];
    
    const futureAgendaSnapshot = await buildFutureAgendaSnapshot(
      prisma,
      now,
      (date) => getCapacityForDate({ date, professionals, agendaConfig, calendarEntries, holidays }).capacity,
    );

    const monthlyCapacitySummary = getCapacityForMonth({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      professionals,
      agendaConfig,
      appointments: currentMonthSnapshot.appointments || [],
      calendarEntries,
      holidays,
    });
    const weeklyCapacitySummary = getCapacityForWeek({
      startDate: weekStart,
      professionals,
      agendaConfig,
      appointments: weeklyAppointments,
      calendarEntries,
      holidays,
    });
    const monthlyCapacity = monthlyCapacitySummary.totalCapacity;
    const weeklyCapacity = weeklyCapacitySummary.totalCapacity;
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
    const firstAppointments = await prisma.appointment.groupBy({
      by: ['patientId'],
      where: { status: { not: 'CANCELLED' } },
      _min: { date: true },
    });
    const commercial = buildCommercialMetrics(
      appointmentRows,
      new Map(firstAppointments.map((row) => [row.patientId, row._min?.date || null])),
      currentMonthSnapshot.start,
    );
    const canViewFinance = ['SUPER_USER', 'ADMIN', 'SECRETARIA'].includes(String(req?.user?.role || '').toUpperCase());
    const billingByCoverage = canViewFinance ? await buildBillingByCoverage(prisma, currentMonthSnapshot) : [];
    const insights = buildInsights({
      monthly: {
        capacityMonthly: monthlyCapacity,
        occupancyRate,
        freeCapacity,
      },
      commercial,
      billingByCoverage,
    });

    // Mes en curso: se compara el mismo tramo (día 1 a hoy) contra el mes anterior,
    // para no comparar un mes incompleto (con turnos futuros) contra uno cerrado.
    const isCurrentMonth = format(now, 'yyyy-MM') === format(new Date(), 'yyyy-MM');
    const cutoffDay = now.getDate();
    const countUntilDay = (snapshot) => snapshot.appointments
      .filter((appointment) => new Date(appointment.date).getDate() <= cutoffDay).length;
    const comparableCurrent = isCurrentMonth ? countUntilDay(currentMonthSnapshot) : currentMonthSnapshot.appointmentCount;
    const comparablePrevious = isCurrentMonth ? countUntilDay(previousMonthSnapshot) : previousMonthSnapshot.appointmentCount;
    const monthlyChange = comparablePrevious > 0
      ? Number((((comparableCurrent - comparablePrevious) / comparablePrevious) * 100).toFixed(1))
      : null;

    const yearStart = startOfYear(now);
    const registeredPatientCount = prisma.patient?.count ? await prisma.patient.count() : null;
    const [uniquePatients, attendedPatients] = await Promise.all([
      prisma.appointment.groupBy({
        by: ['patientId'],
        where: {
          date: { gte: yearStart },
          status: { not: 'CANCELLED' },
        },
      }),
      prisma.appointment.groupBy({
        by: ['patientId'],
        where: {
          date: { gte: yearStart },
          status: 'COMPLETED',
        },
      }),
    ]);

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
        const snapshot = await buildMonthlySnapshot(prisma, monthDate, now);
        const monthKey = format(monthDate, 'yyyy-MM');

        return {
          isCurrentMonth: monthKey === format(new Date(), 'yyyy-MM'),
          pendingPastCount: snapshot.pendingPastCount,
          upcomingCount: snapshot.upcomingCount,
          otherStatusCount: snapshot.otherStatusCount,
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
        occupiedCount: weeklyCapacitySummary.occupied,
        reservedCount: weeklyCapacitySummary.reservedCount,
        capacity: weeklyCapacitySummary.totalCapacity,
        theoreticalCapacity: weeklyCapacitySummary.theoreticalCapacity,
        effectiveCapacity: weeklyCapacitySummary.effectiveCapacity,
        availableCapacity: weeklyCapacitySummary.available,
        occupancyRate: Number(weeklyCapacitySummary.occupancyRate.toFixed(1)),
        capacityDays: weeklyCapacitySummary.days,
        respiratory: weeklyRespiratory,
        iu: weeklyIU,
        start: weekStart,
        end: weekEnd,
        percentage: weeklyTotal > 0 ? Number(((weeklyCompleted / weeklyTotal) * 100).toFixed(1)) : 0,
        attendanceRate: weeklyResolved > 0 ? Number(((weeklyCompleted / weeklyResolved) * 100).toFixed(1)) : null,
      },
      monthly: {
        current: currentMonthSnapshot.appointmentCount,
        previous: previousMonthSnapshot.appointmentCount,
        scheduled: currentMonthSnapshot.scheduledCount,
        completed: currentMonthSnapshot.completedCount,
        noShow: currentMonthSnapshot.noShowCount,
        resolved: currentMonthSnapshot.resolvedCount,
        attendanceRate: currentMonthSnapshot.attendanceRate,
        occupiedCount: monthlyCapacitySummary.occupied,
        reservedCount: monthlyCapacitySummary.reservedCount,
        attendedCount: monthlyCapacitySummary.attendedCount,
        noShowCount: monthlyCapacitySummary.noShowCount,
        isPartial: isCurrentMonth,
        pendingPast: currentMonthSnapshot.pendingPastCount,
        upcoming: currentMonthSnapshot.upcomingCount,
        otherStatus: currentMonthSnapshot.otherStatusCount,
        authorizationAttention: currentMonthSnapshot.authorizationAttentionCount,
        change: monthlyChange,
        changeLabel: monthlyChange === null ? 'Sin base' : (monthlyChange >= 0 ? `+${monthlyChange}%` : `${monthlyChange}%`),
        changeBasis: isCurrentMonth
          ? `Días 1 a ${cutoffDay}: ${comparableCurrent} vs ${comparablePrevious} del mes anterior`
          : 'Mes completo vs mes anterior completo',
        label: formatMonthLabel(now),
        insuranceBreakdown: currentMonthSnapshot.insuranceBreakdown,
        respiratory: currentMonthSnapshot.respiratoryCount,
        iu: currentMonthSnapshot.iuCount,
        capacityMonthly: monthlyCapacity,
        theoreticalCapacityMonthly: monthlyCapacitySummary.theoreticalCapacity,
        effectiveCapacityMonthly: monthlyCapacitySummary.effectiveCapacity,
        capacityDays: monthlyCapacitySummary.days,
        occupancyRate,
        freeCapacity,
      },
      commercial,
      billingByCoverage,
      insights,
      annual: {
        patientCount: uniquePatients.length,
        attendedPatientCount: attendedPatients.length,
        registeredPatientCount,
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
