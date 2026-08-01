import { Router } from 'express';
import { cleanupAuditLogs, listAuditLogs } from '../controllers/audit.controller.js';
import { checkRole } from '../middlewares/authMiddleware.js';

export default function createAuditRoutes(prisma) {
  const router = Router();

  router.get('/', checkRole('SUPER_USER', 'ADMIN'), (req, res) => listAuditLogs(req, res, prisma));
  router.delete('/cleanup', checkRole('SUPER_USER'), (req, res) => cleanupAuditLogs(req, res, prisma));

  return router;
}
