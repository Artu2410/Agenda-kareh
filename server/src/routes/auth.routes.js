import { Router } from 'express';
import { requestOTP, verifyOTP, verifyToken, logout } from '../controllers/auth.controller.js';

export default function createAuthRoutes(prisma) {
  const router = Router();

  // Inyectamos prisma y log de depuración para ver qué llega
  router.use((req, res, next) => {
    req.prisma = prisma;
    console.log(`📡 Solicitud en Auth: ${req.method} ${req.originalUrl}`);
    next();
  });

  // Rutas estándar (con /api/auth/...)
  router.post('/request-otp', requestOTP);
  router.post('/verify-otp', verifyOTP);
  router.get('/verify', verifyToken); // <--- Esta es la que el frontend busca
  router.post('/logout', logout);

  return router;
}