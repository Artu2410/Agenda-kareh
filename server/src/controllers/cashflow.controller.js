import { appointmentBaseSelect } from '../prisma/selects.js';

const DEFAULT_CATEGORY = 'GENERAL';
const BONOS_QR_CATEGORY = 'BONOS_QR';
const TRANSFER_PAYMENT_METHOD = 'Transferencia interna';
const FLOW_TYPES = new Set(['INCOME', 'EXPENSE', 'TRANSFER']);
const CASHFLOW_ACCOUNTS = new Set(['CASH', 'MERCADO_PAGO']);

const normalizeText = (value) => String(value || '').trim().toUpperCase();
const resolveType = (type) => {
  const normalizedType = normalizeText(type);
  return FLOW_TYPES.has(normalizedType) ? normalizedType : null;
};

const looksLikeBonosQr = ({ type, paymentMethod, concept }) => {
  if (type !== 'INCOME') return false;
  const normalizedMethod = normalizeText(paymentMethod);
  const normalizedConcept = normalizeText(concept);
  return normalizedMethod === 'QR' && /(IOMA|BONO|BONOS)/.test(normalizedConcept);
};

const resolveCategory = ({ type, category, paymentMethod, concept }) => {
  if (type !== 'INCOME') return DEFAULT_CATEGORY;
  if (category === BONOS_QR_CATEGORY) return BONOS_QR_CATEGORY;
  return looksLikeBonosQr({ type, paymentMethod, concept }) ? BONOS_QR_CATEGORY : DEFAULT_CATEGORY;
};

const resolveAccount = ({ account, paymentMethod }) => {
  const normalizedAccount = normalizeText(account);
  if (CASHFLOW_ACCOUNTS.has(normalizedAccount)) return normalizedAccount;
  return normalizeText(paymentMethod) === 'EFECTIVO' ? 'CASH' : 'MERCADO_PAGO';
};

const resolveExplicitAccount = (account) => {
  const normalizedAccount = normalizeText(account);
  return CASHFLOW_ACCOUNTS.has(normalizedAccount) ? normalizedAccount : null;
};

const resolveDestinationAccount = (destinationAccount) => {
  const normalizedAccount = normalizeText(destinationAccount);
  return CASHFLOW_ACCOUNTS.has(normalizedAccount) ? normalizedAccount : null;
};

const buildTransactionData = ({ amount, category, concept, paymentMethod, date, type, account, destinationAccount }) => {
  const normalizedType = resolveType(type);

  if (!normalizedType) {
    return { error: 'Tipo de movimiento inválido' };
  }

  const parsedAmount = Number.parseFloat(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return { error: 'El monto debe ser mayor a cero' };
  }

  if (!concept) {
    return { error: 'El concepto es obligatorio' };
  }

  if (normalizedType === 'TRANSFER') {
    const resolvedAccount = resolveExplicitAccount(account);
    const resolvedDestinationAccount = resolveDestinationAccount(destinationAccount);

    if (!resolvedAccount) {
      return { error: 'Debes elegir la cuenta origen del traspaso' };
    }

    if (!resolvedDestinationAccount) {
      return { error: 'Debes elegir la cuenta destino del traspaso' };
    }

    if (resolvedDestinationAccount === resolvedAccount) {
      return { error: 'La cuenta origen y destino deben ser distintas' };
    }

    return {
      data: {
        type: normalizedType,
        amount: parsedAmount,
        category: DEFAULT_CATEGORY,
        concept,
        paymentMethod: TRANSFER_PAYMENT_METHOD,
        account: resolvedAccount,
        destinationAccount: resolvedDestinationAccount,
        date: date ? new Date(date) : new Date(),
      },
    };
  }

  if (!paymentMethod) {
    return { error: 'Faltan campos válidos (monto, concepto, método o tipo)' };
  }

  const resolvedAccount = resolveAccount({ account, paymentMethod });

  return {
    data: {
      type: normalizedType,
      amount: parsedAmount,
      category: resolveCategory({ type: normalizedType, category, paymentMethod, concept }),
      concept,
      paymentMethod,
      account: resolvedAccount,
      destinationAccount: null,
      date: date ? new Date(date) : new Date(),
    },
  };
};

// 1. OBTENER TRANSACCIONES (Con filtros de fecha)
export const getTransactions = async (req, res, prisma) => {
  const { startDate, endDate } = req.query;
  const where = {};

  if (startDate && endDate) {
    where.date = {
      gte: new Date(startDate),
      lte: new Date(endDate),
    };
  }

  try {
    const transactions = await prisma.cashFlow.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        appointment: {
          select: {
            ...appointmentBaseSelect,
            patient: {
              select: { fullName: true },
            },
          },
        }
      }
    });
    res.status(200).json(transactions);
  } catch (error) {
    console.error("❌ Error fetching transactions:", error);
    res.status(500).json({ 
      error: 'Error al obtener transacciones',
      message: error.message 
    });
  }
};

// 2. FUNCIÓN GENÉRICA PARA CREAR (Base para Income/Expense)
export const createTransaction = async (req, res, prisma) => {
  const { error: validationError, data } = buildTransactionData(req.body);

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const transaction = await prisma.cashFlow.create({
      data,
    });
    res.status(201).json(transaction);
  } catch (error) {
    console.error("❌ Error creating transaction:", error);
    res.status(500).json({ error: 'Error al crear la transacción', message: error.message });
  }
};

// 3. WRAPPERS PARA INGRESO Y EGRESO
export const addIncome = async (req, res, prisma) => {
  req.body.type = 'INCOME';
  return createTransaction(req, res, prisma);
};

export const addExpense = async (req, res, prisma) => {
  req.body.type = 'EXPENSE';
  return createTransaction(req, res, prisma);
};

// 4. ACTUALIZAR TRANSACCIÓN
export const updateTransaction = async (req, res, prisma) => {
  const { id } = req.params;
  const { error: validationError, data } = buildTransactionData(req.body);

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const updated = await prisma.cashFlow.update({
      where: { id },
      data,
    });
    res.status(200).json(updated);
  } catch (error) {
    console.error("❌ Error updating transaction:", error);
    res.status(500).json({ error: 'Error al actualizar la transacción', message: error.message });
  }
};

// 5. ELIMINAR TRANSACCIÓN
export const deleteTransaction = async (req, res, prisma) => {
  const { id } = req.params;

  try {
    await prisma.cashFlow.delete({
      where: { id },
    });
    res.status(200).json({ message: 'Transacción eliminada con éxito' });
  } catch (error) {
    console.error("❌ Error deleting transaction:", error);
    res.status(500).json({ error: 'Error al eliminar la transacción', message: error.message });
  }
};
