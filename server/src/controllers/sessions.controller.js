import SessionManager from '../utils/sessionManager.js';
import { createInternalError } from '../errors/AppError.js';

export const createSessionsController = (prisma, sessionManager = new SessionManager(prisma)) => ({
  getActiveSessions: async (req, res) => {
    try {
      const userId = req.user.userId;
      const sessions = await sessionManager.getActiveSessions(userId);
      return res.json({ success: true, sessions });
    } catch (error) {
      throw createInternalError(error, 'Error al obtener sesiones');
    }
  },

  revokeSession: async (req, res) => {
    try {
      const userId = req.user.userId;
      const sessionId = req.params.id;

      // Ensure session belongs to user
      const session = await prisma.authSession.findUnique({ where: { id: sessionId } });
      if (!session || session.userId !== userId) {
        return res.status(404).json({ message: 'Sesión no encontrada' });
      }

      await sessionManager.revokeSession(userId, sessionId);
      return res.json({ success: true, message: 'Sesión revocada' });
    } catch (error) {
      throw createInternalError(error, 'Error al revocar sesión');
    }
  },

  revokeAllSessions: async (req, res) => {
    try {
      const userId = req.user.userId;
      await sessionManager.revokeAllSessions(userId, 'User requested revoke all');
      return res.json({ success: true, message: 'Todas las sesiones han sido revocadas' });
    } catch (error) {
      throw createInternalError(error, 'Error al revocar sesiones');
    }
  },
});

export default createSessionsController;
