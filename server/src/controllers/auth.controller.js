import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import {
  clearAuthCookies,
  extractBearerToken,
  extractRefreshToken,
  generateOtpCode,
  generateTokenId,
  getAccessTokenConfig,
  getAccountLockDurationMs,
  getBootstrapUserByEmail,
  getJwtSecret,
  getMaxOtpAttempts,
  getOtpTtlMs,
  getRefreshSecret,
  getRefreshTokenConfig,
  getRequestIp,
  getRequestUserAgent,
  hashOtpCode,
  hashToken,
  isProduction,
  normalizeEmail,
  serializeUser,
  setAuthCookies,
} from '../utils/auth.js';
import { auditActions, safeWriteAuditLog } from '../utils/audit.js';
import SessionManager from '../utils/sessionManager.js';
import { createInternalError, createPublicError } from '../errors/AppError.js';
import logger from '../config/logger.js';
import { recordLoginFailure } from '../lib/metrics.js';

const authLogger = logger.child({ service: 'auth' });

const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? new Resend(apiKey) : null;
};

const getPrismaFromRequest = (req) => req.prisma || null;

const getActiveChallenge = (prisma, email) => prisma.authOtpChallenge.findFirst({
  where: {
    email,
    consumedAt: null,
    expiresAt: {
      gt: new Date(),
    },
  },
  orderBy: {
    createdAt: 'desc',
  },
});

const isUserLocked = (user) => Boolean(user?.lockedUntil && new Date(user.lockedUntil) > new Date());

const ensureAuthorizedUser = async (prisma, email) => {
  const normalizedEmail = normalizeEmail(email);
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    return existingUser;
  }

  const bootstrapUser = getBootstrapUserByEmail(normalizedEmail);
  if (!bootstrapUser) {
    return null;
  }

  return prisma.user.upsert({
    where: { email: bootstrapUser.email },
    update: {},
    create: {
      email: bootstrapUser.email,
      fullName: bootstrapUser.fullName,
      role: bootstrapUser.role,
    },
  });
};

const lockUser = async (prisma, userId, attempts) => {
  const lockedUntil = new Date(Date.now() + getAccountLockDurationMs());
  return prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: attempts,
      lockedUntil,
    },
  });
};

const buildLoginTokens = (user, sessionId) => {
  const accessTokenId = generateTokenId();
  const refreshTokenId = generateTokenId();
  const accessConfig = getAccessTokenConfig();
  const refreshConfig = getRefreshTokenConfig();

  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: sessionId,
      type: 'access',
    },
    getJwtSecret(),
    {
      expiresIn: accessConfig.raw,
      jwtid: accessTokenId,
    },
  );

  const refreshToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: sessionId,
      type: 'refresh',
    },
    getRefreshSecret(),
    {
      expiresIn: refreshConfig.raw,
      jwtid: refreshTokenId,
    },
  );

  return {
    accessToken,
    refreshToken,
    accessTokenId,
    refreshExpiresAt: new Date(Date.now() + refreshConfig.ttlMs),
  };
};

const buildAuthSuccessPayload = (user, accessToken) => ({
  success: true,
  user: serializeUser(user),
  accessToken,
});

const sendOtpEmail = async (email, otp) => {
  const resend = getResendClient();
  const otpValidityMinutes = Math.max(1, Math.ceil(getOtpTtlMs() / 60000));
  if (!resend) {
    if (isProduction()) {
      throw new Error('Servicio de correo no configurado');
    }

    authLogger.warn('OTP local en desarrollo', { email });
    return { delivered: false, devOtp: otp };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const fromName = process.env.RESEND_FROM_NAME || 'Kareh Salud';

  const { error } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: email,
    subject: 'Tu código de acceso a Kareh Salud',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; padding: 20px;">
        <h2 style="color: #0d9488;">Kareh Salud</h2>
        <p>Usa el siguiente código para iniciar sesión:</p>
        <div style="background: #f1f5f9; padding: 20px; text-align: center; border-radius: 8px;">
          <span style="font-size: 32px; font-weight: bold; color: #0d9488;">${otp}</span>
        </div>
        <p style="font-size: 12px; color: #64748b;">Válido por ${otpValidityMinutes} minutos.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error('No se pudo enviar el correo');
  }

  return { delivered: true };
};

const validateAccessSession = async (prisma, decodedToken) => {
  if (decodedToken?.type !== 'access' || !decodedToken?.sid || !decodedToken?.sub || !decodedToken?.jti) {
    return { ok: false, status: 401, message: 'Token no válido' };
  }

  const session = await prisma.authSession.findUnique({
    where: { id: decodedToken.sid },
    include: { user: true },
  });

  if (!session || session.userId !== decodedToken.sub) {
    return { ok: false, status: 401, message: 'Sesión no encontrada' };
  }

  if (session.revokedAt) {
    return { ok: false, status: 401, message: 'Sesión revocada' };
  }

  if (session.expiresAt <= new Date()) {
    return { ok: false, status: 401, message: 'Sesión expirada' };
  }

  if (session.accessTokenJti !== decodedToken.jti) {
    return { ok: false, status: 401, message: 'Token rotado' };
  }

  if (!session.user?.isActive) {
    return { ok: false, status: 403, message: 'Usuario deshabilitado' };
  }

  if (isUserLocked(session.user)) {
    return { ok: false, status: 423, message: 'Cuenta temporalmente bloqueada' };
  }

  return { ok: true, session };
};

export const requestOTP = async (req, res) => {
  const prisma = getPrismaFromRequest(req);
  if (!prisma) {
    throw createPublicError(503, 'Servicio de autenticación no disponible', new Error('Base de datos no disponible para autenticación'));
  }

  try {
    const normalizedEmail = normalizeEmail(req.body?.email);
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      recordLoginFailure({ step: 'request-otp', reason: 'INVALID_EMAIL' });
      return res.status(400).json({ message: 'Email inválido' });
    }

    const user = await ensureAuthorizedUser(prisma, normalizedEmail);
    if (!user) {
      await safeWriteAuditLog(prisma, req, {
        action: auditActions.authOtpRequestDenied,
        resource: 'AUTH',
        details: { email: normalizedEmail, reason: 'UNKNOWN_USER' },
      });
      recordLoginFailure({ step: 'request-otp', reason: 'UNKNOWN_USER' });
      return res.status(403).json({
        message: 'Acceso denegado',
        detail: 'El correo no está habilitado para ingresar.',
      });
    }

    if (!user.isActive) {
      await safeWriteAuditLog(prisma, req, {
        userId: user.id,
        action: auditActions.authOtpRequestDenied,
        resource: 'AUTH',
        resourceId: user.id,
        details: { email: normalizedEmail, reason: 'INACTIVE_USER' },
      });
      recordLoginFailure({ step: 'request-otp', reason: 'INACTIVE_USER' });
      return res.status(403).json({ message: 'Usuario deshabilitado' });
    }

    if (isUserLocked(user)) {
      await safeWriteAuditLog(prisma, req, {
        userId: user.id,
        action: auditActions.authOtpRequestDenied,
        resource: 'AUTH',
        resourceId: user.id,
        details: { email: normalizedEmail, reason: 'ACCOUNT_LOCKED' },
      });
      recordLoginFailure({ step: 'request-otp', reason: 'ACCOUNT_LOCKED' });
      return res.status(423).json({ message: 'Cuenta temporalmente bloqueada. Intenta nuevamente más tarde.' });
    }

    const otp = generateOtpCode();
    const expiresAt = new Date(Date.now() + getOtpTtlMs());

    await prisma.$transaction([
      prisma.authOtpChallenge.deleteMany({
        where: {
          email: normalizedEmail,
          consumedAt: null,
        },
      }),
      prisma.authOtpChallenge.create({
        data: {
          userId: user.id,
          email: normalizedEmail,
          codeHash: hashOtpCode(otp),
          expiresAt,
        },
      }),
    ]);

    let emailResult;

    try {
      emailResult = await sendOtpEmail(normalizedEmail, otp);
    } catch (error) {
      await prisma.authOtpChallenge.deleteMany({
        where: {
          email: normalizedEmail,
          consumedAt: null,
        },
      });
      throw error;
    }

    await safeWriteAuditLog(prisma, req, {
      userId: user.id,
      action: auditActions.authOtpRequested,
      resource: 'AUTH',
      resourceId: user.id,
      details: { email: normalizedEmail, expiresAt: expiresAt.toISOString() },
    });

    return res.json({
      success: true,
      message: emailResult.delivered ? 'Código OTP enviado' : 'Código OTP generado en modo desarrollo',
      devOtp: emailResult.devOtp,
    });
  } catch (error) {
    throw createInternalError(error, 'No se pudo solicitar el código OTP');
  }
};

export const verifyOTP = async (req, res) => {
  const prisma = getPrismaFromRequest(req);
  if (!prisma) {
    throw createPublicError(503, 'Servicio de autenticación no disponible', new Error('Base de datos no disponible para autenticación'));
  }

  try {
    const normalizedEmail = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp || '').trim();
    const user = await ensureAuthorizedUser(prisma, normalizedEmail);

    if (!user || !user.isActive) {
      await safeWriteAuditLog(prisma, req, {
        action: auditActions.authLoginFailed,
        resource: 'AUTH',
        details: { email: normalizedEmail, reason: 'UNKNOWN_OR_DISABLED_USER' },
      });
      recordLoginFailure({ step: 'verify-otp', reason: 'UNKNOWN_OR_DISABLED_USER' });
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    if (isUserLocked(user)) {
      await safeWriteAuditLog(prisma, req, {
        userId: user.id,
        action: auditActions.authLoginFailed,
        resource: 'AUTH',
        resourceId: user.id,
        details: { email: normalizedEmail, reason: 'ACCOUNT_LOCKED' },
      });
      recordLoginFailure({ step: 'verify-otp', reason: 'ACCOUNT_LOCKED' });
      return res.status(423).json({ message: 'Cuenta temporalmente bloqueada. Solicita un nuevo código más tarde.' });
    }

    const challenge = await getActiveChallenge(prisma, normalizedEmail);
    if (!challenge) {
      await safeWriteAuditLog(prisma, req, {
        userId: user.id,
        action: auditActions.authLoginFailed,
        resource: 'AUTH',
        resourceId: user.id,
        details: { email: normalizedEmail, reason: 'MISSING_OR_EXPIRED_OTP' },
      });
      recordLoginFailure({ step: 'verify-otp', reason: 'MISSING_OR_EXPIRED_OTP' });
      return res.status(400).json({ message: 'No hay un código vigente para verificar.' });
    }

    const otpMatches = hashOtpCode(otp) === challenge.codeHash;
    if (!otpMatches) {
      const nextAttempts = Math.max(user.failedLoginAttempts + 1, challenge.attemptCount + 1);
      const shouldLock = nextAttempts >= getMaxOtpAttempts();

      await prisma.$transaction(async (tx) => {
        await tx.authOtpChallenge.update({
          where: { id: challenge.id },
          data: {
            attemptCount: challenge.attemptCount + 1,
            lastAttemptAt: new Date(),
          },
        });

        if (shouldLock) {
          await tx.authOtpChallenge.deleteMany({
            where: {
              userId: user.id,
              consumedAt: null,
            },
          });
          await lockUser(tx, user.id, nextAttempts);
          return;
        }

        await tx.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: nextAttempts,
          },
        });
      });

      await safeWriteAuditLog(prisma, req, {
        userId: user.id,
        action: auditActions.authLoginFailed,
        resource: 'AUTH',
        resourceId: user.id,
        details: {
          email: normalizedEmail,
          reason: shouldLock ? 'OTP_ATTEMPTS_LOCKED' : 'INVALID_OTP',
          attemptCount: challenge.attemptCount + 1,
        },
      });
      recordLoginFailure({ step: 'verify-otp', reason: shouldLock ? 'OTP_ATTEMPTS_LOCKED' : 'INVALID_OTP' });

      if (shouldLock) {
        return res.status(423).json({ message: 'Cuenta bloqueada por demasiados intentos fallidos.' });
      }

      return res.status(401).json({ message: 'Código incorrecto' });
    }

    const now = new Date();

    // Mark challenge consumed and cleanup previous challenges + reset counters
    await prisma.$transaction(async (tx) => {
      await tx.authOtpChallenge.update({
        where: { id: challenge.id },
        data: {
          consumedAt: now,
          lastAttemptAt: now,
        },
      });

      await tx.authOtpChallenge.deleteMany({
        where: {
          userId: user.id,
          id: { not: challenge.id },
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: now,
        },
      });
    });

    // Create session via SessionManager
    const sessionManager = new SessionManager(prisma);
    const { refreshToken, accessToken, sessionId: createdSessionId } = await sessionManager.createSession(
      user.id,
      getRequestIp(req),
      getRequestUserAgent(req),
      user.role,
    );

    setAuthCookies(res, accessToken, refreshToken);

    const freshUser = {
      ...user,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: now,
    };

    await safeWriteAuditLog(prisma, req, {
      userId: user.id,
      action: auditActions.authLoginSucceeded,
      resource: 'AUTH',
      resourceId: user.id,
      details: {
        email: normalizedEmail,
        role: user.role,
        sessionId: createdSessionId,
      },
    });

    return res.json(buildAuthSuccessPayload(freshUser, accessToken));
  } catch (error) {
    throw createInternalError(error, 'Error en la verificación');
  }
};

export const verifyToken = async (req, res) => {
  const prisma = getPrismaFromRequest(req);
  const token = extractBearerToken(req);

  if (!token) {
    return res.status(401).json({ valid: false, message: 'Token no proporcionado' });
  }

  if (!prisma) {
    throw createPublicError(503, 'Servicio de autenticación no disponible', new Error('Base de datos no disponible para autenticación'));
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const validation = await validateAccessSession(prisma, decoded);

    if (!validation.ok) {
      return res.status(validation.status).json({ valid: false, message: validation.message });
    }

    return res.status(200).json({
      valid: true,
      user: serializeUser(validation.session.user),
    });
  } catch (error) {
    return res.status(401).json({ valid: false, message: 'Token inválido o expirado' });
  }
};

export const logout = async (req, res) => {
  const prisma = getPrismaFromRequest(req);
  const refreshToken = extractRefreshToken(req);
  const accessToken = extractBearerToken(req);

  try {
    if (prisma && (refreshToken || accessToken)) {
      const sessionManager = new SessionManager(prisma);

      if (refreshToken) {
        try {
          const decoded = jwt.verify(refreshToken, getRefreshSecret());
          if (decoded?.sid) {
            await sessionManager.revokeSession(decoded.sub, decoded.sid);
            await safeWriteAuditLog(prisma, req, {
              userId: decoded.sub || null,
              action: auditActions.authLogout,
              resource: 'AUTH',
              resourceId: decoded.sid,
              details: { reason: 'REFRESH_TOKEN' },
            });
          }
        } catch {}
      } else if (accessToken) {
        try {
          const decoded = jwt.verify(accessToken, getJwtSecret());
          if (decoded?.sid) {
            await sessionManager.revokeSession(decoded.sub, decoded.sid);
          }
        } catch {}
      }
    }
  } catch {
    // Aunque falle la revocación, igualmente limpiamos cookies.
  }

  res.set('Cache-Control', 'no-store');
  clearAuthCookies(res);
  return res.json({ success: true, message: 'Sesión cerrada' });
};

export const refreshToken = async (req, res) => {
  const prisma = getPrismaFromRequest(req);
  const token = extractRefreshToken(req);

  if (!token) {
    return res.status(401).json({ message: 'Refresh token no proporcionado' });
  }

  if (!prisma) {
    throw createPublicError(503, 'Servicio de autenticación no disponible', new Error('Base de datos no disponible para autenticación'));
  }

  try {
    const decoded = jwt.verify(token, getRefreshSecret());
    if (decoded?.type !== 'refresh' || !decoded?.sid || !decoded?.sub) {
      return res.status(401).json({ message: 'Refresh token inválido' });
    }

    const sessionManager = new SessionManager(prisma);
    const currentHash = hashToken(token);

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await sessionManager.rotateTokens(
      decoded.sub,
      currentHash,
      decoded.role || 'USER',
    );

    setAuthCookies(res, newAccessToken, newRefreshToken);

    await safeWriteAuditLog(prisma, req, {
      userId: decoded.sub,
      action: auditActions.authRefreshSucceeded,
      resource: 'AUTH',
      resourceId: decoded.sid,
      details: { role: decoded.role || 'USER' },
    });

    return res.json({
      success: true,
      accessToken: newAccessToken,
    });
  } catch (error) {
    await safeWriteAuditLog(prisma, req, {
      action: auditActions.authRefreshFailed,
      resource: 'AUTH',
      details: { reason: 'INVALID_REFRESH_TOKEN' },
    });
    clearAuthCookies(res);
    return res.status(401).json({ message: 'Refresh token inválido o expirado' });
  }
};
