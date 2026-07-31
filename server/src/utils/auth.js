import crypto from 'node:crypto';

const DEFAULT_AUTHORIZED_EMAIL = 'centrokareh@gmail.com';
const PLACEHOLDER_AUTHORIZED_EMAILS = new Set([
  'tu_email@gmail.com',
  'tu_correo@gmail.com',
  'your_email@gmail.com',
  'your_email@example.com',
]);

const DEFAULT_ACCESS_TOKEN_TTL = '8h';
const DEFAULT_REFRESH_TOKEN_TTL = '7d';
const DEFAULT_OTP_TTL_MS = 15 * 60 * 1000;
const DEFAULT_MAX_OTP_ATTEMPTS = 5;
const DEFAULT_ACCOUNT_LOCK_MINUTES = 30;

const DURATION_UNITS_MS = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export const USER_ROLES = ['SUPER_USER', 'ADMIN', 'PROFESSIONAL', 'SECRETARIA'];

const normalizeBootstrapRole = (value = '') => {
  const normalizedRole = String(value || '').trim().toUpperCase();

  if (normalizedRole === 'DOCTOR') return 'PROFESSIONAL';
  if (normalizedRole === 'RECEPTIONIST') return 'SECRETARIA';
  if (normalizedRole === 'PATIENT') return 'ADMIN';
  if (normalizedRole === 'SUPERUSER') return 'SUPER_USER';
  if (normalizedRole === 'KINESIOLOGO') return 'PROFESSIONAL';

  return normalizedRole;
};

export const isProduction = () => process.env.NODE_ENV === 'production';
export const shouldUseSecureCookies = () => process.env.COOKIE_SECURE === 'true' || isProduction();
export const getCookieSameSite = () => (shouldUseSecureCookies() ? 'None' : 'Lax');

export const normalizeEmail = (value = '') => String(value).trim().toLowerCase();

export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET no configurado');
  }
  return secret;
};

export const getRefreshSecret = () => (
  process.env.JWT_REFRESH_SECRET
  || process.env.REFRESH_TOKEN_SECRET
  || getJwtSecret()
);

const getHashPepper = () => process.env.AUTH_HASH_PEPPER || getJwtSecret();
const getOtpPepper = () => process.env.OTP_PEPPER || getHashPepper();

export const parseDurationToMs = (value, fallbackMs) => {
  if (value === undefined || value === null || value === '') {
    return fallbackMs;
  }

  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value * 1000;
  }

  const normalized = String(value).trim().toLowerCase();
  if (/^\d+$/.test(normalized)) {
    return Number(normalized) * 1000;
  }

  const match = normalized.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) {
    return fallbackMs;
  }

  return Number(match[1]) * DURATION_UNITS_MS[match[2]];
};

export const getAccessTokenConfig = () => {
  const raw = process.env.JWT_EXPIRES_IN || DEFAULT_ACCESS_TOKEN_TTL;
  return {
    raw,
    ttlMs: parseDurationToMs(raw, parseDurationToMs(DEFAULT_ACCESS_TOKEN_TTL, 15 * 60 * 1000)),
  };
};

export const getRefreshTokenConfig = () => {
  const raw = process.env.REFRESH_TOKEN_EXPIRES_IN || DEFAULT_REFRESH_TOKEN_TTL;
  return {
    raw,
    ttlMs: parseDurationToMs(raw, parseDurationToMs(DEFAULT_REFRESH_TOKEN_TTL, 30 * 24 * 60 * 60 * 1000)),
  };
};

export const getOtpTtlMs = () => parseDurationToMs(process.env.OTP_EXPIRES_IN, DEFAULT_OTP_TTL_MS);

export const getMaxOtpAttempts = () => {
  const parsed = Number.parseInt(process.env.MAX_OTP_ATTEMPTS || '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_OTP_ATTEMPTS;
};

export const getAccountLockDurationMs = () => {
  const minutes = Number.parseInt(process.env.ACCOUNT_LOCK_MINUTES || '', 10);
  return ((Number.isInteger(minutes) && minutes > 0) ? minutes : DEFAULT_ACCOUNT_LOCK_MINUTES) * 60 * 1000;
};

export const buildCookieOptions = (maxAgeMs) => ({
  httpOnly: true,
  secure: shouldUseSecureCookies(),
  sameSite: getCookieSameSite(),
  maxAge: maxAgeMs,
  path: '/',
});

export const setAuthCookies = (res, accessToken, refreshToken) => {
  const { ttlMs: accessTtlMs } = getAccessTokenConfig();
  const { ttlMs: refreshTtlMs } = getRefreshTokenConfig();
  res.cookie('accessToken', accessToken, buildCookieOptions(accessTtlMs));
  res.cookie('refreshToken', refreshToken, buildCookieOptions(refreshTtlMs));
};

const getCookieClearVariants = () => ([
  { path: '/' },
  { path: '/', httpOnly: true, sameSite: 'Lax' },
  { path: '/', httpOnly: true, sameSite: 'None', secure: true },
  { ...buildCookieOptions(0), expires: new Date(0) },
]);

export const clearAuthCookies = (res) => {
  const cookieNames = ['accessToken', 'refreshToken', 'auth_token'];
  const clearVariants = getCookieClearVariants();

  cookieNames.forEach((cookieName) => {
    clearVariants.forEach((options) => {
      res.clearCookie(cookieName, options);
    });
    res.cookie(cookieName, '', {
      ...buildCookieOptions(0),
      expires: new Date(0),
    });
  });
};

export const hashToken = (value = '') => crypto
  .createHash('sha256')
  .update(`${getHashPepper()}:${String(value)}`)
  .digest('hex');

export const hashOtpCode = (value = '') => crypto
  .createHash('sha256')
  .update(`${getOtpPepper()}:${String(value)}`)
  .digest('hex');

export const generateOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));

export const generateTokenId = () => crypto.randomUUID();

export const extractBearerToken = (req) => {
  const authHeader = req.headers.authorization;
  return req.cookies?.accessToken
    || (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null)
    || req.cookies?.auth_token
    || null;
};

export const extractRefreshToken = (req) => req.cookies?.refreshToken || null;

export const getRequestIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (Array.isArray(forwardedFor)) {
    return forwardedFor[0] || req.ip || null;
  }
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || null;
};

export const getRequestUserAgent = (req) => String(req.headers['user-agent'] || '').slice(0, 1024) || null;

const parseBootstrapUsersFromJson = (rawValue) => {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) => ({
        email: normalizeEmail(entry?.email),
        fullName: String(entry?.fullName || entry?.name || '').trim(),
        role: normalizeBootstrapRole(entry?.role),
      }))
      .filter((entry) => entry.email && entry.fullName && USER_ROLES.includes(entry.role));
  } catch {
    return [];
  }
};

const parseBootstrapUsersFromLegacyEnv = () => {
  const authorizedEmail = normalizeEmail(process.env.AUTHORIZED_EMAIL || DEFAULT_AUTHORIZED_EMAIL);
  const email = PLACEHOLDER_AUTHORIZED_EMAILS.has(authorizedEmail) ? DEFAULT_AUTHORIZED_EMAIL : authorizedEmail;
  if (!email) return [];

  return [{
    email,
    fullName: String(process.env.AUTHORIZED_USER_NAME || 'Administrador').trim() || 'Administrador',
    role: 'SUPER_USER',
  }];
};

export const getBootstrapUsers = () => {
  const explicitUsers = parseBootstrapUsersFromJson(process.env.AUTH_BOOTSTRAP_USERS);
  if (explicitUsers.length > 0) {
    return explicitUsers;
  }

  return parseBootstrapUsersFromLegacyEnv();
};

export const getBootstrapUserByEmail = (email) => {
  const normalizedEmail = normalizeEmail(email);
  return getBootstrapUsers().find((entry) => entry.email === normalizedEmail) || null;
};

export const serializeUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.fullName,
  role: user.role,
  professionalId: user.professionalId || null,
});
