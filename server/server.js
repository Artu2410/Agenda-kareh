import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import dns from 'node:dns';

// 1. Configuración de Red
dns.setDefaultResultOrder('ipv4first');
dotenv.config();

const prisma = new PrismaClient();
const app = express();

// 2. Importaciones
import createAuthRoutes from './src/routes/auth.routes.js';
import createAppointmentRoutes from './src/routes/appointments.routes.js';
import createPatientRoutes from './src/routes/patient.routes.js';
import createCashflowRoutes from './src/routes/cashflow.routes.js';
import createClinicalHistoryRoutes from './src/routes/clinicalHistory.routes.js';
import { verifyToken } from './src/controllers/auth.controller.js';
import { authMiddleware } from './src/middlewares/authMiddleware.js';

// 3. Middlewares Globales
app.set('trust proxy', 1);

app.use(cors({
    origin: ['https://kareh-salud.vercel.app', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '50mb' }));

app.use((req, res, next) => {
    req.prisma = prisma;
    next();
});

// ==========================================
// 4. RUTAS DE LA API (ORDEN CRÍTICO)
// ==========================================

// Log de peticiones para debug (Ayuda a ver qué llega a Render)
app.use((req, res, next) => {
    console.log(`📡 Solicitud: ${req.method} ${req.originalUrl}`);
    next();
});

// Rutas de Verificación
app.get('/api/auth/verify', verifyToken);

// Módulos de rutas
app.use('/api/auth', createAuthRoutes(prisma));
app.use('/api/appointments', authMiddleware, createAppointmentRoutes(prisma));
app.use('/api/patients', authMiddleware, createPatientRoutes(prisma));
app.use('/api/cashflow', authMiddleware, createCashflowRoutes(prisma));
app.use('/api/clinical-history', authMiddleware, createClinicalHistoryRoutes(prisma));

// Health check
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

// ==========================================
// 5. MANEJO DE ERRORES
// ==========================================

app.use((req, res) => {
    res.status(404).json({ error: "Ruta no encontrada", path: req.originalUrl });
});

app.use((err, req, res, next) => {
    console.error('❌ Error detectado:', err.stack);
    res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Kareh Pro en puerto ${PORT}`);
});