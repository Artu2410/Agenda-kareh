import { Router } from 'express';
import { requestOTP, verifyOTP, verifyToken, logout, refreshToken } from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.js';
import { requestOtpLimiter, verifyOtpLimiter, refreshLimiter } from '../config/rateLimits.js';
import { requestOtpBodySchema, verifyOtpBodySchema } from '../validations/authSchemas.js';

export default function createAuthRoutes(prisma) {
  const router = Router();
  router.use((req, res, next) => {
    req.prisma = prisma;
    next();
  });

  router.post('/request-otp', requestOtpLimiter, validate({ body: requestOtpBodySchema }), requestOTP);
  router.post('/verify-otp', verifyOtpLimiter, validate({ body: verifyOtpBodySchema }), verifyOTP);
  router.get('/verify', verifyToken);
  router.post('/logout', logout);
  router.post('/refresh', refreshLimiter, refreshToken);

  return router;
}
