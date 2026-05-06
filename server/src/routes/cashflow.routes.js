import { Router } from 'express';
import { 
  getTransactions, 
  addIncome, 
  addExpense, 
  createTransaction,
  updateTransaction,
  deleteTransaction 
} from '../controllers/cashflow.controller.js';
import { checkRole } from '../middlewares/authMiddleware.js';

const createRouter = (prisma) => {
  const router = Router();

  // --- LECTURA ---
  // GET: /api/cashflow (Obtener lista con filtros opcionales)
  router.get('/', checkRole('SUPER_USER', 'ADMIN'), (req, res) => getTransactions(req, res, prisma));

  // --- CREACIÓN ---
  // POST: /api/cashflow (Ruta genérica que usa el body.type)
  router.post('/', checkRole('SUPER_USER', 'ADMIN'), (req, res) => createTransaction(req, res, prisma));

  // POST: /api/cashflow/income (Forzar tipo ingreso)
  router.post('/income', checkRole('SUPER_USER', 'ADMIN'), (req, res) => addIncome(req, res, prisma));

  // POST: /api/cashflow/expense (Forzar tipo egreso)
  router.post('/expense', checkRole('SUPER_USER', 'ADMIN'), (req, res) => addExpense(req, res, prisma));

  // --- ACTUALIZACIÓN ---
  // PUT: /api/cashflow/:id (Actualizar una transacción existente)
  router.put('/:id', checkRole('SUPER_USER', 'ADMIN'), (req, res) => updateTransaction(req, res, prisma));

  // --- ELIMINACIÓN ---
  // DELETE: /api/cashflow/:id (Borrar una transacción)
  router.delete('/:id', checkRole('SUPER_USER', 'ADMIN'), (req, res) => deleteTransaction(req, res, prisma));

  return router;
};

export default createRouter;
