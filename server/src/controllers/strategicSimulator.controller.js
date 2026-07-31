import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { createInternalError } from '../errors/AppError.js';

const DEFAULT_FIXED_EXPENSES = 1_193_000;
const DEFAULT_ADMIN_MONTHLY_COST = 250_000;
const DEFAULT_ADMIN_FREES_ARTURO_HOURS = 8;
const DEFAULT_ADMIN_FREES_KATI_HOURS = 2;
const DEFAULT_EXTRA_WEEKLY_HOURS = 5;
const DEFAULT_KINESIOLOGIST_MONTHLY_COST = 1_200_000;
const DEFAULT_KINESIOLOGIST_WEEKLY_HOURS = 15;
const DEFAULT_PRIVATE_FEE_INCREASE_PCT = 15;
const MONTHLY_WEEK_FACTOR = 4.33;
const DAYS_PER_MONTH = 30.44;
const COMPLETED_STATUS = 'COMPLETED';
const CANCELLED_STATUS = 'CANCELLED';
const CANCELLED_INVOICE_STATUS = 'CANCELLED';
const CASHFLOW_ACCOUNTS = ['CASH', 'MERCADO_PAGO'];

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundCurrency = (value) => Math.round(toNumber(value) * 100) / 100;
const roundOne = (value) => Math.round(toNumber(value) * 10) / 10;
const roundRate = (value) => Math.round(toNumber(value) * 100) / 100;

const normalizeUpper = (value) => String(value || '')
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase();

const formatMonthLabel = (date) => format(date, 'MMMM yyyy', { locale: es });

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

const resolvePayerBucket = (invoice = {}) => {
  const text = normalizeUpper(`${invoice.payerName || ''} ${invoice.obraSocial?.nombreOs || ''}`);

  if (invoice.payerType === 'PATIENT' || /PARTICULAR/.test(text)) {
    return { key: 'PARTICULAR', name: 'Particular' };
  }

  if (/PAMI/.test(text)) return { key: 'PAMI', name: 'PAMI' };
  if (/IOMA/.test(text)) return { key: 'IOMA', name: 'IOMA' };
  if (/SWISS/.test(text)) return { key: 'SWISS', name: 'Swiss Medical' };
  if (/SANCOR/.test(text)) return { key: 'SANCOR', name: 'Sancor' };

  return {
    key: invoice.obraSocialId || invoice.payerName || 'OTROS',
    name: invoice.payerName || invoice.obraSocial?.nombreOs || 'Otros',
  };
};

const getInvoicePending = (invoice) => Math.max(0, toNumber(invoice.totalAmount) - toNumber(invoice.paidAmount));

const getExpectedPaymentDate = (invoice, today) => {
  const expectedDate = invoice.expectedPaymentDate || invoice.dueDate || addDays(invoice.issueDate, 60);
  const normalized = startOfDay(expectedDate);
  return normalized < today ? today : normalized;
};

const allocateInvoiceRows = (invoices = []) => {
  const rows = [];

  invoices.forEach((invoice) => {
    const payer = resolvePayerBucket(invoice);
    const invoiceAmount = toNumber(invoice.totalAmount);
    const paidAmount = toNumber(invoice.paidAmount);
    const pendingAmount = getInvoicePending(invoice);
    const items = Array.isArray(invoice.items) && invoice.items.length > 0
      ? invoice.items
      : [{
          id: `${invoice.id}-unallocated`,
          patientId: invoice.patientId,
          patient: invoice.patient,
          professionalId: null,
          professional: null,
          totalAmount: invoice.totalAmount,
          serviceDate: invoice.issueDate,
        }];

    items.forEach((item) => {
      const itemAmount = toNumber(item.totalAmount);
      const ratio = invoiceAmount > 0 ? itemAmount / invoiceAmount : 0;
      const professional = item.professional || null;
      const patient = item.patient || invoice.patient || null;

      rows.push({
        invoiceId: invoice.id,
        issueDate: invoice.issueDate,
        serviceDate: item.serviceDate || invoice.issueDate,
        payerKey: payer.key,
        payerName: payer.name,
        patientId: item.patientId || patient?.id || invoice.patientId || null,
        patientName: patient?.fullName || null,
        professionalId: item.professionalId || professional?.id || null,
        professionalName: professional?.fullName || null,
        invoiced: itemAmount,
        collected: roundCurrency(paidAmount * ratio),
        pending: roundCurrency(pendingAmount * ratio),
      });
    });
  });

  return rows;
};

const sumRows = (rows = [], key) => rows.reduce((sum, row) => sum + toNumber(row[key]), 0);

const getRowsFromLastDays = (rows = [], today, days) => rows.filter((row) => (
  new Date(row.issueDate || row.serviceDate) >= addDays(today, -days)
));

const getReceivables = (invoices = [], today) => {
  const horizon30 = addDays(today, 30);
  const horizon60 = addDays(today, 60);
  const horizon90 = addDays(today, 90);

  return invoices.reduce((summary, invoice) => {
    const pending = getInvoicePending(invoice);
    if (pending <= 0) return summary;

    const expectedDate = getExpectedPaymentDate(invoice, today);
    summary.total += pending;
    if (expectedDate <= horizon30) summary.due30 += pending;
    if (expectedDate <= horizon60) summary.due60 += pending;
    if (expectedDate <= horizon90) summary.due90 += pending;

    return summary;
  }, {
    total: 0,
    due30: 0,
    due60: 0,
    due90: 0,
  });
};

const getMonthlyCapacity = ({ professionals, sessionDurationMinutes }) => {
  const weeklyMinutes = professionals.reduce(
    (sum, professional) => sum + getScheduleMinutes(professional.workSchedule),
    0
  );
  const weeklyCapacity = sessionDurationMinutes > 0 ? weeklyMinutes / sessionDurationMinutes : 0;

  return {
    weeklyMinutes,
    weeklyHours: weeklyMinutes / 60,
    weeklyCapacity,
    monthlyCapacity: weeklyCapacity * MONTHLY_WEEK_FACTOR,
  };
};

const getCurrentMonthAppointments = (appointments = [], monthStart, monthEnd) => appointments.filter((appointment) => (
  new Date(appointment.date) >= monthStart && new Date(appointment.date) < monthEnd
));

const getCompletedAppointments = (appointments = []) => appointments.filter((appointment) => appointment.status === COMPLETED_STATUS);

const groupRowsByPayer = (rows = []) => {
  const grouped = new Map();

  rows.forEach((row) => {
    const current = grouped.get(row.payerKey) || {
      payerKey: row.payerKey,
      payerName: row.payerName,
      invoiced: 0,
      collected: 0,
      pending: 0,
    };

    current.invoiced += row.invoiced;
    current.collected += row.collected;
    current.pending += row.pending;
    grouped.set(row.payerKey, current);
  });

  return Array.from(grouped.values())
    .map((row) => ({
      ...row,
      invoiced: roundCurrency(row.invoiced),
      collected: roundCurrency(row.collected),
      pending: roundCurrency(row.pending),
    }))
    .sort((left, right) => right.invoiced - left.invoiced);
};

const groupRowsByProfessional = (rows = []) => {
  const grouped = new Map();

  rows.forEach((row) => {
    const key = row.professionalId || row.professionalName || 'SIN_PROFESIONAL';
    const current = grouped.get(key) || {
      professionalId: row.professionalId,
      professionalName: row.professionalName || 'Sin profesional imputado',
      invoiced: 0,
      collected: 0,
      pending: 0,
    };

    current.invoiced += row.invoiced;
    current.collected += row.collected;
    current.pending += row.pending;
    grouped.set(key, current);
  });

  return Array.from(grouped.values())
    .map((row) => ({
      ...row,
      invoiced: roundCurrency(row.invoiced),
      collected: roundCurrency(row.collected),
      pending: roundCurrency(row.pending),
    }))
    .sort((left, right) => right.invoiced - left.invoiced);
};

const getRunwayMonths = ({ cash, fixedExpenses, monthlyRevenueDelta = 0 }) => {
  const monthlyBurn = fixedExpenses - monthlyRevenueDelta;
  if (monthlyBurn <= 0) return null;
  return roundOne(Math.max(0, cash) / monthlyBurn);
};

const buildScenario = ({
  key,
  title,
  category,
  recommendation,
  riskLevel,
  summary,
  assumptions = [],
  metrics = {},
  financialImpact = {},
}) => ({
  key,
  title,
  category,
  recommendation,
  riskLevel,
  summary,
  assumptions,
  metrics,
  financialImpact: {
    monthlyCost: roundCurrency(financialImpact.monthlyCost),
    monthlyRevenueDelta: roundCurrency(financialImpact.monthlyRevenueDelta),
    monthlyCashDelta: roundCurrency(financialImpact.monthlyCashDelta),
    annualRevenueDelta: roundCurrency(financialImpact.annualRevenueDelta),
    projectedCash30Delta: roundCurrency(financialImpact.projectedCash30Delta),
    projectedCash90Delta: roundCurrency(financialImpact.projectedCash90Delta),
    breakEvenTurns: financialImpact.breakEvenTurns ?? null,
    paybackMonths: financialImpact.paybackMonths ?? null,
    occupancyToBreakEven: financialImpact.occupancyToBreakEven ?? null,
  },
});

const buildAdminScenario = ({ baseline, params }) => {
  const additionalTurns = baseline.sessionDurationMinutes > 0
    ? (params.adminFreesKatiHours * 60 / baseline.sessionDurationMinutes) * MONTHLY_WEEK_FACTOR
    : 0;
  const revenuePotential = additionalTurns * baseline.averageRevenuePerTurn;
  const cashDelta = (revenuePotential * baseline.collectionRate) - params.adminCost;
  const breakEvenTurns = baseline.averageRevenuePerTurn > 0
    ? Math.ceil(params.adminCost / baseline.averageRevenuePerTurn)
    : null;
  const paybackMonths = cashDelta > 0 ? roundOne(params.adminCost / cashDelta) : null;

  return buildScenario({
    key: 'hire-admin',
    title: 'Contratar administrativa',
    category: 'Equipo',
    recommendation: cashDelta >= 0 && baseline.projectedCash90 > params.adminCost
      ? 'Viable si la capacidad liberada se convierte en turnos.'
      : 'Evaluar: libera carga, pero no se paga sola con los supuestos actuales.',
    riskLevel: cashDelta >= 0 ? 'MEDIO' : 'ALTO',
    summary: `Libera ${roundOne(params.adminFreesArturoHours)} hs/sem de Arturo y ${roundOne(params.adminFreesKatiHours)} hs/sem de Kati.`,
    assumptions: [
      `Costo mensual administrativo: $${params.adminCost.toLocaleString('es-AR')}.`,
      'Sólo las horas clínicas liberadas de Kati se convierten en facturación potencial.',
      'El impacto de Arturo se mide como menor cuello administrativo, no como facturación directa.',
    ],
    metrics: {
      arturoHoursFreedWeekly: roundOne(params.adminFreesArturoHours),
      katiHoursFreedWeekly: roundOne(params.adminFreesKatiHours),
      additionalMonthlyTurns: roundOne(additionalTurns),
      expectedRevenue: roundCurrency(revenuePotential),
      expectedCash: roundCurrency(revenuePotential * baseline.collectionRate),
    },
    financialImpact: {
      monthlyCost: params.adminCost,
      monthlyRevenueDelta: revenuePotential,
      monthlyCashDelta: cashDelta,
      annualRevenueDelta: revenuePotential * 12,
      projectedCash30Delta: cashDelta,
      projectedCash90Delta: cashDelta * 3,
      breakEvenTurns,
      paybackMonths,
    },
  });
};

const buildExpandHoursScenario = ({ baseline, params }) => {
  const additionalTurns = baseline.sessionDurationMinutes > 0
    ? (params.extraWeeklyHours * 60 / baseline.sessionDurationMinutes) * MONTHLY_WEEK_FACTOR
    : 0;
  const projectedUtilization = Math.min(0.85, Math.max(0.5, baseline.occupancyRate / 100));
  const expectedTurns = additionalTurns * projectedUtilization;
  const revenuePotential = additionalTurns * baseline.averageRevenuePerTurn;
  const expectedRevenue = expectedTurns * baseline.averageRevenuePerTurn;

  return buildScenario({
    key: 'expand-wednesday',
    title: 'Ampliar miércoles 14-19',
    category: 'Capacidad',
    recommendation: baseline.occupancyRate >= 60
      ? 'Probar expansión si hay demanda esperando o CRM recupera pacientes.'
      : 'Primero llenar capacidad actual antes de ampliar horario.',
    riskLevel: baseline.occupancyRate >= 70 ? 'BAJO' : 'MEDIO',
    summary: `Agrega ${roundOne(additionalTurns)} turnos máximos mensuales.`,
    assumptions: [
      `Se agregan ${roundOne(params.extraWeeklyHours)} horas semanales.`,
      `Utilización proyectada: ${roundOne(projectedUtilization * 100)}%.`,
      'No se agrega costo fijo de profesional si lo cubre Kati dentro de su disponibilidad.',
    ],
    metrics: {
      addedWeeklyHours: roundOne(params.extraWeeklyHours),
      addedMonthlyCapacity: roundOne(additionalTurns),
      expectedOccupiedTurns: roundOne(expectedTurns),
      fullPotentialRevenue: roundCurrency(revenuePotential),
      projectedUtilization: roundOne(projectedUtilization * 100),
    },
    financialImpact: {
      monthlyCost: 0,
      monthlyRevenueDelta: expectedRevenue,
      monthlyCashDelta: expectedRevenue * baseline.collectionRate,
      annualRevenueDelta: expectedRevenue * 12,
      projectedCash30Delta: expectedRevenue * baseline.collectionRate,
      projectedCash90Delta: expectedRevenue * baseline.collectionRate * 3,
    },
  });
};

const buildKinesiologistScenario = ({ baseline, params }) => {
  const additionalTurns = baseline.sessionDurationMinutes > 0
    ? (params.kinesiologistWeeklyHours * 60 / baseline.sessionDurationMinutes) * MONTHLY_WEEK_FACTOR
    : 0;
  const expectedTurnsAt60 = additionalTurns * 0.6;
  const expectedRevenueAt60 = expectedTurnsAt60 * baseline.averageRevenuePerTurn;
  const cashDelta = (expectedRevenueAt60 * baseline.collectionRate) - params.kinesiologistCost;
  const breakEvenTurns = baseline.averageRevenuePerTurn > 0
    ? Math.ceil(params.kinesiologistCost / baseline.averageRevenuePerTurn)
    : null;
  const occupancyToBreakEven = additionalTurns > 0 && breakEvenTurns
    ? roundOne((breakEvenTurns / additionalTurns) * 100)
    : null;
  const paybackMonths = cashDelta > 0 ? roundOne(params.kinesiologistCost / cashDelta) : null;

  return buildScenario({
    key: 'hire-kinesiologist',
    title: 'Incorporar kinesiólogo',
    category: 'Equipo clínico',
    recommendation: baseline.occupancyRate > 85
      ? 'Preparar incorporación si también hay demanda rechazada.'
      : 'No contratar todavía: primero ocupar capacidad actual y nuevas horas de Kati.',
    riskLevel: baseline.occupancyRate > 85 && cashDelta >= 0 ? 'MEDIO' : 'ALTO',
    summary: `Necesita ${breakEvenTurns || 'sin datos'} turnos mensuales para cubrir costo.`,
    assumptions: [
      `Costo mensual kinesiólogo: $${params.kinesiologistCost.toLocaleString('es-AR')}.`,
      `Carga simulada: ${roundOne(params.kinesiologistWeeklyHours)} hs/sem.`,
      'Se estima facturación al 60% de ocupación inicial.',
    ],
    metrics: {
      additionalMonthlyTurns: roundOne(additionalTurns),
      expectedTurnsAt60: roundOne(expectedTurnsAt60),
      expectedRevenueAt60: roundCurrency(expectedRevenueAt60),
      breakEvenTurns,
      occupancyToBreakEven,
    },
    financialImpact: {
      monthlyCost: params.kinesiologistCost,
      monthlyRevenueDelta: expectedRevenueAt60,
      monthlyCashDelta: cashDelta,
      annualRevenueDelta: expectedRevenueAt60 * 12,
      projectedCash30Delta: cashDelta,
      projectedCash90Delta: cashDelta * 3,
      breakEvenTurns,
      paybackMonths,
      occupancyToBreakEven,
    },
  });
};

const buildPrivateFeeScenario = ({ baseline, params }) => {
  const monthlyPrivateRevenue = baseline.privateMonthlyRevenue;
  const monthlyImpact = monthlyPrivateRevenue * (params.privateFeeIncreasePct / 100);
  const currentBreakEvenTurns = baseline.averageRevenuePerTurn > 0
    ? Math.ceil(baseline.fixedExpenses / baseline.averageRevenuePerTurn)
    : null;
  const adjustedAverageRevenue = baseline.completedLast90 > 0
    ? ((baseline.recentInvoiced + (baseline.privateRecentRevenue * (params.privateFeeIncreasePct / 100))) / baseline.completedLast90)
    : baseline.averageRevenuePerTurn;
  const newBreakEvenTurns = adjustedAverageRevenue > 0
    ? Math.ceil(baseline.fixedExpenses / adjustedAverageRevenue)
    : null;

  return buildScenario({
    key: 'increase-private-fee',
    title: 'Aumentar arancel particular',
    category: 'Precio',
    recommendation: monthlyPrivateRevenue > 0
      ? 'Viable con comunicación cuidada y seguimiento de abandono particular.'
      : 'Sin base particular suficiente para que impacte significativamente.',
    riskLevel: monthlyPrivateRevenue > 0 ? 'BAJO' : 'MEDIO',
    summary: `Aumento simulado de ${roundOne(params.privateFeeIncreasePct)}% sobre particulares.`,
    assumptions: [
      'No modela elasticidad ni pérdida de pacientes por precio.',
      'Aplica sólo sobre facturación particular reciente.',
      'El impacto en caja depende del mix efectivo/transferencia real.',
    ],
    metrics: {
      privateMonthlyRevenue: roundCurrency(monthlyPrivateRevenue),
      feeIncreasePct: roundOne(params.privateFeeIncreasePct),
      currentBreakEvenTurns,
      newBreakEvenTurns,
      breakEvenTurnsReduction: currentBreakEvenTurns && newBreakEvenTurns ? currentBreakEvenTurns - newBreakEvenTurns : null,
    },
    financialImpact: {
      monthlyCost: 0,
      monthlyRevenueDelta: monthlyImpact,
      monthlyCashDelta: monthlyImpact * baseline.collectionRate,
      annualRevenueDelta: monthlyImpact * 12,
      projectedCash30Delta: monthlyImpact * baseline.collectionRate,
      projectedCash90Delta: monthlyImpact * baseline.collectionRate * 3,
    },
  });
};

const buildLosePayerScenario = ({ baseline }) => {
  const payer = baseline.topPayer;
  const monthlyRevenueLoss = payer ? payer.monthlyInvoiced : 0;
  const monthlyCashLoss = payer ? payer.monthlyCollected : 0;
  const projectedCash90 = baseline.projectedCash90 - (monthlyCashLoss * 3);
  const riskLevel = projectedCash90 < 0 || (payer?.share || 0) >= 50 ? 'ALTO' : ((payer?.share || 0) >= 30 ? 'MEDIO' : 'BAJO');

  return buildScenario({
    key: 'lose-top-payer',
    title: `Perder ${payer?.payerName || 'obra social principal'}`,
    category: 'Riesgo pagador',
    recommendation: riskLevel === 'ALTO'
      ? 'Riesgo crítico: reducir dependencia antes de sumar costos fijos.'
      : 'Riesgo manejable, pero conviene diversificar pagadores.',
    riskLevel,
    summary: payer
      ? `${payer.payerName} representa ${roundOne(payer.share)}% de la facturación reciente.`
      : 'No hay pagador dominante medible.',
    assumptions: [
      'Se simula pérdida de facturación futura, no incobrabilidad de facturas ya emitidas.',
      'El impacto se calcula con promedio de los últimos 90 días.',
      'No modela reemplazo de pacientes por particulares u otras obras sociales.',
    ],
    metrics: {
      payerName: payer?.payerName || null,
      payerShare: roundOne(payer?.share || 0),
      monthlyRevenueLoss: roundCurrency(monthlyRevenueLoss),
      monthlyCashLoss: roundCurrency(monthlyCashLoss),
      projectedCash90AfterLoss: roundCurrency(projectedCash90),
    },
    financialImpact: {
      monthlyCost: 0,
      monthlyRevenueDelta: -monthlyRevenueLoss,
      monthlyCashDelta: -monthlyCashLoss,
      annualRevenueDelta: -(monthlyRevenueLoss * 12),
      projectedCash30Delta: -monthlyCashLoss,
      projectedCash90Delta: -(monthlyCashLoss * 3),
    },
  });
};

const buildKatiAbsenceScenario = ({ baseline }) => {
  const professional = baseline.katiProfessional || baseline.topProfessional;
  const monthlyRevenueLoss = professional ? professional.monthlyInvoiced : 0;
  const monthlyCashLoss = professional ? professional.monthlyCollected : 0;
  const monthlyCapacityLoss = professional ? professional.monthlyCapacity : 0;
  const cashAfter30 = baseline.currentCash + baseline.receivables.due30 - baseline.fixedExpenses - monthlyCashLoss;
  const runway = getRunwayMonths({
    cash: baseline.currentCash + baseline.receivables.due90,
    fixedExpenses: baseline.fixedExpenses,
    monthlyRevenueDelta: -monthlyCashLoss,
  });
  const riskLevel = cashAfter30 < 0 || (professional?.share || 0) >= 60 ? 'ALTO' : 'MEDIO';

  return buildScenario({
    key: 'kati-absent-30',
    title: `${professional?.professionalName || 'Profesional principal'} no atiende 30 días`,
    category: 'Riesgo operativo',
    recommendation: riskLevel === 'ALTO'
      ? 'Riesgo operativo alto: diseñar cobertura clínica antes de depender de una sola agenda.'
      : 'Riesgo relevante: documentar cobertura mínima y priorizar pacientes VIP.',
    riskLevel,
    summary: `Pérdida mensual estimada: ${roundCurrency(monthlyRevenueLoss).toLocaleString('es-AR')}.`,
    assumptions: [
      'Usa facturación imputada al profesional en los últimos 90 días.',
      'Si no se identifica Kati, usa el profesional con mayor facturación imputada.',
      'No modela reprogramación posterior ni sustitución clínica.',
    ],
    metrics: {
      professionalName: professional?.professionalName || null,
      professionalShare: roundOne(professional?.share || 0),
      monthlyCapacityLoss: roundOne(monthlyCapacityLoss),
      monthlyRevenueLoss: roundCurrency(monthlyRevenueLoss),
      cashAfter30: roundCurrency(cashAfter30),
      runwayMonthsAfterEvent: runway,
    },
    financialImpact: {
      monthlyCost: 0,
      monthlyRevenueDelta: -monthlyRevenueLoss,
      monthlyCashDelta: -monthlyCashLoss,
      annualRevenueDelta: -(monthlyRevenueLoss * 12),
      projectedCash30Delta: -monthlyCashLoss,
      projectedCash90Delta: -(monthlyCashLoss * 3),
    },
  });
};

export const getStrategicSimulator = async (req, res, prisma) => {
  try {
    const now = new Date();
    const today = startOfDay(now);
    const monthStart = startOfMonth(now);
    const monthEnd = addMonths(monthStart, 1);
    const last90Start = addDays(today, -90);
    const fixedExpenses = getFixedExpenses(req);
    const params = {
      adminCost: getConfigValue(req.query.adminCost, process.env.KAREH_ADMIN_MONTHLY_COST, DEFAULT_ADMIN_MONTHLY_COST),
      adminFreesArturoHours: getConfigValue(req.query.adminFreesArturoHours, process.env.KAREH_ADMIN_FREES_ARTURO_HOURS, DEFAULT_ADMIN_FREES_ARTURO_HOURS),
      adminFreesKatiHours: getConfigValue(req.query.adminFreesKatiHours, process.env.KAREH_ADMIN_FREES_KATI_HOURS, DEFAULT_ADMIN_FREES_KATI_HOURS),
      extraWeeklyHours: getConfigValue(req.query.extraWeeklyHours, process.env.KAREH_EXTRA_WEEKLY_HOURS, DEFAULT_EXTRA_WEEKLY_HOURS),
      kinesiologistCost: getConfigValue(req.query.kinesiologistCost, process.env.KAREH_KINESIOLOGIST_MONTHLY_COST, DEFAULT_KINESIOLOGIST_MONTHLY_COST),
      kinesiologistWeeklyHours: getConfigValue(req.query.kinesiologistWeeklyHours, process.env.KAREH_KINESIOLOGIST_WEEKLY_HOURS, DEFAULT_KINESIOLOGIST_WEEKLY_HOURS),
      privateFeeIncreasePct: getConfigValue(req.query.privateFeeIncreasePct, process.env.KAREH_PRIVATE_FEE_INCREASE_PCT, DEFAULT_PRIVATE_FEE_INCREASE_PCT),
    };

    const [
      agendaConfig,
      professionals,
      appointments,
      invoices,
      cashTransactions,
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
          date: { gte: last90Start },
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
      prisma.billingInvoice.findMany({
        where: {
          status: { not: CANCELLED_INVOICE_STATUS },
        },
        include: {
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
            },
          },
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
    ]);

    const sessionDurationMinutes = Math.max(
      1,
      Number(agendaConfig?.slotDuration || agendaConfig?.timerDurationMinutes || 30)
    );
    const capacity = getMonthlyCapacity({ professionals, sessionDurationMinutes });
    const currentMonthAppointments = getCurrentMonthAppointments(appointments, monthStart, monthEnd);
    const currentCompletedTurns = getCompletedAppointments(currentMonthAppointments).length;
    const completedLast90 = getCompletedAppointments(appointments).length;
    const invoiceRows = allocateInvoiceRows(invoices);
    const recentRows = getRowsFromLastDays(invoiceRows, today, 90);
    const recentInvoiced = sumRows(recentRows, 'invoiced');
    const recentCollected = sumRows(recentRows, 'collected');
    const recentPending = sumRows(recentRows, 'pending');
    const recentMonths = 90 / DAYS_PER_MONTH;
    const currentCash = getCashBalances(cashTransactions);
    const receivables = getReceivables(invoices, today);
    const monthlyRevenue = recentInvoiced / recentMonths;
    const monthlyCollected = recentCollected / recentMonths;
    const averageRevenuePerTurn = completedLast90 > 0 ? recentInvoiced / completedLast90 : 0;
    const collectionRate = recentInvoiced > 0 ? Math.min(1, Math.max(0, recentCollected / recentInvoiced)) : 1;
    const occupancyRate = capacity.monthlyCapacity > 0 ? (currentCompletedTurns / capacity.monthlyCapacity) * 100 : 0;
    const projectedCash30 = currentCash.total + receivables.due30 - fixedExpenses;
    const projectedCash90 = currentCash.total + receivables.due90 - (fixedExpenses * 3);
    const payerRows = groupRowsByPayer(recentRows);
    const professionalRows = groupRowsByProfessional(recentRows);
    const totalRecentByPayer = payerRows.reduce((sum, row) => sum + row.invoiced, 0);
    const totalRecentByProfessional = professionalRows.reduce((sum, row) => sum + row.invoiced, 0);
    const payerRowsWithShares = payerRows.map((row) => ({
      ...row,
      monthlyInvoiced: roundCurrency(row.invoiced / recentMonths),
      monthlyCollected: roundCurrency(row.collected / recentMonths),
      share: totalRecentByPayer > 0 ? (row.invoiced / totalRecentByPayer) * 100 : 0,
    }));
    const professionalCapacityById = new Map(professionals.map((professional) => [
      professional.id,
      (getScheduleMinutes(professional.workSchedule) / sessionDurationMinutes) * MONTHLY_WEEK_FACTOR,
    ]));
    const professionalRowsWithShares = professionalRows.map((row) => ({
      ...row,
      monthlyInvoiced: roundCurrency(row.invoiced / recentMonths),
      monthlyCollected: roundCurrency(row.collected / recentMonths),
      monthlyCapacity: roundOne(professionalCapacityById.get(row.professionalId) || 0),
      share: totalRecentByProfessional > 0 ? (row.invoiced / totalRecentByProfessional) * 100 : 0,
    }));
    const topPayer = payerRowsWithShares[0] || null;
    const topProfessional = professionalRowsWithShares[0] || null;
    const katiProfessional = professionalRowsWithShares.find((row) => /KATI|CATI|KATHERINE|KATERINA/.test(normalizeUpper(row.professionalName))) || null;
    const privateRecentRows = recentRows.filter((row) => row.payerKey === 'PARTICULAR');
    const privateRecentRevenue = sumRows(privateRecentRows, 'invoiced');

    const baseline = {
      averageRevenuePerTurn,
      collectionRate,
      completedLast90,
      currentCash: currentCash.total,
      fixedExpenses,
      monthlyCollected,
      monthlyRevenue,
      occupancyRate,
      projectedCash30,
      projectedCash90,
      privateMonthlyRevenue: privateRecentRevenue / recentMonths,
      privateRecentRevenue,
      recentInvoiced,
      recentPending,
      receivables,
      sessionDurationMinutes,
      topPayer,
      topProfessional,
      katiProfessional,
    };

    const scenarios = [
      buildAdminScenario({ baseline, params }),
      buildExpandHoursScenario({ baseline, params }),
      buildKinesiologistScenario({ baseline, params }),
      buildPrivateFeeScenario({ baseline, params }),
      buildLosePayerScenario({ baseline }),
      buildKatiAbsenceScenario({ baseline }),
    ];

    res.status(200).json({
      generatedAt: now,
      baseline: {
        month: formatMonthLabel(monthStart),
        currentCash: currentCash.total,
        accounts: currentCash.accounts,
        fixedExpenses: roundCurrency(fixedExpenses),
        receivables: {
          total: roundCurrency(receivables.total),
          due30: roundCurrency(receivables.due30),
          due60: roundCurrency(receivables.due60),
          due90: roundCurrency(receivables.due90),
        },
        projectedCash30: roundCurrency(projectedCash30),
        projectedCash90: roundCurrency(projectedCash90),
        monthlyRevenue: roundCurrency(monthlyRevenue),
        monthlyCollected: roundCurrency(monthlyCollected),
        averageRevenuePerTurn: roundCurrency(averageRevenuePerTurn),
        collectionRate: roundRate(collectionRate * 100),
        sessionDurationMinutes,
        currentCompletedTurns,
        monthlyCapacity: roundOne(capacity.monthlyCapacity),
        freeMonthlyCapacity: roundOne(Math.max(0, capacity.monthlyCapacity - currentCompletedTurns)),
        occupancyRate: roundOne(occupancyRate),
        topPayer,
        topProfessional: katiProfessional || topProfessional,
      },
      scenarios,
      assumptions: {
        adminCost: roundCurrency(params.adminCost),
        adminFreesArturoHours: roundOne(params.adminFreesArturoHours),
        adminFreesKatiHours: roundOne(params.adminFreesKatiHours),
        extraWeeklyHours: roundOne(params.extraWeeklyHours),
        kinesiologistCost: roundCurrency(params.kinesiologistCost),
        kinesiologistWeeklyHours: roundOne(params.kinesiologistWeeklyHours),
        privateFeeIncreasePct: roundOne(params.privateFeeIncreasePct),
      },
      missingData: [
        {
          key: 'price_elasticity',
          label: 'Elasticidad por aumento de arancel',
          reason: 'El impacto de precio no descuenta posible pérdida de pacientes particulares.',
        },
        {
          key: 'rejected_demand',
          label: 'Demanda rechazada',
          reason: 'Sin pacientes rechazados por falta de horario, el escenario de kinesiólogo es conservador.',
        },
        {
          key: 'replacement_capacity',
          label: 'Cobertura clínica alternativa',
          reason: 'La ausencia de Kati no modela reprogramaciones ni reemplazos temporales.',
        },
      ],
    });
  } catch (error) {
    throw createInternalError(error, 'Error al obtener simulador estratégico');
  }
};
