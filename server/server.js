import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import dns from 'node:dns';

// 1. Configuración de Red e Inicialización
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

// 3. Middlewares Globales
app.set('trust proxy', 1);

// CORS: Configuración estricta para Vercel
app.use(cors({
    origin: ['https://kareh-salud.vercel.app', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Inyectar Prisma en el objeto request
app.use((req, res, next) => {
    req.prisma = prisma;
    next();
});

// ==========================================
// 4. RUTAS DE LA API (ORDEN CRÍTICO)
// ==========================================

// Rutas de Verificación Inmediata (Evitan redirecciones HTML)
app.get('/api/auth/verify', verifyToken);
app.get('/auth/verify', verifyToken); 

// Montaje de módulos de rutas
app.use('/api/auth', createAuthRoutes(prisma));
app.use('/api/appointments', authMiddleware, createAppointmentRoutes(prisma));
app.use('/api/patients', authMiddleware, createPatientRoutes(prisma));
app.use('/api/cashflow', authMiddleware, createCashflowRoutes(prisma));
app.use('/api/clinical-history', authMiddleware, createClinicalHistoryRoutes(prisma));

// Utilidades del Servidor
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', timestamp: new Date() }));
app.get('/', (req, res) => res.status(200).json({ message: '🚀 KAREH PRO API Online' }));

// ==========================================
// 5. MANEJO DE ERRORES Y RUTAS NO ENCONTRADAS
// ==========================================

// Middleware para capturar cualquier ruta no definida y responder SIEMPRE en JSON
app.use((req, res) => {
    console.log(`📡 404 - Ruta no encontrada: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
        error: "Endpoint no encontrado", 
        method: req.method,
        path: req.originalUrl 
    });
});

// Manejador de errores global para evitar que el servidor se caiga
app.use((err, req, res, next) => {
    console.error('❌ Error Interno:', err.stack);
    res.status(err.status || 500).json({ 
        error: "Error interno del servidor",
        message: err.message 
    });
});

// 6. Lanzamiento
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    🚀 Servidor Kareh Pro iniciado con éxito
    📡 Puerto: ${PORT}
    🔗 URL: http://0.0.0.0:${PORT}
    `);
});