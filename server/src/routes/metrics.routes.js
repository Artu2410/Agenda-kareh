import { Router } from 'express';
import { getMetrics } from '../controllers/metrics.controller.js';

export default function createMetricsRoutes(prisma) {
  const router = Router();

  // GET /api/metrics?period=week|month|year
  router.get('/', (req, res) => getMetrics(req, res, prisma));

  return router;
}
