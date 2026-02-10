import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import dns from 'node:dns';

// 1. Inits
dns.setDefaultResultOrder('ipv4first');
dotenv.config();
const prisma = new PrismaClient();
const app = express();

// 2. Importaciones de Rutas y Controladores
import createAuthRoutes from './src/routes/auth.routes.js';
import createAppointmentRoutes from './src/routes/appointments.routes.js';
import createPatientRoutes from './src/routes/patient.routes.js';
import createCashflowRoutes from './src/routes/cashflow.routes.js';
import createClinicalHistoryRoutes from './src/routes/clinicalHistory.routes.js';
import { verifyToken } from './src/controllers/auth.controller.js';
import { authMiddleware } from './src/middlewares/authMiddleware.js';

// 3. Middlewares (CORS siempre primero)
app.use(cors({
    origin: ['https://kareh-salud.vercel.app', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '50mb' }));

// Inyectar Prisma en cada request
app.use((req, res, next) => {
    req.prisma = prisma;
    next();
});

// ==========================================
// 4. RUTAS DE LA API (ORDEN DE PRIORIDAD)
// ==========================================

// Estas rutas devuelven JSON directamente, nada de HTML
app.get('/api/auth/verify', verifyToken);
app.get('/auth/verify', verifyToken); // Por si el frontend olvida el /api

// Montamos las rutas
app.use('/api/auth', createAuthRoutes(prisma));
app.use('/api/appointments', authMiddleware, createAppointmentRoutes(prisma));
app.use('/api/patients', authMiddleware, createPatientRoutes(prisma));
app.use('/api/cashflow', authMiddleware, createCashflowRoutes(prisma));
app.use('/api/clinical-history', authMiddleware, createClinicalHistoryRoutes(prisma));

// Health Checks
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.get('/', (req, res) => res.status(200).json({ message: 'API Kareh Pro' }));

// ==========================================
// 5. MANEJO DE ERRORES (EVITAR RESPUESTA HTML)
// ==========================================

// Captura cualquier ruta no definida y responde JSON, NUNCA HTML
app.use((req, res) => {
    console.log(`📡 404 Detectado en: ${req.method} ${req.url}`);
    res.status(404).json({ error: "Ruta no encontrada en la API", path: req.url });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor listo en puerto ${PORT}`);
});