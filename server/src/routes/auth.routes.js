import { Router } from 'express';
import { requestOTP, verifyOTP, verifyToken, logout } from '../controllers/auth.controller.js';

export default function createAuthRoutes(prisma) {
  const router = Router();

  // Inyectamos prisma y log de depuración
  router.use((req, res, next) => {
    req.prisma = prisma;
    console.log(`📡 Auth Route: ${req.method} ${req.url}`); // Esto te dirá qué llega a Render
    next();
  });

  // 1. Solicitar código (Ya funciona)
  router.post('/request-otp', requestOTP);

  // 2. Verificar el código enviado al correo
  // IMPORTANTE: Revisa que en el Frontend llames a /api/auth/verify-otp y no solo /verify
  router.post('/verify-otp', verifyOTP);

  // 3. Verificar si la sesión es válida (Token)
  // Esta es la que te da el 404 en la consola
  router.get('/verify', verifyToken);

  // 4. Cerrar sesión
  router.post('/logout', logout);

  return router;
}