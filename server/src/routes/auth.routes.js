import { Router } from 'express';
import { requestOTP, verifyOTP, verifyToken, logout } from '../controllers/auth.controller.js';

export default function createAuthRoutes(prisma) {
  const router = Router();

  // POST /api/auth/request-otp - Solicitar código OTP
  router.post('/request-otp', (req, res) => requestOTP(req, res));

  // POST /api/auth/verify-otp - Verificar código OTP y obtener JWT
  router.post('/verify-otp', (req, res) => verifyOTP(req, res));

  // GET /api/auth/verify - Verificar que el token sea válido
  router.get('/verify', (req, res) => verifyToken(req, res));

  // POST /api/auth/logout - Cierra sesión
  router.post('/logout', (req, res) => logout(req, res));

  return router;
}
