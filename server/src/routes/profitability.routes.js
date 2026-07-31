import { Router } from 'express';
import { checkRole } from '../middlewares/authMiddleware.js';
import {
  getProfitabilityEquilibrium,
  getProfitabilityPatients,
  getProfitabilityPayers,
  getProfitabilityProfessionals,
  getProfitabilitySummary,
} from '../controllers/profitability.controller.js';

const createRouter = (prisma) => {
  const router = Router();
  const roles = ['SUPER_USER', 'ADMIN', 'SECRETARIA'];

  router.get('/summary', checkRole(...roles), (req, res) => getProfitabilitySummary(req, res, prisma));
  router.get('/patients', checkRole(...roles), (req, res) => getProfitabilityPatients(req, res, prisma));
  router.get('/payers', checkRole(...roles), (req, res) => getProfitabilityPayers(req, res, prisma));
  router.get('/professionals', checkRole(...roles), (req, res) => getProfitabilityProfessionals(req, res, prisma));
  router.get('/equilibrium', checkRole(...roles), (req, res) => getProfitabilityEquilibrium(req, res, prisma));

  return router;
};

export default createRouter;
