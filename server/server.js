import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import dns from 'node:dns';

dns.setDefaultResultOrder('ipv4first');
dotenv.config();

if (!process.env.JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET no configurado');
    process.exit(1);
}

const prisma = new PrismaClient();
const app = express();

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
import { verifyWhatsAppWebhook, handleWhatsAppWebhook } from './src/controllers/whatsapp.controller.js';
import { verifyToken } from './src/controllers/auth.controller.js';
import { authMiddleware } from './src/middlewares/authMiddleware.js';
import { csrfProtection, getCsrfToken } from './src/middlewares/csrfMiddleware.js';

const isProduction = process.env.NODE_ENV === 'production';

const additionalAllowedOrigins = String(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedOrigins = new Set([
    'https://agenda-kareh.vercel.app',
    'https://kareh-salud.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174',
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

app.set('trust proxy', 1);

app.use(cors({
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
            return callback(null, true);
        }

        console.error('❌ Error de CORS para el origen:', origin);
        return callback(new Error(`Origin no permitido por CORS: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Auth-Fallback', 'X-CSRF-Token']
}));

app.use(cookieParser());
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'https:'],
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
    console.log(`📨 WhatsApp webhook ${req.method}`, { object: body.object, entryCount });
    next();
});

prisma.$connect()
  .then(() => console.log('✅ DB conectada'))
  .catch((error) => {
    console.error('❌ Error de conexión DB:', error.message);
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
        console.error('❌ Error cron WhatsApp:', error);
        return res.status(500).json({ message: 'Error en cron WhatsApp' });
    }
});

// Logs para depuración
app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.originalUrl}`);
    next();
});

// ==========================================
// RUTAS DE LA API
// ==========================================

// Auth Pública y Verificación
app.use('/api/auth', createAuthRoutes(prisma));
app.get('/api/auth/verify', verifyToken);

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

// Rutas protegidas
app.use('/api/appointments', authMiddleware, createAppointmentRoutes(prisma));
app.use('/api/patients', authMiddleware, createPatientRoutes(prisma));
app.use('/api/cashflow', authMiddleware, createCashflowRoutes(prisma));
app.use('/api/clinical-history', authMiddleware, createClinicalHistoryRoutes(prisma));
app.use('/api/metrics', authMiddleware, createMetricsRoutes(prisma));
app.use('/api/notes', authMiddleware, createNotesRoutes(prisma));
app.use('/api/professionals', authMiddleware, createProfessionalRoutes(prisma));
app.use('/api/uploads', authMiddleware, createUploadRoutes());
app.use('/api/transcription', authMiddleware, createTranscriptionRoutes());
app.use('/api/whatsapp', authMiddleware, createWhatsAppRoutes(prisma));
app.use('/api/agenda', authMiddleware, createAgendaRoutes(prisma));

// Utilidades
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

// ==========================================
// MANEJO DE ERRORES (JSON SIEMPRE)
// ==========================================

// Catch-all para cualquier ruta que NO sea /api (evita devolver HTML)
app.use((req, res, next) => {
    if (!req.url.startsWith('/api')) {
        return res.status(404).json({ error: "Ruta no encontrada. Recuerda usar el prefijo /api" });
    }
    next();
});

app.all('/api/*', (req, res) => {
    res.status(404).json({ error: "Endpoint no encontrado en la API", path: req.originalUrl });
});

app.use((err, req, res, next) => {
    if (err?.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({ message: 'CSRF token inválido o faltante', code: 'EBADCSRFTOKEN' });
    }
    console.error('❌ Error:', err.stack || err);
    const status = err?.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const message = err?.message || "Error interno del servidor";
    res.status(status).json({ message, error: message });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Kareh Pro en puerto ${PORT}`);
});
