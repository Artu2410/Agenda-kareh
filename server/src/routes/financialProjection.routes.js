import { Router } from 'express';
import { checkRole } from '../middlewares/authMiddleware.js';
import { getFinancialProjectionSummary } from '../controllers/financialProjection.controller.js';

const createRouter = (prisma) => {
  const router = Router();
  const roles = ['SUPER_USER', 'ADMIN', 'SECRETARIA'];

  router.get('/', checkRole(...roles), (req, res) => getFinancialProjectionSummary(req, res, prisma));
  router.get('/summary', checkRole(...roles), (req, res) => getFinancialProjectionSummary(req, res, prisma));

  return router;
};

export default createRouter;
