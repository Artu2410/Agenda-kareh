import jwt from 'jsonwebtoken';

export const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No autorizado: token no encontrado' });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'default_secret_key_change_me'
    );

    // Verificar que el email sigue siendo el autorizado
    const authorizedEmail = process.env.AUTHORIZED_EMAIL || 'centrokareh@gmail.com';
    if (decoded.email !== authorizedEmail) {
      return res.status(403).json({ message: 'Acceso denegado: usuario no autorizado' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error('❌ Error en authMiddleware:', error.message);
    res.status(401).json({ message: 'Token inválido o expirado' });
  }
};
