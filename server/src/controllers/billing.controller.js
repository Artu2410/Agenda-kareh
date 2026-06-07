import { createInternalError, createPublicError } from '../errors/AppError.js';

const VALID_PAYER_TYPES = new Set(['PATIENT', 'OBRA_SOCIAL', 'OTHER']);
const VALID_INVOICE_STATUSES = new Set(['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED']);
const CLOSED_STATUSES = new Set(['PAID', 'CANCELLED']);
const CASHFLOW_ACCOUNTS = new Set(['CASH', 'MERCADO_PAGO']);
const BILLABLE_APPOINTMENT_STATUSES = ['COMPLETED', 'AUTHORIZED', 'SCHEDULED'];

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundCurrency = (value) => Math.round(toNumber(value) * 100) / 100;

const parsePositiveAmount = (value) => {
  const parsed = roundCurrency(value);
  return parsed > 0 ? parsed : null;
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const normalizeText = (value) => String(value || '').trim();
const normalizeUpper = (value) => normalizeText(value).toUpperCase();

const resolveAccount = ({ account, paymentMethod }) => {
  const normalizedAccount = normalizeUpper(account);
  if (CASHFLOW_ACCOUNTS.has(normalizedAccount)) return normalizedAccount;
  return normalizeUpper(paymentMethod) === 'EFECTIVO' ? 'CASH' : 'MERCADO_PAGO';
};

const resolvePayerType = (value) => {
  const normalized = normalizeUpper(value || 'OBRA_SOCIAL');
  return VALID_PAYER_TYPES.has(normalized) ? normalized : 'OTHER';
};

const resolveStatus = (value, fallback = 'ISSUED') => {
  const normalized = normalizeUpper(value);
  return VALID_INVOICE_STATUSES.has(normalized) ? normalized : fallback;
};

const calculatePending = (invoice = {}) => (
  roundCurrency(toNumber(invoice.totalAmount) - toNumber(invoice.paidAmount))
);

const resolveLifecycleStatus = ({ totalAmount, paidAmount, expectedPaymentDate, currentStatus }) => {
  if (currentStatus === 'CANCELLED' || currentStatus === 'DRAFT') return currentStatus;

  const pending = roundCurrency(toNumber(totalAmount) - toNumber(paidAmount));
  if (pending <= 0) return 'PAID';
  if (toNumber(paidAmount) > 0) return 'PARTIALLY_PAID';

  const expectedDate = parseDate(expectedPaymentDate);
  if (expectedDate && expectedDate < new Date()) return 'OVERDUE';

  return 'ISSUED';
};

const serializeInvoice = (invoice) => {
  const pendingAmount = calculatePending(invoice);

  return {
    ...invoice,
    totalAmount: toNumber(invoice.totalAmount),
    paidAmount: toNumber(invoice.paidAmount),
    pendingAmount,
    items: (invoice.items || []).map((item) => ({
      ...item,
      unitAmount: toNumber(item.unitAmount),
      totalAmount: toNumber(item.totalAmount),
    })),
    payments: (invoice.payments || []).map((payment) => ({
      ...payment,
      amount: toNumber(payment.amount),
    })),
  };
};

const invoiceInclude = {
  obraSocial: {
    select: {
      id: true,
      nombreOs: true,
      plazoPago: true,
    },
  },
  patient: {
    select: {
      id: true,
      fullName: true,
      dni: true,
    },
  },
  items: {
    orderBy: { createdAt: 'asc' },
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
          time: true,
          status: true,
        },
      },
    },
  },
  payments: {
    orderBy: { paymentDate: 'desc' },
    include: {
      cashFlow: {
        select: {
          id: true,
          account: true,
          paymentMethod: true,
        },
      },
    },
  },
};

const buildInvoiceItems = (items = [], fallback = {}) => {
  const sourceItems = Array.isArray(items) && items.length > 0
    ? items
    : [{
        description: fallback.description || 'Facturación de prestaciones',
        quantity: 1,
        unitAmount: fallback.totalAmount,
        totalAmount: fallback.totalAmount,
      }];

  return sourceItems.map((item, index) => {
    const quantity = Math.max(1, Number.parseInt(item.quantity, 10) || 1);
    const unitAmount = parsePositiveAmount(item.unitAmount);
    const explicitTotal = parsePositiveAmount(item.totalAmount);
    const totalAmount = explicitTotal || (unitAmount ? roundCurrency(unitAmount * quantity) : null);
    const description = normalizeText(item.description);

    if (!description) {
      throw createPublicError(400, `El ítem ${index + 1} necesita descripción`);
    }

    if (!totalAmount) {
      throw createPublicError(400, `El ítem ${index + 1} necesita un monto válido`);
    }

    return {
      appointmentId: item.appointmentId || null,
      patientId: item.patientId || null,
      professionalId: item.professionalId || null,
      serviceDate: parseDate(item.serviceDate),
      description,
      quantity,
      unitAmount: unitAmount || roundCurrency(totalAmount / quantity),
      totalAmount,
    };
  });
};

const resolveInvoicePayer = async (prisma, { payerType, payerName, obraSocialId, patientId, issueDate }) => {
  if (payerType === 'OBRA_SOCIAL' && obraSocialId) {
    const obraSocial = await prisma.obraSocial.findUnique({
      where: { id: obraSocialId },
      select: {
        id: true,
        nombreOs: true,
        plazoPago: true,
      },
    });

    if (!obraSocial) {
      throw createPublicError(400, 'La obra social seleccionada no existe');
    }

    return {
      payerName: normalizeText(payerName) || obraSocial.nombreOs,
      expectedPaymentDate: addDays(issueDate, Number(obraSocial.plazoPago) || 60),
    };
  }

  if (payerType === 'PATIENT' && patientId) {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        fullName: true,
      },
    });

    if (!patient) {
      throw createPublicError(400, 'El paciente seleccionado no existe');
    }

    return {
      payerName: normalizeText(payerName) || patient.fullName,
      expectedPaymentDate: issueDate,
    };
  }

  const resolvedPayerName = normalizeText(payerName);
  if (!resolvedPayerName) {
    throw createPublicError(400, 'El pagador es obligatorio');
  }

  return {
    payerName: resolvedPayerName,
    expectedPaymentDate: issueDate,
  };
};

const updateInvoicePaymentStatus = async (tx, invoiceId) => {
  const [invoice, paymentAggregate] = await Promise.all([
    tx.billingInvoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        totalAmount: true,
        expectedPaymentDate: true,
        status: true,
      },
    }),
    tx.billingPayment.aggregate({
      where: { invoiceId },
      _sum: { amount: true },
    }),
  ]);

  if (!invoice) return null;

  const paidAmount = roundCurrency(paymentAggregate._sum.amount || 0);
  const nextStatus = resolveLifecycleStatus({
    totalAmount: invoice.totalAmount,
    paidAmount,
    expectedPaymentDate: invoice.expectedPaymentDate,
    currentStatus: invoice.status,
  });

  return tx.billingInvoice.update({
    where: { id: invoiceId },
    data: {
      paidAmount,
      status: nextStatus,
    },
    include: invoiceInclude,
  });
};

export const getBillingInvoices = async (req, res, prisma) => {
  const {
    status,
    payerType,
    obraSocialId,
    patientId,
    search,
  } = req.query;

  const where = {};
  const normalizedStatus = normalizeUpper(status);
  const normalizedPayerType = normalizeUpper(payerType);

  if (VALID_INVOICE_STATUSES.has(normalizedStatus)) {
    where.status = normalizedStatus;
  }

  if (VALID_PAYER_TYPES.has(normalizedPayerType)) {
    where.payerType = normalizedPayerType;
  }

  if (obraSocialId) where.obraSocialId = obraSocialId;
  if (patientId) where.patientId = patientId;

  if (search) {
    where.OR = [
      { payerName: { contains: search, mode: 'insensitive' } },
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
    ];
  }

  try {
    const invoices = await prisma.billingInvoice.findMany({
      where,
      orderBy: [
        { expectedPaymentDate: 'asc' },
        { issueDate: 'desc' },
      ],
      include: invoiceInclude,
    });

    res.status(200).json(invoices.map(serializeInvoice));
  } catch (error) {
    throw createInternalError(error, 'Error al obtener facturas');
  }
};

export const getBillingSummary = async (req, res, prisma) => {
  try {
    const invoices = await prisma.billingInvoice.findMany({
      where: {
        status: { not: 'CANCELLED' },
      },
      include: {
        obraSocial: {
          select: {
            id: true,
            nombreOs: true,
          },
        },
        payments: {
          select: {
            amount: true,
            paymentDate: true,
          },
        },
      },
    });

    const now = new Date();
    const horizon30 = addDays(now, 30);
    const horizon60 = addDays(now, 60);
    const horizon90 = addDays(now, 90);
    const byPayer = new Map();
    const collectionDaySamples = [];

    const summary = invoices.reduce((accumulator, invoice) => {
      const totalAmount = toNumber(invoice.totalAmount);
      const paidAmount = toNumber(invoice.paidAmount);
      const pendingAmount = roundCurrency(totalAmount - paidAmount);
      const expectedPaymentDate = parseDate(invoice.expectedPaymentDate || invoice.dueDate);
      const payerKey = invoice.obraSocialId || invoice.payerName;
      const payerRow = byPayer.get(payerKey) || {
        key: payerKey,
        payerName: invoice.obraSocial?.nombreOs || invoice.payerName,
        payerType: invoice.payerType,
        invoiceCount: 0,
        totalInvoiced: 0,
        totalCollected: 0,
        totalPending: 0,
        overduePending: 0,
      };

      accumulator.totalInvoiced += totalAmount;
      accumulator.totalCollected += paidAmount;
      accumulator.totalPending += pendingAmount;
      accumulator.invoiceCount += 1;

      if (pendingAmount > 0) {
        accumulator.openInvoiceCount += 1;
      }

      if (pendingAmount > 0 && expectedPaymentDate && expectedPaymentDate < now) {
        accumulator.overduePending += pendingAmount;
        payerRow.overduePending += pendingAmount;
      }

      if (pendingAmount > 0 && expectedPaymentDate) {
        if (expectedPaymentDate <= horizon30) accumulator.projected30 += pendingAmount;
        if (expectedPaymentDate <= horizon60) accumulator.projected60 += pendingAmount;
        if (expectedPaymentDate <= horizon90) accumulator.projected90 += pendingAmount;
      }

      invoice.payments.forEach((payment) => {
        const paymentDate = parseDate(payment.paymentDate);
        const issueDate = parseDate(invoice.issueDate);
        if (!paymentDate || !issueDate) return;
        collectionDaySamples.push(Math.max(0, Math.round((paymentDate - issueDate) / (24 * 60 * 60 * 1000))));
      });

      payerRow.invoiceCount += 1;
      payerRow.totalInvoiced += totalAmount;
      payerRow.totalCollected += paidAmount;
      payerRow.totalPending += pendingAmount;
      byPayer.set(payerKey, payerRow);

      return accumulator;
    }, {
      totalInvoiced: 0,
      totalCollected: 0,
      totalPending: 0,
      overduePending: 0,
      projected30: 0,
      projected60: 0,
      projected90: 0,
      invoiceCount: 0,
      openInvoiceCount: 0,
    });

    const averageCollectionDays = collectionDaySamples.length > 0
      ? Math.round(collectionDaySamples.reduce((sum, value) => sum + value, 0) / collectionDaySamples.length)
      : null;

    res.status(200).json({
      ...Object.fromEntries(
        Object.entries(summary).map(([key, value]) => [key, typeof value === 'number' ? roundCurrency(value) : value])
      ),
      averageCollectionDays,
      byPayer: Array.from(byPayer.values())
        .map((row) => ({
          ...row,
          totalInvoiced: roundCurrency(row.totalInvoiced),
          totalCollected: roundCurrency(row.totalCollected),
          totalPending: roundCurrency(row.totalPending),
          overduePending: roundCurrency(row.overduePending),
        }))
        .sort((left, right) => right.totalPending - left.totalPending),
    });
  } catch (error) {
    throw createInternalError(error, 'Error al obtener resumen de facturación');
  }
};

export const createBillingInvoice = async (req, res, prisma) => {
  try {
    const payerType = resolvePayerType(req.body.payerType);
    const issueDate = parseDate(req.body.issueDate) || new Date();
    const fallbackTotal = parsePositiveAmount(req.body.totalAmount);
    const items = buildInvoiceItems(req.body.items, {
      description: req.body.description,
      totalAmount: fallbackTotal,
    });
    const calculatedTotal = roundCurrency(items.reduce((sum, item) => sum + item.totalAmount, 0));
    const totalAmount = fallbackTotal || calculatedTotal;

    if (!totalAmount) {
      return res.status(400).json({ error: 'La factura necesita un monto mayor a cero' });
    }

    const payer = await resolveInvoicePayer(prisma, {
      payerType,
      payerName: req.body.payerName,
      obraSocialId: req.body.obraSocialId,
      patientId: req.body.patientId,
      issueDate,
    });

    const expectedPaymentDate = parseDate(req.body.expectedPaymentDate)
      || parseDate(req.body.dueDate)
      || payer.expectedPaymentDate;
    const status = resolveStatus(req.body.status, 'ISSUED');

    const invoice = await prisma.billingInvoice.create({
      data: {
        invoiceNumber: normalizeText(req.body.invoiceNumber) || null,
        payerType,
        payerName: payer.payerName,
        obraSocialId: payerType === 'OBRA_SOCIAL' ? (req.body.obraSocialId || null) : null,
        patientId: payerType === 'PATIENT' ? (req.body.patientId || null) : null,
        issueDate,
        serviceMonth: normalizeText(req.body.serviceMonth) || null,
        dueDate: parseDate(req.body.dueDate) || expectedPaymentDate,
        expectedPaymentDate,
        totalAmount,
        paidAmount: 0,
        status,
        notes: normalizeText(req.body.notes) || null,
        items: {
          create: items,
        },
      },
      include: invoiceInclude,
    });

    res.status(201).json(serializeInvoice(invoice));
  } catch (error) {
    if (error.statusCode) throw error;
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe una factura con ese número' });
    }
    throw createInternalError(error, 'Error al crear factura');
  }
};

export const updateBillingInvoice = async (req, res, prisma) => {
  const { id } = req.params;

  try {
    const current = await prisma.billingInvoice.findUnique({
      where: { id },
      include: {
        payments: true,
      },
    });

    if (!current) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    const data = {};
    if (req.body.invoiceNumber !== undefined) data.invoiceNumber = normalizeText(req.body.invoiceNumber) || null;
    if (req.body.payerName !== undefined) data.payerName = normalizeText(req.body.payerName);
    if (req.body.issueDate !== undefined) data.issueDate = parseDate(req.body.issueDate) || current.issueDate;
    if (req.body.serviceMonth !== undefined) data.serviceMonth = normalizeText(req.body.serviceMonth) || null;
    if (req.body.dueDate !== undefined) data.dueDate = parseDate(req.body.dueDate);
    if (req.body.expectedPaymentDate !== undefined) data.expectedPaymentDate = parseDate(req.body.expectedPaymentDate);
    if (req.body.notes !== undefined) data.notes = normalizeText(req.body.notes) || null;
    if (req.body.status !== undefined) data.status = resolveStatus(req.body.status, current.status);

    const hasItems = Array.isArray(req.body.items);
    let items = null;
    if (hasItems) {
      items = buildInvoiceItems(req.body.items, { totalAmount: parsePositiveAmount(req.body.totalAmount) });
      data.totalAmount = roundCurrency(items.reduce((sum, item) => sum + item.totalAmount, 0));
    } else if (req.body.totalAmount !== undefined) {
      const totalAmount = parsePositiveAmount(req.body.totalAmount);
      if (!totalAmount) {
        return res.status(400).json({ error: 'El monto total debe ser mayor a cero' });
      }
      data.totalAmount = totalAmount;
    }

    const invoice = await prisma.$transaction(async (tx) => {
      if (hasItems) {
        await tx.billingInvoiceItem.deleteMany({ where: { invoiceId: id } });
      }

      await tx.billingInvoice.update({
        where: { id },
        data: {
          ...data,
          ...(hasItems ? { items: { create: items } } : {}),
        },
      });

      return updateInvoicePaymentStatus(tx, id);
    });

    res.status(200).json(serializeInvoice(invoice));
  } catch (error) {
    if (error.statusCode) throw error;
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe una factura con ese número' });
    }
    throw createInternalError(error, 'Error al actualizar factura');
  }
};

export const deleteBillingInvoice = async (req, res, prisma) => {
  const { id } = req.params;

  try {
    const invoice = await prisma.billingInvoice.findUnique({
      where: { id },
      include: {
        payments: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    if (invoice.payments.length > 0) {
      return res.status(409).json({ error: 'No se puede eliminar una factura con cobros registrados. Marcala como cancelada.' });
    }

    await prisma.billingInvoice.delete({ where: { id } });
    res.status(200).json({ message: 'Factura eliminada' });
  } catch (error) {
    throw createInternalError(error, 'Error al eliminar factura');
  }
};

export const addBillingPayment = async (req, res, prisma) => {
  const { id } = req.params;

  try {
    const amount = parsePositiveAmount(req.body.amount);
    if (!amount) {
      return res.status(400).json({ error: 'El cobro debe tener un monto mayor a cero' });
    }

    const invoice = await prisma.billingInvoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    if (CLOSED_STATUSES.has(invoice.status)) {
      return res.status(409).json({ error: 'La factura está cerrada' });
    }

    const pendingAmount = calculatePending(invoice);
    if (amount > pendingAmount) {
      return res.status(400).json({ error: `El cobro supera el pendiente (${pendingAmount})` });
    }

    const paymentMethod = normalizeText(req.body.paymentMethod) || 'Transferencia';
    const account = resolveAccount({ account: req.body.account, paymentMethod });
    const paymentDate = parseDate(req.body.paymentDate) || new Date();
    const notes = normalizeText(req.body.notes) || null;

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      const cashFlow = await tx.cashFlow.create({
        data: {
          type: 'INCOME',
          amount,
          category: 'FACTURACION',
          concept: `Cobro factura ${invoice.invoiceNumber || invoice.id} - ${invoice.payerName}`,
          paymentMethod,
          account,
          destinationAccount: null,
          date: paymentDate,
        },
      });

      await tx.billingPayment.create({
        data: {
          invoiceId: id,
          amount,
          paymentDate,
          paymentMethod,
          account,
          notes,
          cashFlowId: cashFlow.id,
        },
      });

      return updateInvoicePaymentStatus(tx, id);
    });

    res.status(201).json(serializeInvoice(updatedInvoice));
  } catch (error) {
    if (error.statusCode) throw error;
    throw createInternalError(error, 'Error al registrar cobro');
  }
};

export const deleteBillingPayment = async (req, res, prisma) => {
  const { id } = req.params;

  try {
    const payment = await prisma.billingPayment.findUnique({
      where: { id },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Cobro no encontrado' });
    }

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      await tx.billingPayment.delete({ where: { id } });

      if (payment.cashFlowId) {
        await tx.cashFlow.delete({ where: { id: payment.cashFlowId } });
      }

      return updateInvoicePaymentStatus(tx, payment.invoiceId);
    });

    res.status(200).json(serializeInvoice(updatedInvoice));
  } catch (error) {
    throw createInternalError(error, 'Error al eliminar cobro');
  }
};

const resolveAppointmentBillableAmount = (appointment = {}) => {
  const detailsHonorario = toNumber(appointment.coinsuranceDetails?.honorario);
  if (detailsHonorario > 0) return detailsHonorario;

  const obraSocialHonorario = toNumber(appointment.obraSocial?.honorarioEstimado);
  if (obraSocialHonorario > 0) return obraSocialHonorario;

  return toNumber(appointment.patientChargeAmount || appointment.coinsuranceAmount);
};

export const getUnbilledAppointments = async (req, res, prisma) => {
  try {
    const startDate = parseDate(req.query.startDate);
    const endDate = parseDate(req.query.endDate);
    const where = {
      status: { in: BILLABLE_APPOINTMENT_STATUSES },
      billingInvoiceItems: { none: {} },
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    if (req.query.obraSocialId) {
      where.obraSocialId = req.query.obraSocialId;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: [
        { date: 'asc' },
        { time: 'asc' },
      ],
      include: {
        patient: {
          select: {
            id: true,
            fullName: true,
            healthInsurance: true,
            treatAsParticular: true,
          },
        },
        professional: {
          select: {
            id: true,
            fullName: true,
          },
        },
        obraSocial: {
          select: {
            id: true,
            nombreOs: true,
            honorarioEstimado: true,
            plazoPago: true,
          },
        },
      },
    });

    res.status(200).json(appointments.map((appointment) => ({
      ...appointment,
      patientChargeAmount: toNumber(appointment.patientChargeAmount),
      coinsuranceAmount: toNumber(appointment.coinsuranceAmount),
      billableAmount: resolveAppointmentBillableAmount(appointment),
    })));
  } catch (error) {
    throw createInternalError(error, 'Error al obtener turnos no facturados');
  }
};
