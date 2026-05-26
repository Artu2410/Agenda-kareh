import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';
import {
  getJwtSecret,
  getRefreshSecret,
  getAccessTokenConfig,
  getRefreshTokenConfig,
  generateTokenId,
} from '../utils/auth.js';
import { hashToken } from '../utils/auth.js';

/**
 * Session Manager - Maneja creación, rotación y validación de tokens
 * Incluye audit logging de cambios de sesión
 */
export class SessionManager {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Generar nuevo access token JWT
   */
  generateAccessToken(userId, role, sessionId, expiresIn) {
    const accessCfg = getAccessTokenConfig();
    const secret = getJwtSecret();
    const jti = generateTokenId();

    const token = jwt.sign(
      {
        sub: userId,
        userId,
        role,
        sid: sessionId,
        type: 'access',
      },
      secret,
      { expiresIn: expiresIn || accessCfg.raw, jwtid: jti }
    );

    return { token, jti };
  }

  /**
   * Generar nuevo refresh token JWT
   */
  generateRefreshToken(userId, sessionId, expiresIn) {
    const refreshCfg = getRefreshTokenConfig();
    const secret = getRefreshSecret();
    const jti = generateTokenId();

    const token = jwt.sign(
      {
        sub: userId,
        userId,
        sid: sessionId,
        type: 'refresh',
      },
      secret,
      { expiresIn: expiresIn || refreshCfg.raw, jwtid: jti }
    );

    return { token, jti };
  }

  /**
   * Crear nueva sesión en BD (post-login)
   */
  async createSession(userId, ipAddress, userAgent, role = 'USER') {
    const sessionId = generateTokenId();
    const { token: refreshToken } = this.generateRefreshToken(userId, sessionId);

    // Hash del refresh token (usando pepper y la función común)
    const refreshTokenHash = hashToken(refreshToken);

    // Crear access token y obtener su jti
    const { token: accessToken, jti: accessJti } = this.generateAccessToken(userId, role, sessionId);

    const session = await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId,
        refreshTokenHash,
        accessTokenJti: accessJti,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
        lastUsedAt: new Date(),
      },
    });

    // Audit log
    await this.logAuditEvent(userId, 'SESSION_CREATED', {
      sessionId: session.id,
      ipAddress,
      userAgent,
    });

    logger.info('Session created', { userId, sessionId: session.id });

    return {
      refreshToken,
      accessToken,
      sessionId: session.id,
    };
  }

  /**
   * Rotar tokens (generar nuevo access + refresh)
   * Invalida el refresh token anterior
   */
  async rotateTokens(userId, currentRefreshTokenHash, role = 'USER') {
    // Validar sesión actual
    const session = await this.prisma.authSession.findFirst({
      where: {
        userId,
        refreshTokenHash: currentRefreshTokenHash,
        revokedAt: null,
      },
    });

    if (!session) {
      throw new Error('Sesión inválida o revocada');
    }

    // Generar nuevos tokens
    const { token: newRefreshToken, jti: newRefreshJti } = this.generateRefreshToken(userId, session.id);
    const { token: newAccessToken, jti: newAccessJti } = this.generateAccessToken(userId, role, session.id);

    // Hash del nuevo refresh token
    const newRefreshTokenHash = hashToken(newRefreshToken);

    // Actualizar sesión con nuevos tokens
    const updatedSession = await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: newRefreshTokenHash,
        accessTokenJti: newAccessJti,
        lastUsedAt: new Date(),
      },
    });

    // Audit log
    await this.logAuditEvent(userId, 'TOKEN_ROTATED', {
      sessionId: session.id,
      oldAccessJti: session.accessTokenJti,
      newAccessJti: newAccessJti,
    });

    logger.info('Tokens rotated', { userId, sessionId: session.id });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: '15m',
    };
  }

  /**
   * Revocar sesión (logout)
   */
  async revokeSession(userId, sessionId) {
    const session = await this.prisma.authSession.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
      },
    });

    // Audit log
    await this.logAuditEvent(userId, 'SESSION_REVOKED', {
      sessionId,
      revokedAt: new Date(),
    });

    logger.info('Session revoked', { userId, sessionId });

    return session;
  }

  /**
   * Revocar todas las sesiones del usuario
   */
  async revokeAllSessions(userId, reason = 'Manual logout') {
    const sessions = await this.prisma.authSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    // Audit log
    await this.logAuditEvent(userId, 'ALL_SESSIONS_REVOKED', {
      count: sessions.count,
      reason,
    });

    logger.info('All sessions revoked for user', { userId, count: sessions.count });

    return sessions;
  }

  /**
   * Obtener sesiones activas del usuario
   */
  async getActiveSessions(userId) {
    const sessions = await this.prisma.authSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
    });

    return sessions;
  }

  /**
   * Limpiar sesiones expiradas
   */
  async cleanupExpiredSessions() {
    const deleted = await this.prisma.authSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    if (deleted.count > 0) {
      logger.info('Expired sessions cleaned up', { count: deleted.count });
    }

    return deleted;
  }

  /**
   * Registrar evento de auditoría
   */
  async logAuditEvent(userId, action, metadata = {}) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          metadata: JSON.stringify(metadata),
          createdAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to log audit event', {
        userId,
        action,
        error: error.message,
      });
    }
  }
}

export default SessionManager;
