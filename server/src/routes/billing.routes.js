import { Router } from 'express';
import { checkRole } from '../middlewares/authMiddleware.js';
import {
  addBillingPayment,
  createBillingInvoice,
  deleteBillingInvoice,
  deleteBillingPayment,
  getBillingInvoices,
  getBillingSummary,
  getUnbilledAppointments,
  updateBillingInvoice,
} from '../controllers/billing.controller.js';

const createRouter = (prisma) => {
  const router = Router();

  router.get('/summary', checkRole('SUPER_USER', 'ADMIN', 'SECRETARIA'), (req, res) => getBillingSummary(req, res, prisma));
  router.get('/unbilled-appointments', checkRole('SUPER_USER', 'ADMIN', 'SECRETARIA'), (req, res) => getUnbilledAppointments(req, res, prisma));
  router.get('/invoices', checkRole('SUPER_USER', 'ADMIN', 'SECRETARIA'), (req, res) => getBillingInvoices(req, res, prisma));
  router.post('/invoices', checkRole('SUPER_USER', 'ADMIN', 'SECRETARIA'), (req, res) => createBillingInvoice(req, res, prisma));
  router.put('/invoices/:id', checkRole('SUPER_USER', 'ADMIN', 'SECRETARIA'), (req, res) => updateBillingInvoice(req, res, prisma));
  router.delete('/invoices/:id', checkRole('SUPER_USER', 'ADMIN'), (req, res) => deleteBillingInvoice(req, res, prisma));
  router.post('/invoices/:id/payments', checkRole('SUPER_USER', 'ADMIN', 'SECRETARIA'), (req, res) => addBillingPayment(req, res, prisma));
  router.delete('/payments/:id', checkRole('SUPER_USER', 'ADMIN'), (req, res) => deleteBillingPayment(req, res, prisma));

  return router;
};

export default createRouter;
