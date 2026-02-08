import { Router } from 'express';
import { requestOTP, verifyOTP, verifyToken, logout } from '../controllers/auth.controller.js';

export default function createAuthRoutes(prisma) {
  const router = Router();

  // Inyectamos prisma en el request para que los controladores puedan usarlo
  router.use((req, res, next) => {
    req.prisma = prisma;
    next();
  });

  // POST /api/auth/request-otp
  // Quitamos la envoltura innecesaria para que el controlador reciba req y res directamente
  router.post('/request-otp', requestOTP);

  // POST /api/auth/verify-otp
  router.post('/verify-otp', verifyOTP);

  // GET /api/auth/verify
  router.get('/verify', verifyToken);

  // POST /api/auth/logout
  router.post('/logout', logout);

  return router;
}