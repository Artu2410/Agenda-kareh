import jwt from 'jsonwebtoken';

export const authMiddleware = (req, res, next) => {
  // 1. Buscamos el token en el Header o en las Cookies
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1] || req.cookies?.auth_token;

  if (!token) {
    console.log("❌ Intento de acceso sin token");
    return res.status(401).json({ message: "No autorizado" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Guardamos el usuario para las siguientes rutas
    next();
  } catch (error) {
    console.error("❌ Token inválido:", error.message);
    return res.status(403).json({ message: "Token no válido" });
  }
};