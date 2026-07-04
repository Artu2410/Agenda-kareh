import { Router } from 'express';
import { getMetrics } from '../controllers/metrics.controller.js';
import { validateQuery } from '../middlewares/validate.js';
import { metricsQuerySchema } from '../validations/metricsSchemas.js';

export default function createMetricsRoutes(prisma) {
  const router = Router();

  // GET /api/metrics?period=week|month|year&month=5&year=2026
  router.get('/', validateQuery(metricsQuerySchema), (req, res) => getMetrics(req, res, prisma));

  return router;
}
