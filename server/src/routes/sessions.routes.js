import express from 'express';
import createSessionsController from '../controllers/sessions.controller.js';

export default function createSessionsRoutes(prisma, sessionManager) {
  const router = express.Router();
  const controller = createSessionsController(prisma, sessionManager);

  router.get('/active', controller.getActiveSessions);
  router.post('/:id/revoke', controller.revokeSession);
  router.post('/revoke-all', controller.revokeAllSessions);

  return router;
}
