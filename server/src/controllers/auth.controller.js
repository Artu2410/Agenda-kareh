import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

// Almacenamiento temporal de OTPs (en producción usar Redis)
const otpStorage = new Map();

// Verificar credenciales en .env
if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
  console.warn('⚠️  ADVERTENCIA: GMAIL_USER o GMAIL_APP_PASSWORD no están configurados en .env');
  console.warn('El envío de emails NO funcionará sin estas credenciales.');
  console.warn('Pasos para configurar:');
  console.warn('1. Ve a: https://myaccount.google.com/security');
  console.warn('2. Busca: "Contraseñas de aplicaciones"');
  console.warn('3. Copia la contraseña de 16 caracteres');
  console.warn('4. Pega en .env: GMAIL_APP_PASSWORD=xxxxxxxxxxxx');
}

// Configurar transportador de email
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

/**
 * 1. Solicitar OTP - El usuario ingresa su email
 */
export const requestOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const authorizedEmail = process.env.AUTHORIZED_EMAIL || 'centrokareh@gmail.com';

    // Validar que sea un email válido
    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Email inválido' });
    }

    // Validar que sea el email autorizado
    if (email.toLowerCase() !== authorizedEmail.toLowerCase()) {
      return res.status(403).json({
        message: 'Acceso Denegado',
        detail: `Solo ${authorizedEmail} puede acceder a esta aplicación.`
      });
    }

    // Generar código OTP de 6 dígitos
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // Válido por 15 minutos

    // Guardar OTP en almacenamiento temporal
    otpStorage.set(email, { otp, expiresAt, attempts: 0 });

    // Enviar email con el OTP
    try {
      await transporter.sendMail({
        from: `"Kareh Salud" <${process.env.GMAIL_USER || 'centrokareh@gmail.com'}>`,
        to: email,
        subject: '🔐 Tu código de acceso a Kareh Salud',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); padding: 30px; text-align: center; border-radius: 10px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🏥 Kareh Salud</h1>
            </div>
            <div style="padding: 30px; background: #f8fafc; border-radius: 10px; margin-top: 20px;">
              <p style="color: #334155; margin: 0; font-size: 16px;">Hola,</p>
              <p style="color: #64748b; margin: 15px 0; font-size: 15px;">
                Alguien solicitó acceso a tu cuenta de Kareh Salud. Si fuiste tú, usa este código:
              </p>
              <div style="background: white; padding: 25px; border-radius: 8px; margin: 25px 0; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #94a3b8;">Código de Verificación</p>
                <p style="margin: 10px 0; font-size: 36px; font-weight: bold; color: #0d9488; letter-spacing: 8px;">
                  ${otp}
                </p>
              </div>
              <p style="color: #94a3b8; margin: 15px 0; font-size: 13px;">
                ⏱️ Este código expira en 15 minutos.
              </p>
              <p style="color: #94a3b8; margin: 15px 0; font-size: 13px;">
                Si no solicitaste este código, ignora este email.
              </p>
              <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 20px;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                  © 2026 Kareh Salud - Centro de Kinesiología
                </p>
              </div>
            </div>
          </div>
        `,
      });

      console.log(`✅ OTP enviado a ${email}`);
      res.json({
        success: true,
        message: 'Código OTP enviado a tu email',
        expiresIn: 900, // 15 minutos en segundos
      });
    } catch (emailError) {
      console.error('❌ Error enviando email:', emailError.message);
      console.error('📧 GMAIL_USER:', process.env.GMAIL_USER);
      console.error('🔑 GMAIL_APP_PASSWORD configurada:', !!process.env.GMAIL_APP_PASSWORD);
      
      // Identificar tipo de error para mensaje más útil
      let errorDetail = 'Error desconocido al enviar email';
      if (emailError.message.includes('invalid_grant')) {
        errorDetail = 'Credenciales de Gmail inválidas. Regenera la contraseña de aplicación.';
      } else if (emailError.message.includes('Invalid login')) {
        errorDetail = 'Email o contraseña de aplicación son incorrectos.';
      } else if (emailError.message.includes('ECONNREFUSED') || emailError.message.includes('getaddrinfo')) {
        errorDetail = 'No se puede conectar a Gmail SMTP. Verifica tu conexión a Internet.';
      } else if (emailError.message.includes('GMAIL_APP_PASSWORD')) {
        errorDetail = 'GMAIL_APP_PASSWORD no está configurada en .env';
      }
      
      return res.status(500).json({
        message: errorDetail,
        detail: process.env.NODE_ENV === 'development' ? emailError.message : undefined
      });
    }
  } catch (error) {
    console.error('❌ Error en requestOTP:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

/**
 * 2. Verificar OTP - El usuario ingresa el código
 */
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const authorizedEmail = process.env.AUTHORIZED_EMAIL || 'centrokareh@gmail.com';

    // Validaciones básicas
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email y OTP requeridos' });
    }

    // Validar que sea el email autorizado
    if (email.toLowerCase() !== authorizedEmail.toLowerCase()) {
      return res.status(403).json({
        message: 'Email no autorizado'
      });
    }

    // Obtener OTP almacenado
    const storedData = otpStorage.get(email);

    if (!storedData) {
      return res.status(400).json({
        message: 'No hay código pendiente. Solicita uno nuevo.'
      });
    }

    // Validar expiración
    if (Date.now() > storedData.expiresAt) {
      otpStorage.delete(email);
      return res.status(400).json({
        message: 'Código expirado. Solicita uno nuevo.'
      });
    }

    // Validar intentos (máx 5 por OTP)
    if (storedData.attempts >= 5) {
      otpStorage.delete(email);
      return res.status(429).json({
        message: 'Demasiados intentos. Solicita un nuevo código.'
      });
    }

    // Validar código
    if (otp !== storedData.otp) {
      storedData.attempts += 1;
      return res.status(401).json({
        message: 'Código incorrecto',
        attemptsRemaining: 5 - storedData.attempts
      });
    }

    // ✅ Código correcto - Generar JWT
    otpStorage.delete(email); // Limpiar OTP usado

    const jwtToken = jwt.sign(
      {
        email: email,
        type: 'otp-verified',
        iat: Math.floor(Date.now() / 1000),
      },
      process.env.JWT_SECRET || 'default_secret_key_change_me',
      { expiresIn: '30d' } // Token válido por 30 días
    );

    res.json({
      success: true,
      message: 'Acceso concedido',
      token: jwtToken,
      user: {
        email: email,
        name: 'Usuario',
      }
    });
  } catch (error) {
    console.error('❌ Error en verifyOTP:', error);
    res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};

/**
 * 3. Verificar Token JWT
 */
export const verifyToken = (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Token no encontrado' });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'default_secret_key_change_me'
    );

    res.json({
      valid: true,
      user: decoded
    });
  } catch (error) {
    res.status(401).json({ message: 'Token inválido o expirado', error: error.message });
  }
};

/**
 * 4. Logout (limpieza en frontend)
 */
export const logout = (req, res) => {
  res.json({ 
    success: true, 
    message: 'Sesión cerrada correctamente'
  });
};
