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

const DEFAULT_FIXED_EXPENSES = 1_193_000;
const MONTHLY_WEEK_FACTOR = 4.33;
const COMPLETED_STATUS = 'COMPLETED';
const CANCELLED_STATUS = 'CANCELLED';
const NO_SHOW_STATUS = 'NO_SHOW';
const HIGH_VALUE_PATIENT_SHARE_THRESHOLD = 10;
const HIGH_PAYER_SHARE_THRESHOLD = 50;
const HIGH_PROFESSIONAL_SHARE_THRESHOLD = 70;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundCurrency = (value) => Math.round(toNumber(value) * 100) / 100;
const roundOne = (value) => Math.round(toNumber(value) * 10) / 10;

const formatMonthLabel = (date) => format(date, 'MMMM yyyy', { locale: es });

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getFixedExpenses = (req) => {
  const requested = toNumber(req.query.fixedExpenses);
  if (requested > 0) return requested;

  const configured = toNumber(process.env.KAREH_FIXED_EXPENSES_MONTHLY);
  return configured > 0 ? configured : DEFAULT_FIXED_EXPENSES;
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

const normalizeText = (value) => String(value || '').trim();
const normalizeUpper = (value) => normalizeText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

const resolvePayerBucket = (invoice = {}) => {
  const text = normalizeUpper(`${invoice.payerName || ''} ${invoice.obraSocial?.nombreOs || ''}`);

  if (invoice.payerType === 'PATIENT' || /PARTICULAR/.test(text)) {
    return { key: 'PARTICULAR', name: 'Particular' };
  }

  if (/PAMI/.test(text)) return { key: 'PAMI', name: 'PAMI' };
  if (/IOMA/.test(text)) return { key: 'IOMA', name: 'IOMA' };
  if (/SWISS/.test(text)) return { key: 'SWISS', name: 'Swiss Medical' };
  if (/SANCOR|SANCOR/.test(text)) return { key: 'SANCOR', name: 'Sancor' };

  return {
    key: invoice.obraSocialId || invoice.payerName || 'OTROS',
    name: invoice.payerName || invoice.obraSocial?.nombreOs || 'Otros',
  };
};

const getInvoicePending = (invoice) => Math.max(0, toNumber(invoice.totalAmount) - toNumber(invoice.paidAmount));

const invoiceInclude = {
  obraSocial: {
    select: {
      id: true,
      nombreOs: true,
    },
  },
  patient: {
    select: {
      id: true,
      fullName: true,
    },
  },
  items: {
    include: {
      patient: {
        select: {
          id: true,
          fullName: true,
        },
      },
      professional: {
        select: {
          id: true,
          fullName: true,
        },
      },
      appointment: {
        select: {
          id: true,
          date: true,
          status: true,
          patientId: true,
          professionalId: true,
          patient: {
            select: {
              id: true,
              fullName: true,
            },
          },
          professional: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      },
    },
  },
};

const getInvoices = (prisma, { start = null, end = null } = {}) => {
  const where = {
    status: { not: 'CANCELLED' },
  };

  if (start || end) {
    where.issueDate = {};
    if (start) where.issueDate.gte = start;
    if (end) where.issueDate.lt = end;
  }

  return prisma.billingInvoice.findMany({
    where,
    include: invoiceInclude,
  });
};

const getFinancialTotals = (invoices = []) => (
  invoices.reduce((summary, invoice) => {
    summary.invoiced += toNumber(invoice.totalAmount);
    summary.collected += toNumber(invoice.paidAmount);
    summary.pending += getInvoicePending(invoice);
    return summary;
  }, {
    invoiced: 0,
    collected: 0,
    pending: 0,
  })
);

const allocateInvoiceRows = (invoices = []) => {
  const rows = [];

  invoices.forEach((invoice) => {
    const totalAmount = toNumber(invoice.totalAmount);
    const paidAmount = toNumber(invoice.paidAmount);
    const payer = resolvePayerBucket(invoice);
    const items = Array.isArray(invoice.items) && invoice.items.length > 0
      ? invoice.items
      : [{
          id: `${invoice.id}-unallocated`,
          totalAmount: invoice.totalAmount,
          quantity: 1,
          patient: invoice.patient,
          serviceDate: invoice.issueDate,
          appointment: null,
          professional: null,
        }];

    items.forEach((item) => {
      const itemAmount = toNumber(item.totalAmount);
      const ratio = totalAmount > 0 ? itemAmount / totalAmount : 0;
      const collected = roundCurrency(paidAmount * ratio);
      const appointment = item.appointment || null;
      const patient = item.patient || appointment?.patient || invoice.patient || null;
      const professional = item.professional || appointment?.professional || null;

      rows.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
        serviceDate: item.serviceDate || appointment?.date || invoice.issueDate,
        payerKey: payer.key,
        payerName: payer.name,
        patientId: patient?.id || item.patientId || appointment?.patientId || invoice.patientId || null,
        patientName: patient?.fullName || null,
        professionalId: professional?.id || item.professionalId || appointment?.professionalId || null,
        professionalName: professional?.fullName || null,
        appointmentId: item.appointmentId || appointment?.id || null,
        quantity: Math.max(1, Number(item.quantity) || 1),
        invoiced: itemAmount,
        collected,
        pending: Math.max(0, roundCurrency(itemAmount - collected)),
      });
    });
  });

  return rows;
};

const getOpenHours = (professionals = [], days = null) => {
  const weeklyHours = professionals.reduce(
    (sum, professional) => sum + (getScheduleMinutes(professional.workSchedule) / 60),
    0
  );

  if (days !== null) {
    return weeklyHours * (Math.max(0, days) / 7);
  }

  return weeklyHours;
};

const buildDateRange = (req) => {
  const start = parseDate(req.query.startDate);
  const end = parseDate(req.query.endDate);

  if (start || end) {
    return {
      start: start || new Date(0),
      end: end ? addDays(startOfDay(end), 1) : new Date(),
      label: 'Período personalizado',
    };
  }

  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  return {
    start: currentMonthStart,
    end: addMonths(currentMonthStart, 1),
    label: formatMonthLabel(currentMonthStart),
  };
};

const getCompletedAppointments = (prisma, { start = null, end = null } = {}) => {
  const where = {
    status: COMPLETED_STATUS,
  };

  if (start || end) {
    where.date = {};
    if (start) where.date.gte = start;
    if (end) where.date.lt = end;
  }

  return prisma.appointment.findMany({
    where,
    select: {
      id: true,
      date: true,
      patientId: true,
      professionalId: true,
      patient: {
        select: {
          id: true,
          fullName: true,
        },
      },
      professional: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  });
};

const getProfessionalsWithSchedule = (prisma) => (
  prisma.professional.findMany({
    where: { isArchived: false },
    orderBy: { fullName: 'asc' },
    include: {
      workSchedule: {
        orderBy: { dayOfWeek: 'asc' },
      },
    },
  })
);

const buildRevenueComparison = async (prisma, now = new Date()) => {
  const currentStart = startOfMonth(now);
  const currentEnd = addMonths(currentStart, 1);
  const previousStart = subMonths(currentStart, 1);

  const [
    currentInvoices,
    previousInvoices,
    currentCompleted,
    previousCompleted,
  ] = await Promise.all([
    getInvoices(prisma, { start: currentStart, end: currentEnd }),
    getInvoices(prisma, { start: previousStart, end: currentStart }),
    prisma.appointment.count({ where: { status: COMPLETED_STATUS, date: { gte: currentStart, lt: currentEnd } } }),
    prisma.appointment.count({ where: { status: COMPLETED_STATUS, date: { gte: previousStart, lt: currentStart } } }),
  ]);

  const current = getFinancialTotals(currentInvoices);
  const previous = getFinancialTotals(previousInvoices);
  const currentAvg = currentCompleted > 0 ? current.invoiced / currentCompleted : 0;
  const previousAvg = previousCompleted > 0 ? previous.invoiced / previousCompleted : 0;

  return {
    current,
    previous,
    currentCompleted,
    previousCompleted,
    averageIncomeDescending: previousAvg > 0 && currentAvg < previousAvg,
    growthWithoutCash: current.invoiced > previous.invoiced && current.collected <= previous.collected,
  };
};

export const getProfitabilitySummary = async (req, res, prisma) => {
  try {
    const fixedExpenses = getFixedExpenses(req);
    const range = buildDateRange(req);
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const ninetyDaysStart = addDays(startOfDay(now), -90);

    const [
      invoices,
      completedAppointments,
      professionals,
      weekInvoices,
      ninetyDayInvoices,
      comparison,
    ] = await Promise.all([
      getInvoices(prisma, range),
      getCompletedAppointments(prisma, range),
      getProfessionalsWithSchedule(prisma),
      getInvoices(prisma, { start: weekStart, end: addDays(weekStart, 7) }),
      getInvoices(prisma, { start: ninetyDaysStart, end: addDays(startOfDay(now), 1) }),
      buildRevenueComparison(prisma, now),
    ]);

    const totals = getFinancialTotals(invoices);
    const patients = new Set(completedAppointments.map((appointment) => appointment.patientId).filter(Boolean));
    const productiveProfessionals = new Set(completedAppointments.map((appointment) => appointment.professionalId).filter(Boolean));
    const weeklyHours = getOpenHours(professionals);
    const periodDays = differenceInCalendarDays(range.end, range.start);
    const periodOpenHours = getOpenHours(professionals, periodDays);
    const weekOpenHours = weeklyHours;
    const monthOpenHours = weeklyHours * MONTHLY_WEEK_FACTOR;
    const ninetyDayOpenHours = getOpenHours(professionals, 90);
    const completedCount = completedAppointments.length;
    const averagePerTurn = completedCount > 0 ? totals.invoiced / completedCount : 0;
    const averagePerPatient = patients.size > 0 ? totals.invoiced / patients.size : 0;
    const averagePerProfessional = productiveProfessionals.size > 0
      ? totals.invoiced / productiveProfessionals.size
      : (professionals.length > 0 ? totals.invoiced / professionals.length : 0);
    const marginAmount = totals.invoiced - fixedExpenses;
    const marginRate = totals.invoiced > 0 ? (marginAmount / totals.invoiced) * 100 : 0;

    const weekTotals = getFinancialTotals(weekInvoices);
    const ninetyDayTotals = getFinancialTotals(ninetyDayInvoices);

    res.status(200).json({
      period: {
        start: range.start,
        end: range.end,
        label: range.label,
      },
      fixedExpenses,
      totals: {
        invoiced: roundCurrency(totals.invoiced),
        collected: roundCurrency(totals.collected),
        pending: roundCurrency(totals.pending),
      },
      averages: {
        perTurn: roundCurrency(averagePerTurn),
        perPatient: roundCurrency(averagePerPatient),
        perProfessional: roundCurrency(averagePerProfessional),
        perOpenHour: periodOpenHours > 0 ? roundCurrency(totals.invoiced / periodOpenHours) : 0,
      },
      margin: {
        amount: roundCurrency(marginAmount),
        rate: roundOne(marginRate),
      },
      hourlyRevenue: {
        week: {
          invoiced: roundCurrency(weekTotals.invoiced),
          openHours: roundOne(weekOpenHours),
          revenuePerOpenHour: weekOpenHours > 0 ? roundCurrency(weekTotals.invoiced / weekOpenHours) : 0,
        },
        month: {
          invoiced: roundCurrency(totals.invoiced),
          openHours: roundOne(monthOpenHours),
          revenuePerOpenHour: monthOpenHours > 0 ? roundCurrency(totals.invoiced / monthOpenHours) : 0,
        },
        last90Days: {
          invoiced: roundCurrency(ninetyDayTotals.invoiced),
          openHours: roundOne(ninetyDayOpenHours),
          revenuePerOpenHour: ninetyDayOpenHours > 0 ? roundCurrency(ninetyDayTotals.invoiced / ninetyDayOpenHours) : 0,
        },
      },
      activity: {
        completedAppointments: completedCount,
        activePatients: patients.size,
        productiveProfessionals: productiveProfessionals.size,
      },
      alerts: {
        averageIncomeDescending: comparison.averageIncomeDescending,
        growthWithoutCash: comparison.growthWithoutCash,
      },
    });
  } catch (error) {
    throw createInternalError(error, 'Error al obtener resumen de rentabilidad');
  }
};

export const getProfitabilityPatients = async (req, res, prisma) => {
  try {
    const today = startOfDay(new Date());
    const [invoices, appointments] = await Promise.all([
      getInvoices(prisma),
      prisma.appointment.findMany({
        where: { status: { not: CANCELLED_STATUS } },
        select: {
          id: true,
          date: true,
          status: true,
          patientId: true,
          patient: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
        orderBy: { date: 'asc' },
      }),
    ]);
    const financialRows = allocateInvoiceRows(invoices);
    const patients = new Map();

    const ensurePatient = (patientId, patientName = 'Sin paciente') => {
      if (!patientId) return null;
      if (!patients.has(patientId)) {
        patients.set(patientId, {
          patientId,
          patientName,
          sessionCount: 0,
          invoiced: 0,
          collected: 0,
          pending: 0,
          firstAttention: null,
          lastAttention: null,
          hasFutureAppointment: false,
          ltv: 0,
          permanenceDays: 0,
          badges: [],
          risk: false,
          riskReason: null,
        });
      }

      return patients.get(patientId);
    };

    appointments.forEach((appointment) => {
      const patient = ensurePatient(appointment.patientId, appointment.patient?.fullName);
      if (!patient) return;

      const appointmentDate = parseDate(appointment.date);
      if (appointment.status === COMPLETED_STATUS) {
        patient.sessionCount += 1;
      }

      if (appointmentDate) {
        if (!patient.firstAttention || appointmentDate < patient.firstAttention) patient.firstAttention = appointmentDate;
        if (!patient.lastAttention || appointmentDate > patient.lastAttention) patient.lastAttention = appointmentDate;
        if (appointmentDate >= today && appointment.status !== NO_SHOW_STATUS) patient.hasFutureAppointment = true;
      }
    });

    financialRows.forEach((row) => {
      const patient = ensurePatient(row.patientId, row.patientName);
      if (!patient) return;

      patient.invoiced += row.invoiced;
      patient.collected += row.collected;
      patient.pending += row.pending;
    });

    let rows = Array.from(patients.values()).map((patient) => {
      const permanenceDays = patient.firstAttention && patient.lastAttention
        ? Math.max(0, differenceInCalendarDays(patient.lastAttention, patient.firstAttention))
        : 0;
      const daysSinceLastAttention = patient.lastAttention
        ? differenceInCalendarDays(today, patient.lastAttention)
        : null;
      const risk = patient.sessionCount >= 6
        && daysSinceLastAttention !== null
        && daysSinceLastAttention > 21
        && !patient.hasFutureAppointment;
      const badges = [];

      if (patient.sessionCount >= 8) badges.push('Recurrente');
      if (permanenceDays >= 60) badges.push('Largo Plazo');

      return {
        ...patient,
        invoiced: roundCurrency(patient.invoiced),
        collected: roundCurrency(patient.collected),
        pending: roundCurrency(patient.pending),
        ltv: roundCurrency(patient.invoiced),
        firstAttention: patient.firstAttention,
        lastAttention: patient.lastAttention,
        permanenceDays,
        badges,
        risk,
        riskReason: risk ? 'Más de 21 días sin turno futuro y alta frecuencia histórica' : null,
      };
    });

    const highValuePatientIds = new Set(
      [...rows]
        .sort((left, right) => right.invoiced - left.invoiced)
        .slice(0, 10)
        .map((patient) => patient.patientId)
    );

    rows = rows.map((patient) => ({
      ...patient,
      badges: highValuePatientIds.has(patient.patientId)
        ? ['Alto Valor', ...patient.badges]
        : patient.badges,
    }));

    const topByRevenue = [...rows]
      .sort((left, right) => right.invoiced - left.invoiced)
      .slice(0, 10);
    const topBySessions = [...rows]
      .sort((left, right) => right.sessionCount - left.sessionCount)
      .slice(0, 10);
    const topByPermanence = [...rows]
      .sort((left, right) => right.permanenceDays - left.permanenceDays)
      .slice(0, 10);
    const riskPatients = rows
      .filter((patient) => patient.risk)
      .sort((left, right) => new Date(left.lastAttention || 0) - new Date(right.lastAttention || 0));

    const totalRevenue = rows.reduce((sum, row) => sum + row.invoiced, 0);
    const dependencyAlerts = topByRevenue
      .map((patient) => ({
        patientId: patient.patientId,
        patientName: patient.patientName,
        share: totalRevenue > 0 ? roundOne((patient.invoiced / totalRevenue) * 100) : 0,
      }))
      .filter((patient) => patient.share >= HIGH_VALUE_PATIENT_SHARE_THRESHOLD);

    res.status(200).json({
      rows: rows.sort((left, right) => right.invoiced - left.invoiced),
      topByRevenue,
      topBySessions,
      topByPermanence,
      riskPatients,
      alerts: {
        patientDependency: dependencyAlerts,
      },
    });
  } catch (error) {
    throw createInternalError(error, 'Error al obtener rentabilidad por paciente');
  }
};

export const getProfitabilityPayers = async (req, res, prisma) => {
  try {
    const invoices = await getInvoices(prisma);
    const rowsByPayer = new Map();

    invoices.forEach((invoice) => {
      const payer = resolvePayerBucket(invoice);
      const current = rowsByPayer.get(payer.key) || {
        key: payer.key,
        name: payer.name,
        turns: 0,
        invoiced: 0,
        collected: 0,
        pending: 0,
        averagePerSession: 0,
        share: 0,
        dependency: false,
      };

      current.invoiced += toNumber(invoice.totalAmount);
      current.collected += toNumber(invoice.paidAmount);
      current.pending += getInvoicePending(invoice);
      current.turns += (invoice.items || []).reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0);
      rowsByPayer.set(payer.key, current);
    });

    const totalInvoiced = Array.from(rowsByPayer.values()).reduce((sum, row) => sum + row.invoiced, 0);
    const rows = Array.from(rowsByPayer.values())
      .map((row) => ({
        ...row,
        invoiced: roundCurrency(row.invoiced),
        collected: roundCurrency(row.collected),
        pending: roundCurrency(row.pending),
        averagePerSession: row.turns > 0 ? roundCurrency(row.invoiced / row.turns) : 0,
        share: totalInvoiced > 0 ? roundOne((row.invoiced / totalInvoiced) * 100) : 0,
        dependency: totalInvoiced > 0 && ((row.invoiced / totalInvoiced) * 100) > HIGH_PAYER_SHARE_THRESHOLD,
      }))
      .sort((left, right) => right.invoiced - left.invoiced);

    res.status(200).json({
      rows,
      alerts: {
        payerDependency: rows.filter((row) => row.dependency),
      },
    });
  } catch (error) {
    throw createInternalError(error, 'Error al obtener rentabilidad por obra social');
  }
};

export const getProfitabilityProfessionals = async (req, res, prisma) => {
  try {
    const [invoices, appointments, professionals] = await Promise.all([
      getInvoices(prisma),
      getCompletedAppointments(prisma),
      prisma.professional.findMany({
        where: { isArchived: false },
        orderBy: { fullName: 'asc' },
        select: {
          id: true,
          fullName: true,
          specialty: true,
        },
      }),
    ]);
    const rowsByProfessional = new Map(professionals.map((professional) => [professional.id, {
      professionalId: professional.id,
      professionalName: professional.fullName,
      specialty: professional.specialty,
      turns: 0,
      invoiced: 0,
      collected: 0,
      pending: 0,
      averagePerTurn: 0,
      share: 0,
      dependency: false,
    }]));

    appointments.forEach((appointment) => {
      const current = rowsByProfessional.get(appointment.professionalId);
      if (current) current.turns += 1;
    });

    allocateInvoiceRows(invoices).forEach((row) => {
      if (!row.professionalId) return;
      const current = rowsByProfessional.get(row.professionalId);
      if (!current) return;

      current.invoiced += row.invoiced;
      current.collected += row.collected;
      current.pending += row.pending;
    });

    const totalInvoiced = Array.from(rowsByProfessional.values()).reduce((sum, row) => sum + row.invoiced, 0);
    const rows = Array.from(rowsByProfessional.values())
      .map((row) => ({
        ...row,
        invoiced: roundCurrency(row.invoiced),
        collected: roundCurrency(row.collected),
        pending: roundCurrency(row.pending),
        averagePerTurn: row.turns > 0 ? roundCurrency(row.invoiced / row.turns) : 0,
        share: totalInvoiced > 0 ? roundOne((row.invoiced / totalInvoiced) * 100) : 0,
        dependency: totalInvoiced > 0 && ((row.invoiced / totalInvoiced) * 100) > HIGH_PROFESSIONAL_SHARE_THRESHOLD,
      }))
      .sort((left, right) => right.invoiced - left.invoiced);

    res.status(200).json({
      rows,
      alerts: {
        professionalDependency: rows.filter((row) => row.dependency),
      },
    });
  } catch (error) {
    throw createInternalError(error, 'Error al obtener rentabilidad por profesional');
  }
};

export const getProfitabilityEquilibrium = async (req, res, prisma) => {
  try {
    const fixedExpenses = getFixedExpenses(req);
    const range = buildDateRange(req);
    const [invoices, completedAppointments] = await Promise.all([
      getInvoices(prisma, range),
      getCompletedAppointments(prisma, range),
    ]);
    const totals = getFinancialTotals(invoices);
    const completedCount = completedAppointments.length;
    const averagePerTurn = completedCount > 0 ? totals.invoiced / completedCount : 0;
    const requiredTurns = averagePerTurn > 0 ? Math.ceil(fixedExpenses / averagePerTurn) : 0;
    const missingTurns = Math.max(requiredTurns - completedCount, 0);
    const reachedRate = requiredTurns > 0 ? (completedCount / requiredTurns) * 100 : 0;

    res.status(200).json({
      period: {
        start: range.start,
        end: range.end,
        label: range.label,
      },
      fixedExpenses,
      averagePerTurn: roundCurrency(averagePerTurn),
      completedTurns: completedCount,
      requiredTurns,
      missingTurns,
      reachedRate: roundOne(reachedRate),
      covered: completedCount >= requiredTurns && requiredTurns > 0,
    });
  } catch (error) {
    throw createInternalError(error, 'Error al obtener punto de equilibrio');
  }
};
