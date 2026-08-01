import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { requestOTP, verifyOTP, verifyToken, logout, refreshToken } from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.js';
import { refreshLimiter } from '../config/rateLimits.js';
import { requestOtpBodySchema, verifyOtpBodySchema } from '../validations/authSchemas.js';

export default function createAuthRoutes(prisma) {
  const router = Router();
  router.use((req, res, next) => {
    req.prisma = prisma;
    next();
  });

  const keyFromRequest = (req) => req.body?.email?.toLowerCase() || ipKeyGenerator(req.ip);

  const requestOtpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyFromRequest,
  });

  const verifyOtpLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyFromRequest,
  });

  router.post('/request-otp', requestOtpLimiter, validate({ body: requestOtpBodySchema }), requestOTP);
  router.post('/verify-otp', verifyOtpLimiter, validate({ body: verifyOtpBodySchema }), verifyOTP);
  router.get('/verify', verifyToken);
  router.post('/logout', logout);
  router.post('/refresh', refreshLimiter, refreshToken);

  return router;
}
