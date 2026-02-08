import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

// Almacenamiento temporal de OTPs (en producción usar Redis para persistencia)
const otpStorage = new Map();

/**
 * CONFIGURACIÓN DE VARIABLES DE ENTORNO
 * Se extraen al inicio para validar que existan y evitar errores en tiempo de ejecución.
 */
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET || 'clave_secreta_por_defecto_cambiar_urgente';
const AUTHORIZED_EMAIL = (process.env.AUTHORIZED_EMAIL || 'centrokareh@gmail.com').toLowerCase();

// Validación de credenciales críticas
if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.warn('⚠️ ADVERTENCIA: GMAIL_USER o GMAIL_APP_PASSWORD no están configurados.');
}

// Configurar transportador de email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD, // CORREGIDO: Se usa la variable, no texto plano con espacios
  },
  tls: {
    rejectUnauthorized: false // Útil para entornos locales o redes con firewalls
  }
});

/**
 * 1. Solicitar OTP - El usuario ingresa su email
 */
export const requestOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Email inválido' });
    }

    const normalizedEmail = email.toLowerCase();

    // Validar que sea el email autorizado
    if (normalizedEmail !== AUTHORIZED_EMAIL) {
      return res.status(403).json({
        message: 'Acceso Denegado',
        detail: `Solo ${AUTHORIZED_EMAIL} puede acceder a esta aplicación.`
      });
    }

    // Generar código OTP de 6 dígitos
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutos

    // Guardar OTP (usamos el email normalizado como llave)
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

      console.log(`✅ OTP enviado a ${normalizedEmail}`);
      res.json({ success: true, message: 'Código OTP enviado a tu email' });

    } catch (emailError) {
      console.error('❌ Error enviando email:', emailError.message);
      return res.status(500).json({
        message: 'No se pudo enviar el correo. Verifica la configuración SMTP.',
        detail: process.env.NODE_ENV === 'development' ? emailError.message : undefined
      });
    }
  } catch (error) {
    console.error('❌ Error en requestOTP:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * 2. Verificar OTP - El usuario ingresa el código
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
      return res.status(400).json({ message: 'No hay código pendiente o ya fue usado.' });
    }

    // Validar expiración
    if (Date.now() > storedData.expiresAt) {
      otpStorage.delete(normalizedEmail);
      return res.status(400).json({ message: 'Código expirado. Solicita uno nuevo.' });
    }

    // Validar intentos (máx 5)
    if (storedData.attempts >= 5) {
      otpStorage.delete(normalizedEmail);
      return res.status(429).json({ message: 'Demasiados intentos. Solicita un nuevo código.' });
    }

    // Validar código
    if (otp !== storedData.otp) {
      storedData.attempts += 1;
      return res.status(401).json({
        message: 'Código incorrecto',
        attemptsRemaining: 5 - storedData.attempts
      });
    }

    // ✅ ÉXITO - Generar JWT
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
 * 3. Verificar Token JWT (Para proteger rutas)
 */
export const verifyToken = (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Token no encontrado' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ message: 'Token inválido o expirado' });
  }
};

/**
 * 4. Logout
 */
export const logout = (req, res) => {
  res.json({ success: true, message: 'Sesión cerrada correctamente' });
};