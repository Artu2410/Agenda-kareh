import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

// Almacenamiento temporal de OTPs (en producción usar Redis para persistencia)
const otpStorage = new Map();

/**
 * CONFIGURACIÓN DE VARIABLES DE ENTORNO
 */
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET || 'clave_secreta_por_defecto_cambiar_urgente';
const AUTHORIZED_EMAIL = (process.env.AUTHORIZED_EMAIL || 'centrokareh@gmail.com').toLowerCase();

// Validación de credenciales críticas
if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.warn('⚠️ ADVERTENCIA: GMAIL_USER o GMAIL_APP_PASSWORD no están configurados.');
}

// ==========================================
// CONFIGURACIÓN DE TRANSPORTADOR (CORREGIDA PARA RENDER)
// ==========================================
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,         // Puerto estándar para TLS
  secure: false,      // Debe ser false para el puerto 587
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  family: 4, // Obliga a usar IPv4 para evitar el error ENETUNREACH
  tls: {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2'
  }
});

/**
 * 1. Solicitar OTP
 */
export const requestOTP = async (req, res) => {
  try {
    const { email } = req.body;
    // req.prisma ya está disponible gracias al middleware de rutas que hicimos antes
    const prisma = req.prisma; 

    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Email inválido' });
    }

    const normalizedEmail = email.toLowerCase();

    // Validar que sea el email autorizado
    if (normalizedEmail !== AUTHORIZED_EMAIL) {
      return res.status(403).json({
        message: 'Acceso Denegado',
        detail: `Solo ${AUTHORIZED_EMAIL} puede acceder.`
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000;

    otpStorage.set(normalizedEmail, { otp, expiresAt, attempts: 0 });

    // Enviar email con el OTP
    try {
      await transporter.sendMail({
        from: `"Kareh Salud" <${GMAIL_USER}>`,
        to: normalizedEmail,
        subject: '🔐 Tu código de acceso a Kareh Salud',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🏥 Kareh Salud</h1>
            </div>
            <div style="padding: 30px; background: #f8fafc;">
              <p style="color: #334155; font-size: 16px;">Hola,</p>
              <p style="color: #64748b; font-size: 15px;">Usa el siguiente código para acceder a tu cuenta:</p>
              <div style="background: white; padding: 25px; border-radius: 8px; margin: 25px 0; text-align: center; border: 1px dashed #0d9488;">
                <p style="margin: 0; font-size: 12px; color: #94a3b8; text-transform: uppercase;">Código de Verificación</p>
                <p style="margin: 10px 0; font-size: 36px; font-weight: bold; color: #0d9488; letter-spacing: 8px;">${otp}</p>
              </div>
              <p style="color: #94a3b8; font-size: 13px;">⏱️ Este código expira en 15 minutos.</p>
              <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 20px; text-align: center;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">© 2026 Kareh Salud - Centro de Kinesiología</p>
              </div>
            </div>
          </div>
        `,
      });

      console.log(`✅ OTP enviado exitosamente a ${normalizedEmail}`);
      res.json({ success: true, message: 'Código OTP enviado a tu email' });

    } catch (emailError) {
      console.error('❌ Error de conexión SMTP (Nodemailer):', emailError.message);
      return res.status(500).json({
        message: 'Error de red al enviar el correo. Intenta de nuevo.',
        error: emailError.message
      });
    }
  } catch (error) {
    console.error('❌ Error en requestOTP:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * 2. Verificar OTP
 */
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email y OTP requeridos' });
    }

    const normalizedEmail = email.toLowerCase();
    const storedData = otpStorage.get(normalizedEmail);

    if (!storedData) {
      return res.status(400).json({ message: 'No hay código pendiente.' });
    }

    if (Date.now() > storedData.expiresAt) {
      otpStorage.delete(normalizedEmail);
      return res.status(400).json({ message: 'Código expirado.' });
    }

    if (storedData.attempts >= 5) {
      otpStorage.delete(normalizedEmail);
      return res.status(429).json({ message: 'Demasiados intentos.' });
    }

    if (otp !== storedData.otp) {
      storedData.attempts += 1;
      return res.status(401).json({
        message: 'Código incorrecto',
        attemptsRemaining: 5 - storedData.attempts
      });
    }

    otpStorage.delete(normalizedEmail); 

    const jwtToken = jwt.sign(
      { email: normalizedEmail, type: 'otp-verified' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: 'Acceso concedido',
      token: jwtToken,
      user: { email: normalizedEmail, name: 'Administrador' }
    });
  } catch (error) {
    console.error('❌ Error en verifyOTP:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * 3. Verificar Token JWT
 */
export const verifyToken = (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Sin token' });

    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ message: 'Token inválido' });
  }
};

/**
 * 4. Logout
 */
export const logout = (req, res) => {
  res.json({ success: true, message: 'Sesión cerrada' });
};