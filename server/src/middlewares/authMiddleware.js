import jwt from 'jsonwebtoken';
import { extractBearerToken, getJwtSecret } from '../utils/auth.js';

const normalizeRoles = (roles = []) => roles.map((role) => String(role || '').trim().toUpperCase()).filter(Boolean);

export const authMiddleware = async (req, res, next) => {
  const token = extractBearerToken(req);
  const prisma = req.prisma;

  if (!prisma) {
    return res.status(500).json({ message: 'Base de datos no disponible para autenticación' });
  }

  if (!token) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());

    if (decoded?.type !== 'access' || !decoded?.sid || !decoded?.sub || !decoded?.jti) {
      return res.status(401).json({ message: 'Token no válido' });
    }

    const session = await prisma.authSession.findUnique({
      where: { id: decoded.sid },
      include: { user: true },
    });

    if (!session || session.userId !== decoded.sub) {
      return res.status(401).json({ message: 'Sesión no encontrada' });
    }

    if (session.revokedAt) {
      return res.status(401).json({ message: 'Sesión revocada' });
    }

    if (session.expiresAt <= new Date()) {
      return res.status(401).json({ message: 'Sesión expirada' });
    }

    if (session.accessTokenJti !== decoded.jti) {
      return res.status(401).json({ message: 'Token rotado' });
    }

    if (!session.user?.isActive) {
      return res.status(403).json({ message: 'Usuario deshabilitado' });
    }

    if (session.user.lockedUntil && new Date(session.user.lockedUntil) > new Date()) {
      return res.status(423).json({ message: 'Cuenta temporalmente bloqueada' });
    }

    req.user = {
      userId: session.user.id,
      email: session.user.email,
      role: session.user.role,
      fullName: session.user.fullName,
      sessionId: session.id,
      tokenId: decoded.jti,
    };

    req.authSession = session;

    return next();
  } catch (error) {
    const isExpiredToken = error.name === 'TokenExpiredError';
    return res.status(401).json({
      message: isExpiredToken ? 'Token expirado' : 'Token no válido',
    });
  }
};

export const checkRole = (...roles) => {
  const allowedRoles = normalizeRoles(roles.flat());

  return (req, res, next) => {
    const currentRole = String(req.user?.role || '').toUpperCase();

    if (!currentRole) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    if (!allowedRoles.includes(currentRole)) {
      return res.status(403).json({ message: 'No autorizado para esta acción' });
    }

    return next();
  };
};
