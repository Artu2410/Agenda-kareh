import jwt from 'jsonwebtoken';
import { Resend } from 'resend';

// 1. Configuración de Variables de Entorno
const OTP_TTL_MS = 15 * 60 * 1000;
const DEFAULT_AUTHORIZED_EMAIL = 'centrokareh@gmail.com';
const PLACEHOLDER_AUTHORIZED_EMAILS = new Set([
  'tu_email@gmail.com',
  'tu_correo@gmail.com',
  'your_email@gmail.com',
  'your_email@example.com'
]);

// DURACIÓN DE SESIÓN: 30 DÍAS
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; 
const SESSION_DURATION_STR = '30d';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET no configurado');
  }
  return secret;
};

const getRefreshSecret = () => process.env.REFRESH_TOKEN_SECRET || getJwtSecret();
const getAuthorizedEmail = () => {
  const configuredEmail = (process.env.AUTHORIZED_EMAIL || DEFAULT_AUTHORIZED_EMAIL).trim().toLowerCase();
  return PLACEHOLDER_AUTHORIZED_EMAILS.has(configuredEmail) ? DEFAULT_AUTHORIZED_EMAIL : configuredEmail;
};
const isProduction = () => process.env.NODE_ENV === 'production';
const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? new Resend(apiKey) : null;
};

const allowHeaderFallback = () => process.env.ALLOW_AUTH_HEADER_FALLBACK !== 'false';
const wantsFallbackToken = (req) => String(req.headers['x-auth-fallback'] || '').toLowerCase() === '1';

const buildCookieOptions = (maxAgeMs) => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: isProduction() ? 'None' : 'Lax',
  maxAge: maxAgeMs,
  path: '/',
});

const setAuthCookies = (res, accessToken, refreshToken) => {
  // Ahora ambas cookies duran 30 días para evitar cierres inesperados
  res.cookie('accessToken', accessToken, buildCookieOptions(SESSION_DURATION_MS));
  res.cookie('refreshToken', refreshToken, buildCookieOptions(SESSION_DURATION_MS));
};

const getCookieClearVariants = () => ([
  { path: '/' },
  { path: '/', httpOnly: true, sameSite: 'Lax' },
  { path: '/', httpOnly: true, sameSite: 'None', secure: true },
  { ...buildCookieOptions(0), expires: new Date(0) },
]);

const clearAuthCookies = (res) => {
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

const otpStorage = new Map();

export const requestOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const authorizedEmail = getAuthorizedEmail();

    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Email inválido' });
    }

    const normalizedEmail = email.toLowerCase();

    if (normalizedEmail !== authorizedEmail) {
      return res.status(403).json({
        message: 'Acceso Denegado',
        detail: `Solo ${authorizedEmail} puede acceder.`
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + OTP_TTL_MS;

    otpStorage.set(normalizedEmail, { otp, expiresAt, attempts: 0 });
    const resend = getResendClient();

    if (!resend) {
      if (isProduction()) {
        return res.status(500).json({ message: 'Servicio de correo no configurado' });
      }
      console.warn(`⚠️ [DEV] OTP local para ${normalizedEmail}: ${otp}`);
      return res.json({
        success: true,
        message: 'Código OTP generado en modo desarrollo',
        devOtp: otp
      });
    }

    try {
      const { error } = await resend.emails.send({
        from: 'Kareh Salud <onboarding@resend.dev>',
        to: normalizedEmail,
        subject: '🔐 Tu código de acceso a Kareh Salud',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; padding: 20px;">
            <h2 style="color: #0d9488;">🏥 Kareh Salud</h2>
            <p>Usa el siguiente código para iniciar sesión:</p>
            <div style="background: #f1f5f9; padding: 20px; text-align: center; border-radius: 8px;">
              <span style="font-size: 32px; font-weight: bold; color: #0d9488;">${otp}</span>
            </div>
            <p style="font-size: 12px; color: #64748b;">Válido por 15 minutos.</p>
          </div>
        `
      });

      if (error) return res.status(500).json({ message: 'Error de Resend', error });
      res.json({ success: true, message: 'Código OTP enviado' });
    } catch (resendErr) {
      res.status(500).json({ message: 'No se pudo enviar el correo' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error interno' });
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = email?.toLowerCase();
    const storedData = otpStorage.get(normalizedEmail);

    if (!storedData) return res.status(400).json({ message: 'No hay código pendiente.' });
    if (Date.now() > storedData.expiresAt) return res.status(400).json({ message: 'Código expirado.' });

    if (otp !== storedData.otp) {
      storedData.attempts += 1;
      return res.status(401).json({ message: 'Código incorrecto' });
    }

    otpStorage.delete(normalizedEmail);

    // CORRECCIÓN: Seteamos la expiración a 30 días (SESSION_DURATION_STR)
    const accessToken = jwt.sign(
      { email: normalizedEmail, role: 'admin' },
      getJwtSecret(),
      { expiresIn: SESSION_DURATION_STR } 
    );
    const refreshToken = jwt.sign(
      { email: normalizedEmail, role: 'admin' },
      getRefreshSecret(),
      { expiresIn: SESSION_DURATION_STR }
    );

    setAuthCookies(res, accessToken, refreshToken);

    const payload = {
      success: true,
      user: { email: normalizedEmail, name: 'Administrador' }
    };
    if (allowHeaderFallback() && wantsFallbackToken(req)) {
      payload.accessToken = accessToken;
    }
    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: 'Error en la verificación' });
  }
};

export const verifyToken = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = req.cookies?.accessToken
      || (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

    if (!token) {
      return res.status(401).json({ valid: false, message: "Token no proporcionado" });
    }

    const decoded = jwt.verify(token, getJwtSecret());

    return res.status(200).json({ 
      valid: true, 
      user: {
        email: decoded.email,
        role: decoded.role,
        name: 'Administrador'
      } 
    });

  } catch (error) {
    return res.status(401).json({ valid: false, message: "Token inválido o expirado" });
  }
};

export const logout = (req, res) => {
  res.set('Cache-Control', 'no-store');
  clearAuthCookies(res);
  res.json({ success: true, message: 'Sesión cerrada' });
};

export const refreshToken = (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ message: 'Refresh token no proporcionado' });
    }

    const decoded = jwt.verify(token, getRefreshSecret());
    
    // CORRECCIÓN: También aquí extendemos a 30 días
    const accessToken = jwt.sign(
      { email: decoded.email, role: decoded.role || 'admin' },
      getJwtSecret(),
      { expiresIn: SESSION_DURATION_STR }
    );
    const newRefreshToken = jwt.sign(
      { email: decoded.email, role: decoded.role || 'admin' },
      getRefreshSecret(),
      { expiresIn: SESSION_DURATION_STR }
    );

    setAuthCookies(res, accessToken, newRefreshToken);
    const payload = { success: true };
    if (allowHeaderFallback() && wantsFallbackToken(req)) {
      payload.accessToken = accessToken;
    }
    return res.json(payload);
  } catch (error) {
    return res.status(401).json({ message: 'Refresh token inválido o expirado' });
  }
};
