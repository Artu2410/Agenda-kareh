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

const buildCookieOptions = (maxAgeMs) => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: isProduction() ? 'None' : 'Lax',
  maxAge: maxAgeMs,
  path: '/',
});

const setAuthCookies = (res, accessToken, refreshToken) => {
  const accessMaxAge = 15 * 60 * 1000;
  const refreshMaxAge = 7 * 24 * 60 * 60 * 1000;
  res.cookie('accessToken', accessToken, buildCookieOptions(accessMaxAge));
  res.cookie('refreshToken', refreshToken, buildCookieOptions(refreshMaxAge));
};

const clearAuthCookies = (res) => {
  res.clearCookie('accessToken', buildCookieOptions(0));
  res.clearCookie('refreshToken', buildCookieOptions(0));
};

// Almacenamiento temporal de OTPs
const otpStorage = new Map();

/**
 * 1. SOLICITAR OTP
 */
export const requestOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const authorizedEmail = getAuthorizedEmail();

    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Email inválido' });
    }

    const normalizedEmail = email.toLowerCase();

    // Validar autorización
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

    // Modo local: permite probar login aunque no exista RESEND_API_KEY.
    if (!resend) {
      if (isProduction()) {
        return res.status(500).json({ message: 'Servicio de correo no configurado' });
      }

      console.warn(`⚠️ [DEV] RESEND_API_KEY no configurada. OTP local para ${normalizedEmail}: ${otp}`);
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

/**
 * 2. VERIFICAR OTP
 */
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

    // Generamos el token con los datos del usuario
    const accessToken = jwt.sign(
      { email: normalizedEmail, role: 'admin' },
      getJwtSecret(),
      { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign(
      { email: normalizedEmail, role: 'admin' },
      getRefreshSecret(),
      { expiresIn: '7d' }
    );

    setAuthCookies(res, accessToken, refreshToken);

    res.json({
      success: true,
      user: { email: normalizedEmail, name: 'Administrador' }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en la verificación' });
  }
};

/**
 * 3. VERIFICAR TOKEN (LÓGICA CORREGIDA)
 */
export const verifyToken = async (req, res) => {
  try {
    // 1. Extraemos el token del header Authorization
    const authHeader = req.headers.authorization;
    const token = req.cookies?.accessToken
      || (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

    if (!token) {
      console.log("⚠️ Intento de verificación sin token");
      return res.status(401).json({ valid: false, message: "Token no proporcionado" });
    }

    // 2. Verificamos usando la variable de entorno de Render
    const decoded = jwt.verify(token, getJwtSecret());

    console.log("✅ Token verificado para:", decoded.email);
    return res.status(200).json({ 
      valid: true, 
      user: {
        email: decoded.email,
        role: decoded.role,
        name: 'Administrador'
      } 
    });

  } catch (error) {
    console.error("❌ Error de verificación JWT:", error.message);
    // IMPORTANTE: Siempre responder JSON, nunca HTML
    return res.status(401).json({ valid: false, message: "Token inválido o expirado" });
  }
};

/**
 * 4. LOGOUT
 */
export const logout = (req, res) => {
  clearAuthCookies(res);
  res.json({ success: true, message: 'Sesión cerrada' });
};

/**
 * 5. REFRESH TOKEN
 */
export const refreshToken = (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ message: 'Refresh token no proporcionado' });
    }

    const decoded = jwt.verify(token, getRefreshSecret());
    const accessToken = jwt.sign(
      { email: decoded.email, role: decoded.role || 'admin' },
      getJwtSecret(),
      { expiresIn: '15m' }
    );
    const newRefreshToken = jwt.sign(
      { email: decoded.email, role: decoded.role || 'admin' },
      getRefreshSecret(),
      { expiresIn: '7d' }
    );

    setAuthCookies(res, accessToken, newRefreshToken);
    return res.json({ success: true });
  } catch (error) {
    return res.status(401).json({ message: 'Refresh token inválido o expirado' });
  }
};
