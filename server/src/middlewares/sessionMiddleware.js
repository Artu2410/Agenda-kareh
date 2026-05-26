import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';
import { extractBearerToken, getJwtSecret } from '../utils/auth.js';

const buildSessionUser = (decoded = {}) => {
  const userId = decoded.sub || decoded.userId || null;
  if (!userId) {
    return null;
  }

  return {
    userId,
    email: decoded.email || null,
    role: decoded.role || null,
    sessionId: decoded.sid || null,
    tokenId: decoded.jti || null,
  };
};

/**
 * Middleware global no bloqueante: adjunta contexto de sesión cuando existe
 * un access token válido, pero no intercepta rutas públicas.
 */
export const sessionValidationMiddleware = async (req, res, next) => {
  const requestLogger = req.logger || logger;

  try {
    const token = extractBearerToken(req);

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const sessionUser = buildSessionUser(decoded);

    if (!sessionUser) {
      return next();
    }

    if (req.prisma && sessionUser.tokenId && sessionUser.sessionId) {
      const session = await req.prisma.authSession.findFirst({
        where: {
          id: sessionUser.sessionId,
          userId: sessionUser.userId,
          accessTokenJti: sessionUser.tokenId,
          revokedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (!session) {
        requestLogger.debug('Session context skipped: no active session found', {
          userId: sessionUser.userId,
          sessionId: sessionUser.sessionId,
        });
        return next();
      }

      await req.prisma.authSession.update({
        where: { id: session.id },
        data: { lastUsedAt: new Date() },
      });

      req.session = session;
    }

    req.user = sessionUser;
    requestLogger.debug('Session context attached', {
      userId: sessionUser.userId,
      sessionId: sessionUser.sessionId,
    });

    return next();
  } catch (error) {
    requestLogger.debug('Session context skipped: invalid token', {
      reason: error.name,
    });
    return next();
  }
};

/**
 * Middleware para detectar dispositivos nuevos/sospechosos
 */
export const deviceDetectionMiddleware = async (req, res, next) => {
  if (!req.user || !req.prisma) {
    return next();
  }

  try {
    const currentUserAgent = req.get('user-agent');
    const currentIp = req.ip;

    // Buscar sesiones previas del usuario
    const previousSessions = await req.prisma.authSession.findMany({
      where: {
        userId: req.user.userId,
        revokedAt: null,
      },
    });

    // Detectar dispositivo nuevo
    const isNewDevice = !previousSessions.some((s) => s.userAgent === currentUserAgent);
    const isNewLocation = !previousSessions.some((s) => s.ipAddress === currentIp);

    if (isNewDevice && isNewLocation) {
      logger.warn('New device detected', {
        userId: req.user.userId,
        userAgent: currentUserAgent,
        ip: currentIp,
      });

      // Podrías aquí enviar notificación al usuario
      req.isNewDevice = true;
    }

    next();
  } catch (error) {
    logger.error('Device detection error', { error: error.message });
    next(); // No bloquear request
  }
};

/**
 * Middleware para limpiar sesiones expiradas periódicamente
 */
export const sessionCleanupMiddleware = (sessionManager) => {
  return async (req, res, next) => {
    try {
      // Limpiar cada 1 hora (puedes ajustar)
      const lastCleanup = global.lastSessionCleanup || 0;
      const now = Date.now();

      if (now - lastCleanup > 60 * 60 * 1000) {
        await sessionManager.cleanupExpiredSessions();
        global.lastSessionCleanup = now;
      }
    } catch (error) {
      logger.error('Session cleanup error', { error: error.message });
    }

    next();
  };
};

export default {
  sessionValidationMiddleware,
  deviceDetectionMiddleware,
  sessionCleanupMiddleware,
};
