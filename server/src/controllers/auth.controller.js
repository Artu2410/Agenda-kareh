import jwt from 'jsonwebtoken';
import { Resend } from 'resend';

// 1. Configuración de Resend y Variables de Entorno
const resend = new Resend(process.env.RESEND_API_KEY);
const JWT_SECRET = process.env.JWT_SECRET || 'clave_secreta_provisional';
const AUTHORIZED_EMAIL = (process.env.AUTHORIZED_EMAIL || 'centrokareh@gmail.com').toLowerCase();

// Almacenamiento temporal de OTPs
const otpStorage = new Map();

/**
 * 1. SOLICITAR OTP
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

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000;

    otpStorage.set(normalizedEmail, { otp, expiresAt, attempts: 0 });

    try {
      const { data, error } = await resend.emails.send({
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
 * 3. VERIFICAR TOKEN (LÓGICA CORREGIDA)
 */
export const verifyToken = async (req, res) => {
  try {
    // Extraer el token del header "Authorization: Bearer <TOKEN>"
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      return res.status(401).json({ valid: false, message: "Token no proporcionado" });
    }

    // Verificar el token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Si es válido, responder con los datos del usuario decodificados
    return res.status(200).json({ 
      valid: true, 
      user: {
        email: decoded.email,
        role: decoded.role,
        name: 'Administrador'
      } 
    });

  } catch (error) {
    console.error("❌ Error JWT:", error.message);
    return res.status(401).json({ valid: false, message: "Token inválido o expirado" });
  }
};

/**
 * 4. LOGOUT
 */
export const logout = (req, res) => {
  res.json({ success: true, message: 'Sesión cerrada' });
};