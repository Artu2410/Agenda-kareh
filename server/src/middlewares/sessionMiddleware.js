import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';

/**
 * Middleware para validar tokens JWT y sesiones
 */
export const sessionValidationMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.authToken;

    if (!token) {
      return res.status(401).json({
        status: 'fail',
        message: 'Token no proporcionado',
      });
    }

    // Verificar token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Si tenemos sesión en BD, validarla
    if (req.prisma && decoded.jti) {
      const session = await req.prisma.authSession.findFirst({
        where: {
          userId: decoded.userId,
          accessTokenJti: decoded.jti,
          revokedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (!session) {
        return res.status(401).json({
          status: 'fail',
          message: 'Sesión inválida o expirada',
        });
      }

      // Actualizar lastUsedAt
      await req.prisma.authSession.update({
        where: { id: session.id },
        data: { lastUsedAt: new Date() },
      });

      req.session = session;
    }

    req.user = decoded;
    req.logger?.info('Session validated', { userId: decoded.userId });

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'fail',
        message: 'Token expirado',
      });
    }

    logger.warn('Token validation failed', { error: error.message });

    res.status(401).json({
      status: 'fail',
      message: 'Token inválido',
    });
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
