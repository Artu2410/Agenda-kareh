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
const DAYS_PER_MONTH = 30.44;
const CASHFLOW_ACCOUNTS = ['CASH', 'MERCADO_PAGO'];
const CANCELLED_INVOICE_STATUS = 'CANCELLED';
const HORIZON_DAYS = [30, 60, 90];

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundCurrency = (value) => Math.round(toNumber(value) * 100) / 100;
const roundOne = (value) => Math.round(toNumber(value) * 10) / 10;

const normalizeText = (value) => String(value || '').trim();
const normalizeUpper = (value) => normalizeText(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase();

const getFixedExpenses = (req) => {
  const requested = toNumber(req.query.fixedExpenses);
  if (requested > 0) return requested;

  const configured = toNumber(process.env.KAREH_FIXED_EXPENSES_MONTHLY);
  return configured > 0 ? configured : DEFAULT_FIXED_EXPENSES;
};

const formatMonthLabel = (date) => format(date, 'MMMM yyyy', { locale: es });
const formatDayKey = (date) => format(startOfDay(date), 'yyyy-MM-dd');

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

const getInvoiceExpectedDate = (invoice, today) => {
  const expectedDate = invoice.expectedPaymentDate || invoice.dueDate || addDays(invoice.issueDate, 60);
  const normalizedExpectedDate = startOfDay(expectedDate);
  const overdue = normalizedExpectedDate < today;

  return {
    expectedDate: normalizedExpectedDate,
    forecastDate: overdue ? today : normalizedExpectedDate,
    overdue,
    overdueDays: overdue ? differenceInCalendarDays(today, normalizedExpectedDate) : 0,
  };
};

const getInvoicePending = (invoice) => Math.max(0, toNumber(invoice.totalAmount) - toNumber(invoice.paidAmount));

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

const mapReceivables = (invoices = [], today) => invoices
  .map((invoice) => {
    const pendingAmount = getInvoicePending(invoice);
    if (pendingAmount <= 0) return null;

    const payer = resolvePayerBucket(invoice);
    const dates = getInvoiceExpectedDate(invoice, today);

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      payerKey: payer.key,
      payerName: payer.name,
      patientName: invoice.patient?.fullName || null,
      issueDate: invoice.issueDate,
      expectedPaymentDate: dates.expectedDate,
      forecastDate: dates.forecastDate,
      overdue: dates.overdue,
      overdueDays: dates.overdueDays,
      totalAmount: roundCurrency(invoice.totalAmount),
      paidAmount: roundCurrency(invoice.paidAmount),
      pendingAmount: roundCurrency(pendingAmount),
    };
  })
  .filter(Boolean)
  .sort((left, right) => left.forecastDate - right.forecastDate);

const summarizeReceivablesByPayer = (receivables = []) => {
  const rowsByPayer = new Map();

  receivables.forEach((receivable) => {
    const current = rowsByPayer.get(receivable.payerKey) || {
      payerKey: receivable.payerKey,
      payerName: receivable.payerName,
      invoices: 0,
      invoiced: 0,
      collected: 0,
      pending: 0,
      overduePending: 0,
      nextExpectedPaymentDate: null,
      latestExpectedPaymentDate: null,
    };

    current.invoices += 1;
    current.invoiced += receivable.totalAmount;
    current.collected += receivable.paidAmount;
    current.pending += receivable.pendingAmount;
    if (receivable.overdue) current.overduePending += receivable.pendingAmount;

    if (!current.nextExpectedPaymentDate || receivable.forecastDate < current.nextExpectedPaymentDate) {
      current.nextExpectedPaymentDate = receivable.forecastDate;
    }

    if (!current.latestExpectedPaymentDate || receivable.forecastDate > current.latestExpectedPaymentDate) {
      current.latestExpectedPaymentDate = receivable.forecastDate;
    }

    rowsByPayer.set(receivable.payerKey, current);
  });

  const totalPending = receivables.reduce((sum, receivable) => sum + receivable.pendingAmount, 0);

  return Array.from(rowsByPayer.values())
    .map((row) => ({
      ...row,
      invoiced: roundCurrency(row.invoiced),
      collected: roundCurrency(row.collected),
      pending: roundCurrency(row.pending),
      overduePending: roundCurrency(row.overduePending),
      pendingShare: totalPending > 0 ? roundOne((row.pending / totalPending) * 100) : 0,
    }))
    .sort((left, right) => right.pending - left.pending);
};

const isDateInRange = (date, start, end, inclusiveEnd = false) => {
  const time = startOfDay(date).getTime();
  const startTime = startOfDay(start).getTime();
  const endTime = startOfDay(end).getTime();
  return time >= startTime && (inclusiveEnd ? time <= endTime : time < endTime);
};

const sumReceivablesInRange = (receivables = [], start, end, inclusiveEnd = false) => receivables
  .filter((receivable) => isDateInRange(receivable.forecastDate, start, end, inclusiveEnd))
  .reduce((sum, receivable) => sum + receivable.pendingAmount, 0);

const getProjectedExpensesForDays = (fixedExpenses, days) => fixedExpenses * (Math.max(0, days) / DAYS_PER_MONTH);

const buildHorizonProjection = ({
  currentCash,
  fixedExpenses,
  monthlyRevenueAdjustment = 0,
  receivables,
  today,
}) => HORIZON_DAYS.map((days) => {
  const endDate = addDays(today, days);
  const collections = sumReceivablesInRange(receivables, today, endDate, true);
  const projectedExpenses = getProjectedExpensesForDays(fixedExpenses, days);
  const revenueAdjustment = monthlyRevenueAdjustment * (days / DAYS_PER_MONTH);

  return {
    days,
    date: endDate,
    collections: roundCurrency(collections),
    projectedExpenses: roundCurrency(projectedExpenses),
    revenueAdjustment: roundCurrency(revenueAdjustment),
    projectedCash: roundCurrency(currentCash + collections + revenueAdjustment - projectedExpenses),
  };
});

const buildCurrentMonthRemainder = ({
  currentCash,
  fixedExpenses,
  monthlyRevenueAdjustment = 0,
  receivables,
  today,
}) => {
  const currentMonthStart = startOfMonth(today);
  const nextMonthStart = addMonths(currentMonthStart, 1);
  const remainingDays = Math.max(0, differenceInCalendarDays(nextMonthStart, today));
  const totalMonthDays = Math.max(1, differenceInCalendarDays(nextMonthStart, currentMonthStart));
  const collections = sumReceivablesInRange(receivables, today, nextMonthStart);
  const projectedExpenses = fixedExpenses * (remainingDays / totalMonthDays);
  const revenueAdjustment = monthlyRevenueAdjustment * (remainingDays / DAYS_PER_MONTH);

  return {
    month: formatMonthLabel(currentMonthStart),
    startDate: today,
    endDate: nextMonthStart,
    startingCash: roundCurrency(currentCash),
    collections: roundCurrency(collections),
    projectedExpenses: roundCurrency(projectedExpenses),
    revenueAdjustment: roundCurrency(revenueAdjustment),
    endingCash: roundCurrency(currentCash + collections + revenueAdjustment - projectedExpenses),
  };
};

const buildMonthlyFlow = ({
  fixedExpenses,
  initialCash,
  monthlyRevenueAdjustment = 0,
  months = 4,
  receivables,
  today,
}) => {
  let runningCash = initialCash;
  const firstProjectedMonth = addMonths(startOfMonth(today), 1);

  return Array.from({ length: months }, (_, index) => {
    const monthStart = addMonths(firstProjectedMonth, index);
    const monthEnd = addMonths(monthStart, 1);
    const collections = sumReceivablesInRange(receivables, monthStart, monthEnd);
    const startingCash = runningCash;
    const endingCash = startingCash + collections + monthlyRevenueAdjustment - fixedExpenses;

    runningCash = endingCash;

    return {
      month: formatMonthLabel(monthStart),
      startDate: monthStart,
      endDate: monthEnd,
      startingCash: roundCurrency(startingCash),
      collections: roundCurrency(collections),
      projectedExpenses: roundCurrency(fixedExpenses),
      revenueAdjustment: roundCurrency(monthlyRevenueAdjustment),
      endingCash: roundCurrency(endingCash),
    };
  });
};

const simulateRunway = ({
  currentCash,
  fixedExpenses,
  maxDays = 730,
  monthlyRevenueAdjustment = 0,
  receivables,
  today,
}) => {
  const collectionsByDay = new Map();
  const dailyExpense = fixedExpenses / DAYS_PER_MONTH;
  const dailyRevenueAdjustment = monthlyRevenueAdjustment / DAYS_PER_MONTH;
  let cash = currentCash;

  receivables.forEach((receivable) => {
    const key = formatDayKey(receivable.forecastDate);
    collectionsByDay.set(key, (collectionsByDay.get(key) || 0) + receivable.pendingAmount);
  });

  for (let dayIndex = 0; dayIndex <= maxDays; dayIndex += 1) {
    const date = addDays(today, dayIndex);
    cash += collectionsByDay.get(formatDayKey(date)) || 0;
    cash += dailyRevenueAdjustment;
    cash -= dailyExpense;

    if (cash < 0) {
      return {
        status: 'SHORTFALL',
        days: dayIndex,
        months: roundOne(dayIndex / DAYS_PER_MONTH),
        shortfallDate: date,
        endingCash: roundCurrency(cash),
        answer: `Sin nuevos pacientes, Kareh cubre aproximadamente ${roundOne(dayIndex / DAYS_PER_MONTH)} meses.`,
      };
    }
  }

  return {
    status: 'STABLE',
    days: maxDays,
    months: roundOne(maxDays / DAYS_PER_MONTH),
    shortfallDate: null,
    endingCash: roundCurrency(cash),
    answer: `Sin nuevos pacientes, Kareh supera ${roundOne(maxDays / DAYS_PER_MONTH)} meses con la caja y cuentas por cobrar actuales.`,
  };
};

const buildProjectionSnapshot = ({
  currentCash,
  fixedExpenses,
  monthlyRevenueAdjustment = 0,
  receivables,
  today,
}) => {
  const horizons = buildHorizonProjection({
    currentCash,
    fixedExpenses,
    monthlyRevenueAdjustment,
    receivables,
    today,
  });
  const currentMonthRemainder = buildCurrentMonthRemainder({
    currentCash,
    fixedExpenses,
    monthlyRevenueAdjustment,
    receivables,
    today,
  });
  const monthlyFlow = buildMonthlyFlow({
    fixedExpenses,
    initialCash: currentMonthRemainder.endingCash,
    monthlyRevenueAdjustment,
    receivables,
    today,
  });
  const runway = simulateRunway({
    currentCash,
    fixedExpenses,
    monthlyRevenueAdjustment,
    receivables,
    today,
  });

  return {
    horizons,
    currentMonthRemainder,
    monthlyFlow,
    runway,
  };
};

const shiftReceivables = (receivables = [], predicate, days) => receivables.map((receivable) => (
  predicate(receivable)
    ? {
        ...receivable,
        forecastDate: addDays(receivable.forecastDate, days),
        stressShiftDays: days,
      }
    : receivable
));

const invoiceItemRows = (invoices = []) => {
  const rows = [];

  invoices.forEach((invoice) => {
    if (!Array.isArray(invoice.items) || invoice.items.length === 0) {
      rows.push({
        professionalName: null,
        amount: toNumber(invoice.totalAmount),
      });
      return;
    }

    invoice.items.forEach((item) => {
      rows.push({
        professionalName: item.professional?.fullName || null,
        amount: toNumber(item.totalAmount),
      });
    });
  });

  return rows;
};

const estimateKatiRevenueRisk = (recentInvoices = []) => {
  const rows = invoiceItemRows(recentInvoices);
  const katiRows = rows.filter((row) => /KATI|KATHERINE|KATERINA|CATI/.test(normalizeUpper(row.professionalName)));
  const sourceRows = katiRows.length > 0 ? katiRows : rows;
  const total = sourceRows.reduce((sum, row) => sum + row.amount, 0);
  const monthlyAverage = total / (90 / DAYS_PER_MONTH);
  const lostMonthlyRevenue = monthlyAverage * 0.2;

  return {
    monthlyAverage: roundCurrency(monthlyAverage),
    lostMonthlyRevenue: roundCurrency(lostMonthlyRevenue),
    source: katiRows.length > 0
      ? 'Facturación imputada a Kati en los últimos 90 días.'
      : 'No hay imputación suficiente por profesional; se usa facturación total reciente como proxy conservador.',
    confidence: katiRows.length > 0 ? 'high' : 'medium',
  };
};

const compareScenario = (scenario, base) => {
  const baseCashAt90 = base.horizons.find((horizon) => horizon.days === 90)?.projectedCash || 0;
  const scenarioCashAt90 = scenario.horizons.find((horizon) => horizon.days === 90)?.projectedCash || 0;

  return {
    cashAt90Delta: roundCurrency(scenarioCashAt90 - baseCashAt90),
    runwayMonthsDelta: roundOne((scenario.runway?.months || 0) - (base.runway?.months || 0)),
  };
};

const buildDecisionLayer = ({
  baseProjection,
  cashBalances,
  fixedExpenses,
  payerRows,
  receivables,
}) => {
  const warnings = [];
  const recommendations = [];
  const totalPending = receivables.reduce((sum, receivable) => sum + receivable.pendingAmount, 0);
  const overduePending = receivables
    .filter((receivable) => receivable.overdue)
    .reduce((sum, receivable) => sum + receivable.pendingAmount, 0);
  const cashAt90 = baseProjection.horizons.find((horizon) => horizon.days === 90)?.projectedCash || 0;
  const topPayer = payerRows[0];

  if (cashBalances.total < fixedExpenses) {
    warnings.push('La caja actual no cubre un mes completo de gastos fijos.');
    recommendations.push('Priorizar cobros pendientes antes de asumir nuevos gastos fijos.');
  }

  if (totalPending > cashBalances.total) {
    warnings.push('El valor por cobrar supera la caja disponible: no evaluar Kareh sólo por caja.');
    recommendations.push('Revisar semanalmente cuentas por cobrar y fecha esperada de ingreso.');
  }

  if (overduePending > 0) {
    warnings.push('Hay cuentas por cobrar vencidas o sin fecha confiable futura.');
    recommendations.push('Separar vencidos por obra social y hacer seguimiento operativo de liquidaciones.');
  }

  if (topPayer?.pendingShare >= 50) {
    warnings.push(`${topPayer.payerName} concentra ${topPayer.pendingShare}% del pendiente de cobro.`);
    recommendations.push('Reducir dependencia financiera monitoreando pagadores alternativos y particulares.');
  }

  if (cashAt90 < 0) {
    warnings.push('La caja proyectada a 90 días queda negativa con los gastos actuales.');
    recommendations.push('Definir plan de cobranza y limitar inversiones hasta estabilizar caja proyectada.');
  }

  if ((baseProjection.runway?.months || 0) < 2) {
    warnings.push('El runway estimado es menor a 2 meses.');
    recommendations.push('No contratar estructura fija adicional hasta mejorar cobranza o caja inicial.');
  }

  return {
    status: warnings.length === 0 ? 'SANO' : warnings.length <= 2 ? 'ATENCION' : 'RIESGO',
    summary: warnings.length === 0
      ? 'La proyección no muestra alertas críticas con la información disponible.'
      : warnings[0],
    warnings,
    recommendations: [...new Set(recommendations)],
  };
};

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
      professional: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  },
};

export const getFinancialProjectionSummary = async (req, res, prisma) => {
  try {
    const today = startOfDay(new Date());
    const fixedExpenses = getFixedExpenses(req);
    const nextWeek = addDays(today, 7);
    const nextMonthStart = addMonths(startOfMonth(today), 1);
    const nextMonthEnd = addMonths(nextMonthStart, 1);
    const ninetyDaysStart = addDays(today, -90);

    const [
      transactions,
      invoices,
      recentInvoices,
    ] = await Promise.all([
      prisma.cashFlow.findMany({
        select: {
          type: true,
          amount: true,
          account: true,
          destinationAccount: true,
        },
      }),
      prisma.billingInvoice.findMany({
        where: {
          status: { not: CANCELLED_INVOICE_STATUS },
        },
        include: invoiceInclude,
        orderBy: { issueDate: 'desc' },
      }),
      prisma.billingInvoice.findMany({
        where: {
          status: { not: CANCELLED_INVOICE_STATUS },
          issueDate: {
            gte: ninetyDaysStart,
            lt: addDays(today, 1),
          },
        },
        include: invoiceInclude,
      }),
    ]);

    const cashBalances = getCashBalances(transactions);
    const receivables = mapReceivables(invoices, today);
    const receivablesByPayer = summarizeReceivablesByPayer(receivables);
    const totalPending = receivables.reduce((sum, receivable) => sum + receivable.pendingAmount, 0);
    const overduePending = receivables
      .filter((receivable) => receivable.overdue)
      .reduce((sum, receivable) => sum + receivable.pendingAmount, 0);
    const baseProjection = buildProjectionSnapshot({
      currentCash: cashBalances.total,
      fixedExpenses,
      receivables,
      today,
    });
    const katiRevenueRisk = estimateKatiRevenueRisk(recentInvoices);

    const scenarios = [
      {
        key: 'ioma-delay-30',
        title: 'IOMA paga 30 días tarde',
        description: 'Desplaza todos los pendientes IOMA 30 días hacia adelante.',
        assumptions: ['Sólo cambia la fecha de cobro de IOMA.', 'No se agregan pacientes nuevos.'],
        projection: buildProjectionSnapshot({
          currentCash: cashBalances.total,
          fixedExpenses,
          receivables: shiftReceivables(receivables, (row) => row.payerKey === 'IOMA', 30),
          today,
        }),
      },
      {
        key: 'swiss-delay-90',
        title: 'Swiss demora 90 días',
        description: 'Desplaza todos los pendientes Swiss Medical 90 días hacia adelante.',
        assumptions: ['Sólo cambia la fecha de cobro de Swiss Medical.', 'No se agregan pacientes nuevos.'],
        projection: buildProjectionSnapshot({
          currentCash: cashBalances.total,
          fixedExpenses,
          receivables: shiftReceivables(receivables, (row) => row.payerKey === 'SWISS', 90),
          today,
        }),
      },
      {
        key: 'kati-patients-minus-20',
        title: 'Kati pierde 20% de pacientes',
        description: 'Reduce la facturación clínica esperada usando los últimos 90 días como proxy.',
        assumptions: [
          katiRevenueRisk.source,
          'El impacto se modela como menor ingreso mensual futuro, no como menor gasto.',
        ],
        projection: buildProjectionSnapshot({
          currentCash: cashBalances.total,
          fixedExpenses,
          monthlyRevenueAdjustment: -katiRevenueRisk.lostMonthlyRevenue,
          receivables,
          today,
        }),
        revenueRisk: katiRevenueRisk,
      },
    ].map((scenario) => ({
      ...scenario,
      impact: compareScenario(scenario.projection, baseProjection),
    }));

    const decision = buildDecisionLayer({
      baseProjection,
      cashBalances,
      fixedExpenses,
      payerRows: receivablesByPayer,
      receivables,
    });

    res.status(200).json({
      generatedAt: new Date(),
      assumptions: {
        fixedExpenses: roundCurrency(fixedExpenses),
        fixedExpensesSource: toNumber(req.query.fixedExpenses) > 0
          ? 'query'
          : (toNumber(process.env.KAREH_FIXED_EXPENSES_MONTHLY) > 0 ? 'env' : 'default_kareh'),
        noNewPatients: true,
        overdueReceivablesForecast: 'Los pendientes vencidos se proyectan como cobrables desde hoy y se marcan como riesgo.',
      },
      currentCash: cashBalances,
      incoming: {
        week: {
          startDate: today,
          endDate: nextWeek,
          collections: roundCurrency(sumReceivablesInRange(receivables, today, nextWeek, true)),
        },
        nextMonth: {
          month: formatMonthLabel(nextMonthStart),
          startDate: nextMonthStart,
          endDate: nextMonthEnd,
          collections: roundCurrency(sumReceivablesInRange(receivables, nextMonthStart, nextMonthEnd)),
        },
        horizons: baseProjection.horizons,
      },
      receivables: {
        totalPending: roundCurrency(totalPending),
        overduePending: roundCurrency(overduePending),
        invoices: receivables.length,
        byPayer: receivablesByPayer,
        rows: receivables,
      },
      currentMonthRemainder: baseProjection.currentMonthRemainder,
      monthlyFlow: baseProjection.monthlyFlow,
      runway: {
        question: 'Si mañana no entra un paciente nuevo, ¿cuántos meses puede sobrevivir Kareh?',
        ...baseProjection.runway,
      },
      stressTests: scenarios,
      decision,
      missingData: [
        {
          key: 'scheduled_expenses',
          label: 'Calendario exacto de gastos',
          reason: 'Los gastos fijos se proyectan como promedio mensual; todavía no hay vencimientos por gasto.',
        },
        {
          key: 'payer_payment_history',
          label: 'Historial real de pago por obra social',
          reason: 'La fecha esperada usa facturas, vencimiento o +60 días; falta medir demora real promedio por pagador.',
        },
        {
          key: 'future_demand',
          label: 'Demanda futura no agendada',
          reason: 'El runway responde el escenario sin pacientes nuevos; no estima captación futura.',
        },
      ],
    });
  } catch (error) {
    throw createInternalError(error, 'Error al obtener proyección financiera');
  }
};
