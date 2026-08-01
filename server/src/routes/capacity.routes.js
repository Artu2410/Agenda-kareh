import { Router } from 'express';
import { checkRole } from '../middlewares/authMiddleware.js';
import { getCapacityMetrics } from '../controllers/capacity.controller.js';

const createRouter = (prisma) => {
  const router = Router();

  router.get(
    '/',
    checkRole('SUPER_USER', 'ADMIN', 'PROFESSIONAL', 'SECRETARIA'),
    (req, res) => getCapacityMetrics(req, res, prisma)
  );

  return router;
};

export default createRouter;
