import { Router } from 'express';
import { listAuditLogs } from '../controllers/audit.controller.js';
import { checkRole } from '../middlewares/authMiddleware.js';

export default function createAuditRoutes(prisma) {
  const router = Router();

  router.get('/', checkRole('SUPER_USER', 'ADMIN'), (req, res) => listAuditLogs(req, res, prisma));
  // El borrado manual del log de auditoría se quitó: la retención es automática (AUDIT_RETENTION_DAYS).

  return router;
}
