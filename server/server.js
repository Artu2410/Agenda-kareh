import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import dns from 'node:dns';

dns.setDefaultResultOrder('ipv4first');
dotenv.config();

const prisma = new PrismaClient();
const app = express();

import createAuthRoutes from './src/routes/auth.routes.js';
import createAppointmentRoutes from './src/routes/appointments.routes.js';
import createPatientRoutes from './src/routes/patient.routes.js';
import createCashflowRoutes from './src/routes/cashflow.routes.js';
import createClinicalHistoryRoutes from './src/routes/clinicalHistory.routes.js';
import createMetricsRoutes from './src/routes/metrics.routes.js';
import createProfessionalRoutes from './src/routes/professionalRoutes.js';
import createUploadRoutes from './src/routes/upload.routes.js';
import createTranscriptionRoutes from './src/routes/transcription.routes.js';
import { runWhatsappReminders } from './src/services/whatsappReminders.js';
import createWhatsAppRoutes from './src/routes/whatsapp.routes.js';
import { verifyWhatsAppWebhook, handleWhatsAppWebhook } from './src/controllers/whatsapp.controller.js';
import { verifyToken } from './src/controllers/auth.controller.js';
import { authMiddleware } from './src/middlewares/authMiddleware.js';

const allowedOrigins = new Set([
    'https://kareh-salud.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.FRONTEND_URL
].filter(Boolean));

const isAllowedOrigin = (origin) => {
    if (!origin) {
        return true;
    }

    if (allowedOrigins.has(origin)) {
        return true;
    }

    try {
        return new URL(origin).hostname.endsWith('.vercel.app');
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

        return callback(new Error(`Origin no permitido por CORS: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '50mb' }));

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

// Rutas protegidas
app.use('/api/appointments', authMiddleware, createAppointmentRoutes(prisma));
app.use('/api/patients', authMiddleware, createPatientRoutes(prisma));
app.use('/api/cashflow', authMiddleware, createCashflowRoutes(prisma));
app.use('/api/clinical-history', authMiddleware, createClinicalHistoryRoutes(prisma));
app.use('/api/metrics', authMiddleware, createMetricsRoutes(prisma));
app.use('/api/professionals', authMiddleware, createProfessionalRoutes(prisma));
app.use('/api/uploads', authMiddleware, createUploadRoutes());
app.use('/api/transcription', authMiddleware, createTranscriptionRoutes());
app.use('/api/whatsapp', authMiddleware, createWhatsAppRoutes(prisma));

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
    console.error('❌ Error:', err.stack);
    res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Kareh Pro en puerto ${PORT}`);
});
