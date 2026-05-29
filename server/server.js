import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import dns from 'node:dns';
import logger, { createRequestLogger } from './src/config/logger.js';
import { validateEnv } from './src/config/env.js';
import { createHttpMetricsMiddleware, renderPrometheusMetrics } from './src/lib/metrics.js';

// Phase 2: Swagger, Rate Limiting, Session Management
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './src/config/swagger.js';
import {
  apiLimiter,
  uploadLimiter,
  searchLimiter,
} from './src/config/rateLimits.js';
import SessionManager from './src/utils/sessionManager.js';
import {
  sessionValidationMiddleware,
  deviceDetectionMiddleware,
  sessionCleanupMiddleware,
} from './src/middlewares/sessionMiddleware.js';

dns.setDefaultResultOrder('ipv4first');
dotenv.config();
const startedAt = new Date().toISOString();

// Validar variables de entorno antes de iniciar
validateEnv();

const prisma = new PrismaClient();
const app = express();

// Phase 2: Initialize SessionManager
const sessionManager = new SessionManager(prisma);

// Periodic session cleanup every 1 hour
setInterval(() => {
  sessionManager.cleanupExpiredSessions();
}, 60 * 60 * 1000);

import createAuthRoutes from './src/routes/auth.routes.js';
import createAppointmentRoutes from './src/routes/appointments.routes.js';
import createPatientRoutes from './src/routes/patient.routes.js';
import createCashflowRoutes from './src/routes/cashflow.routes.js';
import createClinicalHistoryRoutes from './src/routes/clinicalHistory.routes.js';
import createMetricsRoutes from './src/routes/metrics.routes.js';
import createProfessionalRoutes from './src/routes/professionalRoutes.js';
import createNotesRoutes from './src/routes/notes.routes.js';
import createUploadRoutes from './src/routes/upload.routes.js';
import createTranscriptionRoutes from './src/routes/transcription.routes.js';
import { runWhatsappReminders } from './src/services/whatsappReminders.js';
import createWhatsAppRoutes from './src/routes/whatsapp.routes.js';
import createAgendaRoutes from './src/routes/agenda.routes.js';
import createNotificationsRoutes from './src/routes/notifications.routes.js';
import createObrasSocialesRoutes from './src/routes/obrasSociales.routes.js';
import createUsersRoutes from './src/routes/users.routes.js';
import createAuditRoutes from './src/routes/audit.routes.js';
import createSessionsRoutes from './src/routes/sessions.routes.js';
import createVersionRoutes from './src/routes/version.routes.js';
import { verifyWhatsAppWebhook, handleWhatsAppWebhook } from './src/controllers/whatsapp.controller.js';
import { authMiddleware } from './src/middlewares/authMiddleware.js';
import { checkRole } from './src/middlewares/rbacMiddleware.js';
import { ROLES } from './src/constants/roles.js';
import { csrfProtection, getCsrfToken } from './src/middlewares/csrfMiddleware.js';
import { getBootstrapUsers } from './src/utils/auth.js';
import { getStartupMetadata } from './src/config/runtimeInfo.js';
import { NotFoundError } from './src/errors/AppError.js';
import { errorHandler } from './src/middlewares/errorHandler.js';

const isProduction = process.env.NODE_ENV === 'production';

const additionalAllowedOrigins = String(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedOrigins = new Set([
    'https://agenda-kareh.vercel.app',
    'https://kareh-salud.vercel.app',
    'https://agenda.kareh.com.ar',
    'https://kareh.com.ar',
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    ...additionalAllowedOrigins,
].filter(Boolean));

const isAllowedOrigin = (origin) => {
    if (!origin) {
        return true;
    }

    if (allowedOrigins.has(origin)) {
        return true;
    }

    try {
        const { hostname } = new URL(origin);

        if (hostname === 'agenda-kareh.vercel.app' || hostname === 'kareh-salud.vercel.app') {
            return true;
        }

        if (hostname.endsWith('.vercel.app')) {
            return hostname.startsWith('agenda-kareh-') || hostname.startsWith('kareh-salud-') || !isProduction;
        }

        return false;
    } catch {
        return false;
    }
};

const syncBootstrapUsers = async () => {
    const bootstrapUsers = getBootstrapUsers();

    if (bootstrapUsers.length === 0) {
        logger.warn('No hay usuarios bootstrap configurados');
        return;
    }

    await Promise.all(
        bootstrapUsers.map((user) =>
            prisma.user.upsert({
                where: { email: user.email },
                update: {
                    fullName: user.fullName,
                    role: user.role,
                    isActive: true,
                },
                create: {
                    email: user.email,
                    fullName: user.fullName,
                    role: user.role,
                    isActive: true,
                },
            })
        )
    );
};

app.set('trust proxy', 1);

// Agregar timestamp a cada request
app.use((req, res, next) => {
    req.startTime = Date.now();
    next();
});

// Request logger
app.use(createRequestLogger);
app.use(createHttpMetricsMiddleware());

// Phase 2: Session Management Middleware
app.use(sessionValidationMiddleware);
app.use(deviceDetectionMiddleware);
app.use(sessionCleanupMiddleware(sessionManager));

app.use(cors({
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
            return callback(null, true);
        }

        logger.error('CORS origin no permitido', { origin });
        return callback(new Error(`Origin no permitido por CORS: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

app.use(cookieParser());
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'https://agenda-kareh.vercel.app', 'https://kareh-salud.vercel.app', 'https://kareh-backend.onrender.com', 'https:'],
            fontSrc: ["'self'", 'data:', 'https:'],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
        },
    },
}));
app.use(express.json({ limit: '50mb', strict: false }));

// CSRF: endpoint para obtener token
app.get('/api/csrf-token', csrfProtection, getCsrfToken);

// CSRF: proteger rutas mutables (excluye webhooks/cron)
app.use('/api', (req, res, next) => {
    const method = req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
        return next();
    }

    const path = req.path || '';
    if (path.startsWith('/webhooks/whatsapp') || path.startsWith('/cron/whatsapp-reminders')) {
        return next();
    }

    return csrfProtection(req, res, next);
});

// Log mínimo para webhook (sin datos sensibles)
app.use('/api/webhooks/whatsapp', (req, res, next) => {
    const body = req.body || {};
    const entryCount = Array.isArray(body.entry) ? body.entry.length : 0;
    (req.logger || logger).info('WhatsApp webhook recibido', {
        object: body.object,
        entryCount,
        method: req.method,
    });
    next();
});

prisma.$connect()
  .then(async () => {
    logger.info('DB conectada');
    await syncBootstrapUsers();
  })
  .catch((error) => {
    logger.error('Error de conexión DB', { errorMessage: error.message });
  });

app.use((req, res, next) => {
    req.prisma = prisma;
    next();
});

// WhatsApp Webhook (público)
app.get('/api/webhooks/whatsapp', verifyWhatsAppWebhook);
app.post('/api/webhooks/whatsapp', (req, res) => handleWhatsAppWebhook(req, res, prisma));

// Cron hook (para recordatorios WhatsApp)
app.post('/api/cron/whatsapp-reminders', async (req, res) => {
    const token = process.env.WHATSAPP_CRON_TOKEN;
    const provided = req.headers['x-cron-token'] || req.query?.token;
    if (!token) {
        return res.status(500).json({ message: 'Cron token no configurado' });
    }
    if (token !== provided) {
        return res.status(403).json({ message: 'No autorizado' });
    }
    try {
        const result = await runWhatsappReminders(prisma);
        return res.json({ success: true, ...result });
    } catch (error) {
        logger.error('Error cron WhatsApp', { errorMessage: error.message });
        return res.status(500).json({ message: 'Error en cron WhatsApp' });
    }
});

// Logs para depuración
app.use((req, res, next) => {
    (req.logger || logger).debug('Incoming request', {
        method: req.method,
        url: req.originalUrl,
    });
    next();
});

// ==========================================
// RUTAS DE LA API
// ==========================================

// Auth Pública y Verificación
app.use('/api/auth', apiLimiter, createAuthRoutes(prisma));
app.use('/api', createVersionRoutes({ deployedAt: startedAt }));

// Diagnóstico WhatsApp temporal (público)
app.get('/api/whatsapp-config', (req, res) => {
  const config = {
    hasAccessToken: !!process.env.WHATSAPP_ACCESS_TOKEN,
    hasPhoneNumberId: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
    ticketTemplate: process.env.WHATSAPP_TICKET_TEMPLATE || 'NO CONFIGURADO',
    welcomeMode: 'text',
    holaMode: 'text',
    greetingTemplateEnabled: false,
    greetingTextFromEnv: false,
    greetingSource: 'controller-default-text',
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v20.0',
    language: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'es_AR',
    accessTokenPrefix: process.env.WHATSAPP_ACCESS_TOKEN ? process.env.WHATSAPP_ACCESS_TOKEN.substring(0, 10) + '...' : 'NO TOKEN',
  };
  res.json({ whatsappConfig: config });
});

// Phase 2: Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ==========================================
// RUTAS PROTEGIDAS
// ==========================================

// Rutas protegidas
app.use('/api/appointments', authMiddleware, checkRole(ROLES.SUPER_USER, ROLES.ADMIN, ROLES.PROFESSIONAL, ROLES.SECRETARIA), createAppointmentRoutes(prisma));
app.use('/api/patients', authMiddleware, checkRole(ROLES.SUPER_USER, ROLES.ADMIN, ROLES.PROFESSIONAL, ROLES.SECRETARIA), searchLimiter, createPatientRoutes(prisma));
app.use('/api/cashflow', authMiddleware, checkRole(ROLES.SUPER_USER, ROLES.ADMIN, ROLES.SECRETARIA), createCashflowRoutes(prisma));
app.use('/api/clinical-history', authMiddleware, checkRole(ROLES.SUPER_USER, ROLES.ADMIN, ROLES.PROFESSIONAL), createClinicalHistoryRoutes(prisma));
app.use('/api/metrics', authMiddleware, createMetricsRoutes(prisma));
app.use('/api/notes', authMiddleware, createNotesRoutes(prisma));
app.use('/api/professionals', authMiddleware, createProfessionalRoutes(prisma));
app.use('/api/uploads', authMiddleware, uploadLimiter, createUploadRoutes());
app.use('/api/transcription', authMiddleware, createTranscriptionRoutes());
app.use('/api/whatsapp', authMiddleware, createWhatsAppRoutes(prisma));
app.use('/api/agenda', authMiddleware, createAgendaRoutes(prisma));
app.use('/api/notifications', authMiddleware, createNotificationsRoutes(prisma));
app.use('/api/obras-sociales', authMiddleware, createObrasSocialesRoutes(prisma));
app.use('/api/users', authMiddleware, checkRole(ROLES.SUPER_USER, ROLES.ADMIN), createUsersRoutes(prisma));
app.use('/api/audit', authMiddleware, createAuditRoutes(prisma));
app.use('/api/sessions', authMiddleware, createSessionsRoutes(prisma, sessionManager));

// Utilidades
app.get('/metrics', (req, res) => {
    res.type('text/plain; version=0.0.4; charset=utf-8');
    res.send(renderPrometheusMetrics());
});
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

// ==========================================
// MANEJO DE ERRORES (JSON SIEMPRE)
// ==========================================

// Catch-all para cualquier ruta que NO sea /api (evita devolver HTML)
app.use((req, res, next) => {
    if (!req.url.startsWith('/api')) {
        return next(new NotFoundError('Ruta no encontrada. Recuerda usar el prefijo /api'));
    }
    next();
});

app.all('/api/*', (req, res, next) => {
    next(new NotFoundError(`Endpoint no encontrado en la API: ${req.originalUrl}`));
});

app.use(errorHandler);

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    logger.info('Servidor Kareh Pro iniciado', getStartupMetadata(PORT, startedAt));
});
