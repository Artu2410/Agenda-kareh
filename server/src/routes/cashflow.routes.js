import { Router } from 'express';
import { 
  getTransactions, 
  addIncome, 
  addExpense, 
  createTransaction,
  updateTransaction,
  deleteTransaction 
} from '../controllers/cashflow.controller.js';

const createRouter = (prisma) => {
  const router = Router();

  // --- LECTURA ---
  // GET: /api/cashflow (Obtener lista con filtros opcionales)
  router.get('/', (req, res) => getTransactions(req, res, prisma));

  // --- CREACIÓN ---
  // POST: /api/cashflow (Ruta genérica que usa el body.type)
  router.post('/', (req, res) => createTransaction(req, res, prisma));

  // POST: /api/cashflow/income (Forzar tipo ingreso)
  router.post('/income', (req, res) => addIncome(req, res, prisma));

  // POST: /api/cashflow/expense (Forzar tipo egreso)
  router.post('/expense', (req, res) => addExpense(req, res, prisma));

  // --- ACTUALIZACIÓN ---
  // PUT: /api/cashflow/:id (Actualizar una transacción existente)
  router.put('/:id', (req, res) => updateTransaction(req, res, prisma));

  // --- ELIMINACIÓN ---
  // DELETE: /api/cashflow/:id (Borrar una transacción)
  router.delete('/:id', (req, res) => deleteTransaction(req, res, prisma));

  return router;
};

export default createRouter;