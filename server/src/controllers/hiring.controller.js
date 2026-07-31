import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  startOfDay,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { createInternalError } from '../errors/AppError.js';

const DEFAULT_FIXED_EXPENSES = 1_193_000;
const DEFAULT_ADMIN_MONTHLY_COST = 250_000;
const DEFAULT_KINESIOLOGIST_MONTHLY_COST = 1_200_000;
const DEFAULT_NEW_KINESIOLOGIST_WEEKLY_HOURS = 15;
const MONTHLY_WEEK_FACTOR = 4.33;
const DAYS_PER_MONTH = 30.44;
const COMPLETED_STATUS = 'COMPLETED';
const CANCELLED_STATUS = 'CANCELLED';
const NO_SHOW_STATUS = 'NO_SHOW';
const CANCELLED_INVOICE_STATUS = 'CANCELLED';
const CASHFLOW_ACCOUNTS = ['CASH', 'MERCADO_PAGO'];

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundCurrency = (value) => Math.round(toNumber(value) * 100) / 100;
const roundOne = (value) => Math.round(toNumber(value) * 10) / 10;

const normalizeUpper = (value) => String(value || '').trim().toUpperCase();
const formatMonthLabel = (date) => format(date, 'MMMM yyyy', { locale: es });
const formatMonthKey = (date) => format(date, 'yyyy-MM');

const getConfigValue = (queryValue, envValue, fallback) => {
  const requested = toNumber(queryValue);
  if (requested > 0) return requested;

  const configured = toNumber(envValue);
  return configured > 0 ? configured : fallback;
};

const getFixedExpenses = (req) => getConfigValue(
  req.query.fixedExpenses,
  process.env.KAREH_FIXED_EXPENSES_MONTHLY,
  DEFAULT_FIXED_EXPENSES
);

const parseTimeToMinutes = (value) => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
};

const getScheduleMinutes = (schedule = []) => schedule.reduce((sum, item) => {
  const start = parseTimeToMinutes(item.startTime);
  const end = parseTimeToMinutes(item.endTime);
  if (start === null || end === null || end <= start) return sum;
  return sum + (end - start);
}, 0);

const getCashBalances = (transactions = []) => {
  const balances = new Map(CASHFLOW_ACCOUNTS.map((account) => [account, 0]));

  const ensureAccount = (account) => {
    const resolvedAccount = normalizeUpper(account) || 'CASH';
    if (!balances.has(resolvedAccount)) balances.set(resolvedAccount, 0);
    return resolvedAccount;
  };

  transactions.forEach((transaction) => {
    const amount = toNumber(transaction.amount);
    const account = ensureAccount(transaction.account);

    if (transaction.type === 'INCOME') {
      balances.set(account, balances.get(account) + amount);
      return;
    }

    if (transaction.type === 'EXPENSE') {
      balances.set(account, balances.get(account) - amount);
      return;
    }

    if (transaction.type === 'TRANSFER') {
      const destinationAccount = ensureAccount(transaction.destinationAccount);
      balances.set(account, balances.get(account) - amount);
      balances.set(destinationAccount, balances.get(destinationAccount) + amount);
    }
  });

  const accounts = Array.from(balances.entries()).map(([account, balance]) => ({
    account,
    balance: roundCurrency(balance),
  }));

  return {
    total: roundCurrency(accounts.reduce((sum, account) => sum + account.balance, 0)),
    accounts,
  };
};

const getInvoicePending = (invoice) => Math.max(0, toNumber(invoice.totalAmount) - toNumber(invoice.paidAmount));

const getExpectedPaymentDate = (invoice, today) => {
  const expectedDate = invoice.expectedPaymentDate || invoice.dueDate || addDays(invoice.issueDate, 60);
  const normalized = startOfDay(expectedDate);
  return normalized < today ? today : normalized;
};

const buildReceivablesSummary = (invoices = [], today) => {
  const horizon90 = addDays(today, 90);

  return invoices.reduce((summary, invoice) => {
    const pending = getInvoicePending(invoice);
    if (pending <= 0) return summary;

    const expectedDate = getExpectedPaymentDate(invoice, today);
    summary.totalPending += pending;
    if (expectedDate <= horizon90) summary.pendingDue90 += pending;
    if ((invoice.expectedPaymentDate || invoice.dueDate) && new Date(invoice.expectedPaymentDate || invoice.dueDate) < today) {
      summary.overduePending += pending;
      summary.overdueInvoices += 1;
    }
    summary.pendingInvoices += 1;

    return summary;
  }, {
    totalPending: 0,
    pendingDue90: 0,
    overduePending: 0,
    overdueInvoices: 0,
    pendingInvoices: 0,
  });
};

const buildMonthlyRows = (appointments = [], months = 6, now = new Date()) => {
  const rows = Array.from({ length: months }, (_, index) => {
    const monthDate = startOfMonth(subMonths(now, months - 1 - index));
    return {
      monthKey: formatMonthKey(monthDate),
      month: formatMonthLabel(monthDate),
      completedTurns: 0,
      totalTurns: 0,
      newPatients: 0,
      patientIds: new Set(),
    };
  });
  const rowsByKey = new Map(rows.map((row) => [row.monthKey, row]));
  const firstMonthByPatient = new Map();

  appointments.forEach((appointment) => {
    if (!appointment.patientId) return;
    const appointmentDate = new Date(appointment.date);
    const monthKey = formatMonthKey(appointmentDate);
    if (!firstMonthByPatient.has(appointment.patientId)) {
      firstMonthByPatient.set(appointment.patientId, monthKey);
    }

    const row = rowsByKey.get(monthKey);
    if (!row) return;

    row.totalTurns += 1;
    if (appointment.status === COMPLETED_STATUS) row.completedTurns += 1;
    row.patientIds.add(appointment.patientId);
  });

  firstMonthByPatient.forEach((monthKey) => {
    const row = rowsByKey.get(monthKey);
    if (row) row.newPatients += 1;
  });

  return rows.map((row) => ({
    monthKey: row.monthKey,
    month: row.month,
    completedTurns: row.completedTurns,
    totalTurns: row.totalTurns,
    activePatients: row.patientIds.size,
    newPatients: row.newPatients,
  }));
};

const getAverageMonthlyGrowth = (rows = [], key) => {
  if (rows.length < 2) return 0;
  const first = rows[0]?.[key] || 0;
  const last = rows[rows.length - 1]?.[key] || 0;
  return (last - first) / (rows.length - 1);
};

const getGrowthRate = (rows = [], key) => {
  const previous = rows.slice(0, 3);
  const recent = rows.slice(-3);
  const previousAverage = previous.reduce((sum, row) => sum + toNumber(row[key]), 0) / Math.max(previous.length, 1);
  const recentAverage = recent.reduce((sum, row) => sum + toNumber(row[key]), 0) / Math.max(recent.length, 1);
  return previousAverage > 0 ? ((recentAverage - previousAverage) / previousAverage) * 100 : 0;
};

const hasSustainedGrowth = (rows = [], key) => {
  const recent = rows.slice(-3);
  if (recent.length < 3) return false;
  return recent[0][key] <= recent[1][key]
    && recent[1][key] <= recent[2][key]
    && recent[2][key] > recent[0][key];
};

const calculateResponseMetrics = (messages = [], conversations = []) => {
  const messagesByConversation = new Map();

  messages.forEach((message) => {
    const list = messagesByConversation.get(message.conversationId) || [];
    list.push(message);
    messagesByConversation.set(message.conversationId, list);
  });

  const responseHours = [];
  let inboundMessages = 0;
  let unansweredInbound = 0;

  messagesByConversation.forEach((conversationMessages) => {
    const ordered = [...conversationMessages].sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));

    ordered.forEach((message, index) => {
      if (message.direction !== 'inbound') return;
      inboundMessages += 1;
      const inboundDate = new Date(message.createdAt);
      const response = ordered
        .slice(index + 1)
        .find((candidate) => candidate.direction === 'outbound' && new Date(candidate.createdAt) >= inboundDate);

      if (!response) {
        unansweredInbound += 1;
        return;
      }

      responseHours.push((new Date(response.createdAt) - inboundDate) / (1000 * 60 * 60));
    });
  });

  const pendingMessages = conversations.reduce((sum, conversation) => sum + toNumber(conversation.unreadCount), 0);

  return {
    inboundMessages,
    unansweredInbound,
    pendingMessages,
    pendingConversations: conversations.filter((conversation) => toNumber(conversation.unreadCount) > 0).length,
    averageResponseHours: responseHours.length > 0
      ? roundOne(responseHours.reduce((sum, hours) => sum + hours, 0) / responseHours.length)
      : null,
    measuredResponses: responseHours.length,
  };
};

const estimateAdminHoursWeekly = ({
  activePatients,
  delayedAuthorizations,
  inboundMessages,
  monthlyTurns,
  pendingInvoices,
}) => {
  const monthlyHours = (
    monthlyTurns * 0.1
    + activePatients * 0.25
    + inboundMessages * 0.04
    + pendingInvoices * 0.12
    + delayedAuthorizations * 0.25
  );

  return roundOne(monthlyHours / MONTHLY_WEEK_FACTOR);
};

const getCriterion = ({ key, label, measured = true, met, score, value, weight }) => ({
  key,
  label,
  measured,
  met,
  score,
  value,
  weight,
});

const buildAdministrativeDecision = ({
  activePatients,
  adminCost,
  averageResponseHours,
  averageRevenuePerTurn,
  delayedAuthorizations,
  estimatedAdminHoursWeekly,
  monthlyTurnGrowth,
  monthlyTurns,
  pendingMessages,
  receivables,
  sessionDurationMinutes,
}) => {
  const criteria = [
    getCriterion({
      key: 'monthly_turns',
      label: '120+ turnos mensuales',
      met: monthlyTurns >= 120,
      score: monthlyTurns >= 120 ? 25 : (monthlyTurns >= 90 ? 15 : 0),
      value: monthlyTurns,
      weight: 25,
    }),
    getCriterion({
      key: 'active_patients',
      label: '15+ pacientes activos',
      met: activePatients >= 15,
      score: activePatients >= 15 ? 15 : (activePatients >= 12 ? 8 : 0),
      value: activePatients,
      weight: 15,
    }),
    getCriterion({
      key: 'admin_hours',
      label: '5+ horas administrativas semanales',
      met: estimatedAdminHoursWeekly >= 5,
      score: estimatedAdminHoursWeekly >= 5 ? 25 : (estimatedAdminHoursWeekly >= 3 ? 15 : 0),
      value: estimatedAdminHoursWeekly,
      weight: 25,
    }),
    getCriterion({
      key: 'response_time',
      label: 'Respuesta promedio > 24 hs',
      measured: averageResponseHours !== null,
      met: averageResponseHours !== null && averageResponseHours > 24,
      score: averageResponseHours > 24 ? 15 : (averageResponseHours > 12 ? 8 : 0),
      value: averageResponseHours,
      weight: 15,
    }),
    getCriterion({
      key: 'pending_messages',
      label: 'Mensajes pendientes',
      met: pendingMessages > 10,
      score: pendingMessages > 10 ? 10 : (pendingMessages > 5 ? 5 : 0),
      value: pendingMessages,
      weight: 10,
    }),
    getCriterion({
      key: 'process_delays',
      label: 'Retrasos administrativos',
      met: delayedAuthorizations > 0 || receivables.overdueInvoices > 0,
      score: delayedAuthorizations > 0 && receivables.overdueInvoices > 0 ? 10 : ((delayedAuthorizations > 0 || receivables.overdueInvoices > 0) ? 5 : 0),
      value: delayedAuthorizations + receivables.overdueInvoices,
      weight: 10,
    }),
  ];
  const score = Math.min(100, Math.round(criteria.reduce((sum, criterion) => sum + criterion.score, 0)));
  const status = score >= 70 ? 'HIRE' : (score >= 45 ? 'EVALUATE' : 'NO_HIRE');
  const freedHoursWeekly = 12;
  const additionalTurnsFromFreedTime = sessionDurationMinutes > 0
    ? (freedHoursWeekly * 60 / sessionDurationMinutes) * MONTHLY_WEEK_FACTOR
    : 0;
  const revenueFromFreedTime = additionalTurnsFromFreedTime * averageRevenuePerTurn;
  const turnsToBreakEven = averageRevenuePerTurn > 0 ? Math.ceil(adminCost / averageRevenuePerTurn) : null;
  const breakEvenOccupancyOfFreedTime = additionalTurnsFromFreedTime > 0 && turnsToBreakEven
    ? (turnsToBreakEven / additionalTurnsFromFreedTime) * 100
    : null;
  const monthsToThreshold = monthlyTurns >= 120
    ? 0
    : (monthlyTurnGrowth > 0 ? Math.ceil((120 - monthlyTurns) / monthlyTurnGrowth) : null);

  return {
    type: 'ADMINISTRATIVE',
    title: 'Administrativa',
    status,
    statusLabel: status === 'HIRE'
      ? 'Contratación recomendada'
      : (status === 'EVALUATE' ? 'Evaluar próximos 90 días' : 'No contratar ahora'),
    score,
    projectedDate: status === 'HIRE'
      ? new Date()
      : (monthsToThreshold !== null && monthsToThreshold <= 12 ? addMonths(startOfMonth(new Date()), Math.max(1, monthsToThreshold)) : null),
    metrics: {
      activePatients,
      monthlyTurns,
      estimatedAdminHoursWeekly,
      averageResponseHours,
      pendingMessages,
      delayedAuthorizations,
      overdueInvoices: receivables.overdueInvoices,
    },
    criteria,
    reasons: criteria
      .filter((criterion) => criterion.score > 0)
      .map((criterion) => criterion.label),
    recommendation: status === 'HIRE'
      ? 'Incorporar administrativa parcial para liberar tiempo de Arturo y proteger cobranza, autorizaciones y respuesta.'
      : (status === 'EVALUATE'
          ? 'Medir carga administrativa semanal real y preparar incorporación parcial si el score supera 70.'
          : 'No sumar costo fijo administrativo hasta aumentar volumen o evidencia de cuello administrativo.'),
    simulation: {
      monthlyCost: roundCurrency(adminCost),
      assumedWeeklyHours: freedHoursWeekly,
      additionalTurnsFromFreedTime: roundOne(additionalTurnsFromFreedTime),
      expectedRevenueFromFreedTime: roundCurrency(revenueFromFreedTime),
      turnsToBreakEven,
      breakEvenOccupancyOfFreedTime: breakEvenOccupancyOfFreedTime !== null ? roundOne(breakEvenOccupancyOfFreedTime) : null,
      roiSignal: revenueFromFreedTime >= adminCost ? 'CUBRE_COSTO_SI_SE_USA_CAPACIDAD' : 'NO_CUBRE_CON_SUPUESTOS_ACTUALES',
    },
  };
};

const buildKinesiologistDecision = ({
  averageRevenuePerTurn,
  coverageDays,
  currentCompletedTurns,
  freeMonthlyCapacity,
  kinesiologistCost,
  monthlyCapacity,
  monthlyTurnGrowth,
  newKinesiologistWeeklyHours,
  occupancyRate,
  sessionDurationMinutes,
  sustainedGrowth,
}) => {
  const targetTurns85 = monthlyCapacity * 0.85;
  const monthsToSaturation = occupancyRate >= 85
    ? 0
    : (monthlyTurnGrowth > 0 ? Math.ceil((targetTurns85 - currentCompletedTurns) / monthlyTurnGrowth) : null);
  const saturationDate = monthsToSaturation !== null && monthsToSaturation >= 0 && monthsToSaturation <= 36
    ? addMonths(startOfMonth(new Date()), monthsToSaturation)
    : null;
  const additionalTurns = sessionDurationMinutes > 0
    ? (newKinesiologistWeeklyHours * 60 / sessionDurationMinutes) * MONTHLY_WEEK_FACTOR
    : 0;
  const expectedRevenueAt60 = additionalTurns * 0.6 * averageRevenuePerTurn;
  const turnsToBreakEven = averageRevenuePerTurn > 0 ? Math.ceil(kinesiologistCost / averageRevenuePerTurn) : null;
  const occupancyToBreakEven = additionalTurns > 0 && turnsToBreakEven
    ? (turnsToBreakEven / additionalTurns) * 100
    : null;
  const criteria = [
    getCriterion({
      key: 'occupancy',
      label: 'Ocupación > 85%',
      met: occupancyRate > 85,
      score: occupancyRate > 85 ? 35 : (occupancyRate >= 70 ? 25 : (occupancyRate >= 60 ? 12 : 0)),
      value: roundOne(occupancyRate),
      weight: 35,
    }),
    getCriterion({
      key: 'coverage',
      label: 'Agenda cubierta > 60 días',
      met: coverageDays > 60,
      score: coverageDays > 60 ? 20 : (coverageDays > 30 ? 10 : 0),
      value: coverageDays,
      weight: 20,
    }),
    getCriterion({
      key: 'free_capacity',
      label: 'Capacidad libre baja',
      met: freeMonthlyCapacity < 20,
      score: freeMonthlyCapacity < 20 ? 15 : (freeMonthlyCapacity < 40 ? 8 : 0),
      value: roundOne(freeMonthlyCapacity),
      weight: 15,
    }),
    getCriterion({
      key: 'sustained_growth',
      label: 'Crecimiento sostenido 3 meses',
      met: sustainedGrowth,
      score: sustainedGrowth ? 15 : 0,
      value: sustainedGrowth ? 'Sí' : 'No',
      weight: 15,
    }),
    getCriterion({
      key: 'saturation_90',
      label: 'Saturación estimada dentro de 90 días',
      met: monthsToSaturation !== null && monthsToSaturation <= 3,
      score: monthsToSaturation !== null && monthsToSaturation <= 3 ? 15 : (monthsToSaturation !== null && monthsToSaturation <= 6 ? 8 : 0),
      value: monthsToSaturation,
      weight: 15,
    }),
  ];
  const score = Math.min(100, Math.round(criteria.reduce((sum, criterion) => sum + criterion.score, 0)));
  const status = score >= 70 ? 'IMMINENT' : (score >= 45 ? 'NEXT_90_DAYS' : 'NO_HIRE');

  return {
    type: 'KINESIOLOGIST',
    title: 'Segundo kinesiólogo',
    status,
    statusLabel: status === 'IMMINENT'
      ? 'Expansión clínica recomendada'
      : (status === 'NEXT_90_DAYS' ? 'Monitorear próximos 90 días' : 'No contratar ahora'),
    score,
    projectedDate: saturationDate,
    metrics: {
      occupancyRate: roundOne(occupancyRate),
      monthlyCapacity: roundOne(monthlyCapacity),
      currentCompletedTurns,
      freeMonthlyCapacity: roundOne(freeMonthlyCapacity),
      coverageDays,
      monthlyTurnGrowth: roundOne(monthlyTurnGrowth),
      saturationTargetTurns: roundOne(targetTurns85),
      monthsToSaturation,
    },
    criteria,
    reasons: criteria
      .filter((criterion) => criterion.score > 0)
      .map((criterion) => criterion.label),
    recommendation: status === 'IMMINENT'
      ? 'Preparar incorporación clínica y validar demanda rechazada antes de firmar costo fijo.'
      : (status === 'NEXT_90_DAYS'
          ? 'No contratar todavía; llenar primero la capacidad libre y medir saturación semanalmente.'
          : 'No incorporar kinesiólogo todavía; la prioridad es ocupar capacidad disponible.'),
    simulation: {
      monthlyCost: roundCurrency(kinesiologistCost),
      assumedWeeklyHours: newKinesiologistWeeklyHours,
      additionalMonthlyTurns: roundOne(additionalTurns),
      expectedRevenueAt60Occupancy: roundCurrency(expectedRevenueAt60),
      turnsToBreakEven,
      occupancyToBreakEven: occupancyToBreakEven !== null ? roundOne(occupancyToBreakEven) : null,
      roiSignal: expectedRevenueAt60 >= kinesiologistCost ? 'CUBRE_COSTO_AL_60' : 'REQUIERE_MAYOR_OCUPACION',
    },
  };
};

const buildFinancialGuardrail = ({
  adminCost,
  cashBalances,
  fixedExpenses,
  kinesiologistCost,
  receivables,
  currentMonthInvoiced,
}) => {
  const projectedCash90 = cashBalances.total + receivables.pendingDue90 - ((fixedExpenses / DAYS_PER_MONTH) * 90);
  const monthlyMargin = currentMonthInvoiced - fixedExpenses;
  const safeMonthlyHiringBudget = Math.max(0, (projectedCash90 - fixedExpenses) / 3);

  return {
    currentCash: cashBalances.total,
    accounts: cashBalances.accounts,
    pendingReceivables: roundCurrency(receivables.totalPending),
    pendingDue90: roundCurrency(receivables.pendingDue90),
    projectedCash90: roundCurrency(projectedCash90),
    fixedExpenses: roundCurrency(fixedExpenses),
    currentMonthInvoiced: roundCurrency(currentMonthInvoiced),
    monthlyMargin: roundCurrency(monthlyMargin),
    safeMonthlyHiringBudget: roundCurrency(safeMonthlyHiringBudget),
    affordability: {
      admin: {
        monthlyCost: roundCurrency(adminCost),
        affordable: safeMonthlyHiringBudget >= adminCost || monthlyMargin >= adminCost,
      },
      kinesiologist: {
        monthlyCost: roundCurrency(kinesiologistCost),
        affordable: safeMonthlyHiringBudget >= kinesiologistCost || monthlyMargin >= kinesiologistCost,
      },
    },
  };
};

const buildOverallRisk = ({ administrative, financial, kinesiologist }) => {
  if (
    financial.projectedCash90 < 0
    || kinesiologist.status === 'IMMINENT'
    || (administrative.status === 'HIRE' && !financial.affordability.admin.affordable)
  ) {
    return {
      level: 'ALTO',
      description: 'Hay riesgo operativo o financiero relevante antes de contratar.',
    };
  }

  if (
    administrative.status === 'EVALUATE'
    || kinesiologist.status === 'NEXT_90_DAYS'
    || financial.safeMonthlyHiringBudget <= 0
  ) {
    return {
      level: 'MEDIO',
      description: 'Conviene preparar escenarios y medir señales semanalmente.',
    };
  }

  return {
    level: 'BAJO',
    description: 'No hay presión suficiente para sumar estructura fija inmediata.',
  };
};

export const getHiringRecommendations = async (req, res, prisma) => {
  try {
    const now = new Date();
    const today = startOfDay(now);
    const monthStart = startOfMonth(now);
    const monthEnd = addMonths(monthStart, 1);
    const trendStart = startOfMonth(subMonths(now, 5));
    const messageStart = addDays(today, -30);
    const fixedExpenses = getFixedExpenses(req);
    const adminCost = getConfigValue(req.query.adminCost, process.env.KAREH_ADMIN_MONTHLY_COST, DEFAULT_ADMIN_MONTHLY_COST);
    const kinesiologistCost = getConfigValue(
      req.query.kinesiologistCost,
      process.env.KAREH_KINESIOLOGIST_MONTHLY_COST,
      DEFAULT_KINESIOLOGIST_MONTHLY_COST
    );

    const [
      agendaConfig,
      professionals,
      currentMonthAppointments,
      historicalAppointments,
      futureAppointments,
      invoices,
      currentMonthInvoices,
      cashTransactions,
      delayedAuthorizations,
      conversations,
      messages,
    ] = await Promise.all([
      prisma.agendaConfig.findFirst(),
      prisma.professional.findMany({
        where: {
          isActive: true,
          isArchived: false,
        },
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
          patientId: true,
        },
        orderBy: { date: 'asc' },
      }),
      prisma.appointment.findMany({
        where: {
          date: { gte: today },
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
      prisma.billingInvoice.findMany({
        where: {
          status: { not: CANCELLED_INVOICE_STATUS },
        },
        select: {
          issueDate: true,
          dueDate: true,
          expectedPaymentDate: true,
          totalAmount: true,
          paidAmount: true,
        },
      }),
      prisma.billingInvoice.findMany({
        where: {
          status: { not: CANCELLED_INVOICE_STATUS },
          issueDate: { gte: monthStart, lt: monthEnd },
        },
        select: {
          totalAmount: true,
        },
      }),
      prisma.cashFlow.findMany({
        select: {
          type: true,
          amount: true,
          account: true,
          destinationAccount: true,
        },
      }),
      prisma.appointment.count({
        where: {
          date: { lt: today },
          status: { in: ['PENDING_AUTHORIZATION', 'AUTHORIZED'] },
          authorizationStatus: 'PENDING',
        },
      }),
      prisma.whatsAppConversation.findMany({
        where: {
          lastMessageAt: { gte: messageStart },
        },
        select: {
          id: true,
          unreadCount: true,
          lastMessageAt: true,
        },
      }).catch(() => []),
      prisma.whatsAppMessage.findMany({
        where: {
          createdAt: { gte: messageStart },
        },
        select: {
          id: true,
          conversationId: true,
          direction: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }).catch(() => []),
    ]);

    const sessionDurationMinutes = Math.max(
      1,
      Number(agendaConfig?.slotDuration || agendaConfig?.timerDurationMinutes || 30)
    );
    const totalAvailableMinutesWeekly = professionals.reduce(
      (sum, professional) => sum + getScheduleMinutes(professional.workSchedule),
      0
    );
    const weeklyCapacity = totalAvailableMinutesWeekly / sessionDurationMinutes;
    const monthlyCapacity = weeklyCapacity * MONTHLY_WEEK_FACTOR;
    const currentCompletedTurns = currentMonthAppointments.filter((appointment) => appointment.status === COMPLETED_STATUS).length;
    const currentMonthTurns = currentMonthAppointments.length;
    const activePatients = new Set(currentMonthAppointments.map((appointment) => appointment.patientId).filter(Boolean)).size;
    const occupancyRate = monthlyCapacity > 0 ? (currentCompletedTurns / monthlyCapacity) * 100 : 0;
    const freeMonthlyCapacity = Math.max(0, monthlyCapacity - currentCompletedTurns);
    const farthestFutureAppointment = futureAppointments[futureAppointments.length - 1] || null;
    const coverageDays = farthestFutureAppointment?.date
      ? Math.max(0, differenceInCalendarDays(farthestFutureAppointment.date, today))
      : 0;
    const monthlyTrend = buildMonthlyRows(historicalAppointments, 6, now);
    const monthlyTurnGrowth = getAverageMonthlyGrowth(monthlyTrend, 'completedTurns');
    const monthlyTurnGrowthRate = getGrowthRate(monthlyTrend, 'completedTurns');
    const newPatientGrowth = getAverageMonthlyGrowth(monthlyTrend, 'newPatients');
    const newPatientGrowthRate = getGrowthRate(monthlyTrend, 'newPatients');
    const sustainedGrowth = hasSustainedGrowth(monthlyTrend, 'completedTurns');
    const responseMetrics = calculateResponseMetrics(messages, conversations);
    const estimatedAdminHoursWeekly = estimateAdminHoursWeekly({
      activePatients,
      delayedAuthorizations,
      inboundMessages: responseMetrics.inboundMessages,
      monthlyTurns: currentMonthTurns,
      pendingInvoices: invoices.filter((invoice) => getInvoicePending(invoice) > 0).length,
    });
    const receivables = buildReceivablesSummary(invoices, today);
    const cashBalances = getCashBalances(cashTransactions);
    const completedLast90 = historicalAppointments
      .filter((appointment) => appointment.status === COMPLETED_STATUS && new Date(appointment.date) >= addDays(today, -90))
      .length;
    const recentInvoiced = invoices
      .filter((invoice) => new Date(invoice.issueDate) >= addDays(today, -90))
      .reduce((sum, invoice) => sum + toNumber(invoice.totalAmount), 0);
    const currentMonthInvoiced = currentMonthInvoices.reduce((sum, invoice) => sum + toNumber(invoice.totalAmount), 0);
    const averageRevenuePerTurn = completedLast90 > 0
      ? recentInvoiced / completedLast90
      : (currentCompletedTurns > 0 ? currentMonthInvoiced / currentCompletedTurns : 0);
    const newKinesiologistWeeklyHours = getConfigValue(
      req.query.kinesiologistWeeklyHours,
      process.env.KAREH_KINESIOLOGIST_WEEKLY_HOURS,
      DEFAULT_NEW_KINESIOLOGIST_WEEKLY_HOURS
    );

    const financial = buildFinancialGuardrail({
      adminCost,
      cashBalances,
      fixedExpenses,
      kinesiologistCost,
      receivables,
      currentMonthInvoiced,
    });
    const administrative = buildAdministrativeDecision({
      activePatients,
      adminCost,
      averageResponseHours: responseMetrics.averageResponseHours,
      averageRevenuePerTurn,
      delayedAuthorizations,
      estimatedAdminHoursWeekly,
      monthlyTurnGrowth,
      monthlyTurns: currentMonthTurns,
      pendingMessages: responseMetrics.pendingMessages,
      receivables,
      sessionDurationMinutes,
    });
    const kinesiologist = buildKinesiologistDecision({
      averageRevenuePerTurn,
      coverageDays,
      currentCompletedTurns,
      freeMonthlyCapacity,
      kinesiologistCost,
      monthlyCapacity,
      monthlyTurnGrowth,
      newKinesiologistWeeklyHours,
      occupancyRate,
      sessionDurationMinutes,
      sustainedGrowth,
    });
    const risk = buildOverallRisk({ administrative, financial, kinesiologist });

    res.status(200).json({
      generatedAt: now,
      summary: {
        risk,
        averageRevenuePerTurn: roundCurrency(averageRevenuePerTurn),
        monthlyTurnGrowth: roundOne(monthlyTurnGrowth),
        monthlyTurnGrowthRate: roundOne(monthlyTurnGrowthRate),
        newPatientGrowth: roundOne(newPatientGrowth),
        newPatientGrowthRate: roundOne(newPatientGrowthRate),
        sustainedGrowth,
      },
      financial,
      administrative,
      kinesiologist,
      operational: {
        month: formatMonthLabel(monthStart),
        activePatients,
        currentMonthTurns,
        currentCompletedTurns,
        monthlyCapacity: roundOne(monthlyCapacity),
        freeMonthlyCapacity: roundOne(freeMonthlyCapacity),
        occupancyRate: roundOne(occupancyRate),
        coverageDays,
        coverageWeeks: roundOne(coverageDays / 7),
        professionals: professionals.map((professional) => ({
          id: professional.id,
          fullName: professional.fullName,
          availableHoursWeekly: roundOne(getScheduleMinutes(professional.workSchedule) / 60),
        })),
        response: responseMetrics,
      },
      monthlyTrend,
      assumptions: {
        fixedExpenses: roundCurrency(fixedExpenses),
        adminMonthlyCost: roundCurrency(adminCost),
        kinesiologistMonthlyCost: roundCurrency(kinesiologistCost),
        newKinesiologistWeeklyHours,
        sessionDurationMinutes,
        adminHoursFormula: 'Turnos, pacientes activos, mensajes entrantes, facturas pendientes y autorizaciones vencidas.',
        noRejectedDemandData: true,
      },
      missingData: [
        {
          key: 'real_admin_time_tracking',
          label: 'Horas administrativas reales',
          reason: 'La carga administrativa se estima; falta registrar tiempo real de Arturo por tarea.',
        },
        {
          key: 'rejected_patients',
          label: 'Pacientes rechazados',
          reason: 'No existe registro de demanda perdida por falta de horario; es crítico para decidir segundo kinesiólogo.',
        },
        {
          key: 'hiring_costs',
          label: 'Costos finales de contratación',
          reason: 'Los costos mensuales se toman de variables/query o defaults; deben ajustarse antes de decidir.',
        },
      ],
    });
  } catch (error) {
    throw createInternalError(error, 'Error al obtener motor de contratación');
  }
};
