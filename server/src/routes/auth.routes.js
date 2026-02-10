import { Router } from 'express';
import { requestOTP, verifyOTP, verifyToken, logout } from '../controllers/auth.controller.js';

export default function createAuthRoutes(prisma) {
  const router = Router();

  router.use((req, res, next) => {
    req.prisma = prisma;
    console.log(`📡 Solicitud recibida: ${req.method} ${req.originalUrl}`); 
    next();
  });

  // Estas rutas ahora serán /api/auth/request-otp, etc.
  router.post('/request-otp', requestOTP);
  router.post('/verify-otp', verifyOTP);
  
  // Esta es la que falla (GET /api/auth/verify)
  router.get('/verify', verifyToken);
  
  router.post('/logout', logout);

  return router;
}