import { Router } from 'express';
import { checkRole } from '../middlewares/authMiddleware.js';
import { getStrategicSimulator } from '../controllers/strategicSimulator.controller.js';

const createRouter = (prisma) => {
  const router = Router();
  const roles = ['SUPER_USER', 'ADMIN', 'SECRETARIA'];

  router.get('/', checkRole(...roles), (req, res) => getStrategicSimulator(req, res, prisma));
  router.get('/summary', checkRole(...roles), (req, res) => getStrategicSimulator(req, res, prisma));

  return router;
};

export default createRouter;
