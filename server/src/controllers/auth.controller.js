import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import {
  allowHeaderFallback,
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
  wantsFallbackToken,
} from '../utils/auth.js';
import { auditActions, safeWriteAuditLog } from '../utils/audit.js';

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

const buildAuthSuccessPayload = (req, user, accessToken) => {
  const payload = {
    success: true,
    user: serializeUser(user),
  };

  if (allowHeaderFallback() && wantsFallbackToken(req)) {
    payload.accessToken = accessToken;
  }

  return payload;
};

const sendOtpEmail = async (email, otp) => {
  const resend = getResendClient();
  const otpValidityMinutes = Math.max(1, Math.ceil(getOtpTtlMs() / 60000));
  if (!resend) {
    if (isProduction()) {
      throw new Error('Servicio de correo no configurado');
    }

    console.warn(`⚠️ [DEV] OTP local para ${email}: ${otp}`);
    return { delivered: false, devOtp: otp };
  }

  const { error } = await resend.emails.send({
    from: 'Kareh Salud <onboarding@resend.dev>',
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
    return res.status(500).json({ message: 'Base de datos no disponible para autenticación' });
  }

  try {
    const normalizedEmail = normalizeEmail(req.body?.email);
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return res.status(400).json({ message: 'Email inválido' });
    }

    const user = await ensureAuthorizedUser(prisma, normalizedEmail);
    if (!user) {
      await safeWriteAuditLog(prisma, req, {
        action: auditActions.authOtpRequestDenied,
        resource: 'AUTH',
        details: { email: normalizedEmail, reason: 'UNKNOWN_USER' },
      });
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
    console.error('❌ Error en requestOTP:', error);
    return res.status(500).json({ message: error.message || 'Error interno' });
  }
};

export const verifyOTP = async (req, res) => {
  const prisma = getPrismaFromRequest(req);
  if (!prisma) {
    return res.status(500).json({ message: 'Base de datos no disponible para autenticación' });
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

      if (shouldLock) {
        return res.status(423).json({ message: 'Cuenta bloqueada por demasiados intentos fallidos.' });
      }

      return res.status(401).json({ message: 'Código incorrecto' });
    }

    const sessionId = generateTokenId();
    const { accessToken, refreshToken, accessTokenId, refreshExpiresAt } = buildLoginTokens(user, sessionId);
    const now = new Date();

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

      await tx.authSession.create({
        data: {
          id: sessionId,
          userId: user.id,
          refreshTokenHash: hashToken(refreshToken),
          accessTokenJti: accessTokenId,
          ipAddress: getRequestIp(req),
          userAgent: getRequestUserAgent(req),
          expiresAt: refreshExpiresAt,
          lastUsedAt: now,
        },
      });
    });

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
        sessionId,
      },
    });

    return res.json(buildAuthSuccessPayload(req, freshUser, accessToken));
  } catch (error) {
    console.error('❌ Error en verifyOTP:', error);
    return res.status(500).json({ message: 'Error en la verificación' });
  }
};

export const verifyToken = async (req, res) => {
  const prisma = getPrismaFromRequest(req);
  const token = extractBearerToken(req);

  if (!token) {
    return res.status(401).json({ valid: false, message: 'Token no proporcionado' });
  }

  if (!prisma) {
    return res.status(500).json({ valid: false, message: 'Base de datos no disponible para autenticación' });
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
    if (prisma && refreshToken) {
      const decoded = jwt.verify(refreshToken, getRefreshSecret());
      if (decoded?.sid) {
        await prisma.authSession.updateMany({
          where: {
            id: decoded.sid,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
            revokedReason: 'LOGOUT',
          },
        });

        await safeWriteAuditLog(prisma, req, {
          userId: decoded.sub || null,
          action: auditActions.authLogout,
          resource: 'AUTH',
          resourceId: decoded.sid,
          details: { reason: 'REFRESH_TOKEN' },
        });
      }
    } else if (prisma && accessToken) {
      const decoded = jwt.verify(accessToken, getJwtSecret());
      if (decoded?.sid) {
        await prisma.authSession.updateMany({
          where: {
            id: decoded.sid,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
            revokedReason: 'LOGOUT',
          },
        });
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
    return res.status(500).json({ message: 'Base de datos no disponible para autenticación' });
  }

  try {
    const decoded = jwt.verify(token, getRefreshSecret());
    if (decoded?.type !== 'refresh' || !decoded?.sid || !decoded?.sub) {
      return res.status(401).json({ message: 'Refresh token inválido' });
    }

    const session = await prisma.authSession.findUnique({
      where: { id: decoded.sid },
      include: { user: true },
    });

    if (!session || session.userId !== decoded.sub) {
      return res.status(401).json({ message: 'Sesión no encontrada' });
    }

    if (session.revokedAt || session.expiresAt <= new Date()) {
      return res.status(401).json({ message: 'Refresh token expirado o revocado' });
    }

    if (session.refreshTokenHash !== hashToken(token)) {
      await prisma.authSession.updateMany({
        where: {
          id: session.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokedReason: 'REFRESH_TOKEN_REUSE_DETECTED',
        },
      });

      await safeWriteAuditLog(prisma, req, {
        userId: session.userId,
        action: auditActions.authRefreshFailed,
        resource: 'AUTH',
        resourceId: session.id,
        details: { reason: 'REFRESH_TOKEN_REUSE_DETECTED' },
      });

      clearAuthCookies(res);
      return res.status(401).json({ message: 'Refresh token inválido' });
    }

    if (!session.user?.isActive) {
      return res.status(403).json({ message: 'Usuario deshabilitado' });
    }

    if (isUserLocked(session.user)) {
      return res.status(423).json({ message: 'Cuenta temporalmente bloqueada' });
    }

    const { accessToken, refreshToken: newRefreshToken, accessTokenId, refreshExpiresAt } = buildLoginTokens(session.user, session.id);

    await prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: hashToken(newRefreshToken),
        accessTokenJti: accessTokenId,
        expiresAt: refreshExpiresAt,
        lastUsedAt: new Date(),
      },
    });

    setAuthCookies(res, accessToken, newRefreshToken);

    await safeWriteAuditLog(prisma, req, {
      userId: session.userId,
      action: auditActions.authRefreshSucceeded,
      resource: 'AUTH',
      resourceId: session.id,
      details: { role: session.user.role },
    });

    const payload = { success: true };
    if (allowHeaderFallback() && wantsFallbackToken(req)) {
      payload.accessToken = accessToken;
    }

    return res.json(payload);
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
