import rateLimit from 'express-rate-limit';
import { ipKeyGenerator } from 'express-rate-limit';
import logger from './logger.js';

/**
 * Rate limiters para diferentes tipos de endpoints
 */

// Generic API limiter - protege endpoints normales
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máx 100 requests por ventana
  message: 'Demasiadas requests, intenta más tarde',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test',
  handler: (req, res) => {
    req.logger?.warn('Rate limit exceeded', {
      ip: req.ip,
      endpoint: req.path,
      method: req.method,
    });
    res.status(429).json({
      success: false,
      message: 'Demasiadas requests, intenta más tarde',
    });
  },
});

// OTP limiter - para verificación de código OTP
const keyFromRequest = (req) => req.body?.email?.toLowerCase() || ipKeyGenerator(req.ip);

export const requestOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máx 5 intentos de OTP
  message: 'Demasiados intentos de verificación',
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: keyFromRequest,
  skip: (req) => process.env.NODE_ENV === 'test',
  handler: (req, res) => {
    logger.warn('OTP rate limit exceeded', { ip: req.ip });
    res.status(429).json({
      success: false,
      message: 'Demasiados intentos. Intenta en 15 minutos',
    });
  },
});

export const verifyOtpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test',
  keyGenerator: keyFromRequest,
  handler: (req, res) => {
    logger.warn('OTP verification rate limit exceeded', { ip: req.ip });
    res.status(429).json({
      success: false,
      message: 'Demasiados intentos. Intenta en 1 minuto',
    });
  },
});

export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máx 10 refresh por IP
  message: 'Demasiados intentos de refrescar la sesión',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test',
  handler: (req, res) => {
    logger.warn('Refresh rate limit exceeded', { ip: req.ip, endpoint: req.path });
    res.status(429).json({
      success: false,
      message: 'Demasiados intentos de refrescar la sesión. Intenta en 15 minutos',
    });
  },
});

// Upload limiter - para uploads de archivos
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20, // máx 20 uploads por hora
  message: 'Límite de uploads excedido',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test',
  handler: (req, res) => {
    logger.warn('Upload rate limit exceeded', { ip: req.ip, userId: req.user?.id });
    res.status(429).json({
      success: false,
      message: 'Límite de uploads por hora excedido',
    });
  },
});

// Search limiter - para búsquedas/filtros complejos
export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // máx 30 búsquedas por minuto
  message: 'Demasiadas búsquedas',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test',
  handler: (req, res) => {
    logger.warn('Search rate limit exceeded', { ip: req.ip });
    res.status(429).json({
      success: false,
      message: 'Demasiadas búsquedas. Espera un momento',
    });
  },
});

export default {
  apiLimiter,
  requestOtpLimiter,
  verifyOtpLimiter,
  refreshLimiter,
  uploadLimiter,
  searchLimiter,
};
