import { Router } from 'express';
import { getMetrics, getMetricsDebug } from '../controllers/metrics.controller.js';
import { validateQuery } from '../middlewares/validate.js';
import { metricsQuerySchema } from '../validations/metricsSchemas.js';

export default function createMetricsRoutes(prisma) {
  const router = Router();

  // GET /api/metrics?period=week|month|year&month=5&year=2026
  router.get('/', validateQuery(metricsQuerySchema), (req, res) => getMetrics(req, res, prisma));

  // GET /api/metrics/debug — TEMPORAL, eliminar tras validación en producción
  router.get('/debug', (req, res) => getMetricsDebug(req, res, prisma));

  return router;
}
