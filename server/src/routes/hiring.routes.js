import { Router } from 'express';
import { checkRole } from '../middlewares/authMiddleware.js';
import { getHiringRecommendations } from '../controllers/hiring.controller.js';

const createRouter = (prisma) => {
  const router = Router();
  const roles = ['SUPER_USER', 'ADMIN', 'SECRETARIA'];

  router.get('/', checkRole(...roles), (req, res) => getHiringRecommendations(req, res, prisma));
  router.get('/summary', checkRole(...roles), (req, res) => getHiringRecommendations(req, res, prisma));

  return router;
};

export default createRouter;
