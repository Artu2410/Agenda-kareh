import { z } from 'zod';
import logger from './logger.js';

/**
 * Schema de validación para variables de entorno
 * Define todos los .env requeridos y opcionales con sus tipos
 */
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Server
  PORT: z.coerce.number().default(5000),
  APP_VERSION: z.string().default(''),
  COMMIT_SHA: z.string().default(''),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres').optional(),
  REFRESH_TOKEN_SECRET: z.string().min(32, 'REFRESH_TOKEN_SECRET debe tener al menos 32 caracteres').optional(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL debe ser una URL válida'),

  // CORS
  FRONTEND_URL: z.string().url().optional(),
  CLIENT_URL: z.string().url().optional(),
  CORS_ALLOWED_ORIGINS: z.string().default(''),

  // Auth
  AUTHORIZED_EMAIL: z.string().email().optional(),
  AUTH_BOOTSTRAP_USERS: z.string().default(''),
  OTP_LENGTH: z.coerce.number().default(6),
  OTP_EXPIRY_MINUTES: z.coerce.number().default(10),

  // AWS S3
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),

  // WhatsApp
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),

  // Email / Resend
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  RESEND_FROM_NAME: z.string().optional(),
  FROM_EMAIL: z.string().email().default('noreply@agenda-kareh.com'),

  // Google AI (Gemini)
  GOOGLE_AI_API_KEY: z.string().optional(),

  // COKIBA sync
  COKIBA_DAILY_SYNC_ENABLED: z.enum(['true', 'false']).default('true'),
  COKIBA_DAILY_SYNC_TIME: z.string().regex(/^\d{1,2}:\d{2}$/).default('03:15'),
  COKIBA_CRON_TOKEN: z.string().optional(),
  KAREH_ALERT_EMAIL: z.string().email().optional(),

  // Push notifications
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),

  // Debug
  VITE_API_DEBUG: z.string().default('0'),
});

/**
 * Validar y parsear variables de entorno
 * Lanza error si hay validación fallida
 */
export const validateEnv = () => {
  try {
    const parsed = envSchema.parse(process.env);
    logger.info('✅ Variables de entorno validadas correctamente');
    return parsed;
  } catch (error) {
    const issues = error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    logger.error(`❌ Error en validación de variables de entorno:\n${issues}`);
    throw new Error(`Validación de .env fallida:\n${issues}`);
  }
};

/**
 * Get env value with type safety
 */
export const getEnv = () => {
  return envSchema.parse(process.env);
};

export default validateEnv;
