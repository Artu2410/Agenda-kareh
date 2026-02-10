import jwt from 'jsonwebtoken';
import { Resend } from 'resend';

// 1. Configuración de Resend y Variables de Entorno
const resend = new Resend(process.env.RESEND_API_KEY);
const JWT_SECRET = process.env.JWT_SECRET || 'clave_secreta_provisional';
const AUTHORIZED_EMAIL = (process.env.AUTHORIZED_EMAIL || 'centrokareh@gmail.com').toLowerCase();

// Almacenamiento temporal de OTPs
const otpStorage = new Map();

/**
 * 1. SOLICITAR OTP (Vía Resend API)
 */
export const requestOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Email inválido' });
    }

    const normalizedEmail = email.toLowerCase();

    // Validar autorización
    if (normalizedEmail !== AUTHORIZED_EMAIL) {
      return res.status(403).json({
        message: 'Acceso Denegado',
        detail: `Solo ${AUTHORIZED_EMAIL} puede acceder.`
      });
    }

    // Generar OTP y expiración (15 min)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000;

    // Guardar en memoria
    otpStorage.set(normalizedEmail, { otp, expiresAt, attempts: 0 });

    // Enviar Email mediante la API de Resend
    try {
      const { data, error } = await resend.emails.send({
        from: 'Kareh Salud <onboarding@resend.dev>', // Cambia esto cuando tengas dominio propio
        to: normalizedEmail,
        subject: '🔐 Tu código de acceso a Kareh Salud',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
            <div style="background: #0d9488; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">🏥 Kareh Salud</h1>
            </div>
            <div style="padding: 30px; background: #ffffff;">
              <p>Usa el siguiente código para iniciar sesión:</p>
              <div style="background: #f1f5f9; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; color: #0d9488; letter-spacing: 5px;">${otp}</span>
              </div>
              <p style="font-size: 12px; color: #64748b;">Este código expira en 15 minutos.</p>
            </div>
          </div>
        `
      });

      if (error) {
        console.error('❌ Error de Resend API:', error);
        return res.status(500).json({ message: 'Error de Resend', error });
      }

      console.log('✅ Correo enviado vía Resend ID:', data.id);
      res.json({ success: true, message: 'Código OTP enviado a tu email' });

    } catch (resendErr) {
      console.error('❌ Error crítico en Resend:', resendErr.message);
      res.status(500).json({ message: 'No se pudo enviar el correo' });
    }

  } catch (error) {
    console.error('❌ Error en requestOTP:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * 2. VERIFICAR OTP (Misma lógica anterior)
 */
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = email?.toLowerCase();
    const storedData = otpStorage.get(normalizedEmail);

    if (!storedData) return res.status(400).json({ message: 'No hay código pendiente.' });

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
      return res.status(401).json({ message: 'Código incorrecto', attemptsRemaining: 5 - storedData.attempts });
    }

    // Éxito: Limpiar y generar Token
    otpStorage.delete(normalizedEmail);

    const token = jwt.sign(
      { email: normalizedEmail, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: { email: normalizedEmail, name: 'Administrador' }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en la verificación' });
  }
};

/**
 * 3. VERIFICAR TOKEN
 */
export const verifyToken = async (req, res) => {
  try {
    // ... tu lógica de verificar el JWT ...
    return res.status(200).json({ valid: true, user: decodedUser }); 
  } catch (error) {
    // IMPORTANTE: Responde JSON incluso en el error
    return res.status(401).json({ valid: false, message: "Token inválido" });
  }
};

/**
 * 4. LOGOUT
 */
export const logout = (req, res) => {
  res.json({ success: true, message: 'Sesión cerrada' });
};