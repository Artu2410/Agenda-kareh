import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requestOTP, verifyOTP, verifyToken, logout, refreshToken } from '../controllers/auth.controller.js';
import { validateBody } from '../middlewares/validate.js';
import { requestOtpSchema, verifyOtpSchema } from '../schemas/auth.schema.js';

export default function createAuthRoutes(prisma) {
  const router = Router();

  // Inyectamos prisma y log de depuración para ver qué llega
  router.use((req, res, next) => {
    req.prisma = prisma;
    console.log(`📡 Solicitud en Auth: ${req.method} ${req.originalUrl}`);
    next();
  });

  const requestOtpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.body?.email?.toLowerCase() || req.ip,
  });

  const verifyOtpLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.body?.email?.toLowerCase() || req.ip,
  });

  // Rutas estándar (con /api/auth/...)
  router.post('/request-otp', requestOtpLimiter, validateBody(requestOtpSchema), requestOTP);
  router.post('/verify-otp', verifyOtpLimiter, validateBody(verifyOtpSchema), verifyOTP);
  router.get('/verify', verifyToken); // <--- Esta es la que el frontend busca
  router.post('/logout', logout);
  router.post('/refresh', refreshToken);

  return router;
}
