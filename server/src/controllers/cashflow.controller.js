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
          include: {
            patient: {
              select: { fullName: true } 
            }
          }
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
  const { amount, concept, paymentMethod, date, type } = req.body;

  if (!amount || !concept || !paymentMethod || !type) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (monto, concepto, método o tipo)' });
  }

  try {
    const transaction = await prisma.cashFlow.create({
      data: {
        type: type, // 'INCOME' o 'EXPENSE'
        amount: parseFloat(amount),
        concept,
        paymentMethod,
        date: date ? new Date(date) : new Date(),
      },
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
  const { amount, concept, paymentMethod, date, type } = req.body;

  try {
    const updated = await prisma.cashFlow.update({
      where: { id },
      data: {
        amount: amount ? parseFloat(amount) : undefined,
        concept,
        paymentMethod,
        type,
        date: date ? new Date(date) : undefined,
      },
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