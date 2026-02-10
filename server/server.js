import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import dns from 'node:dns';

// 1. Prioridad IPv4 para evitar errores de red
dns.setDefaultResultOrder('ipv4first');

dotenv.config();
const prisma = new PrismaClient();

// 2. Importaciones de rutas y controladores
import createAppointmentRoutes from './src/routes/appointments.routes.js';
import createPatientRoutes from './src/routes/patient.routes.js';
import createCashflowRoutes from './src/routes/cashflow.routes.js';
import createClinicalHistoryRoutes from './src/routes/clinicalHistory.routes.js';
import createAuthRoutes from './src/routes/auth.routes.js';
import { verifyToken } from './src/controllers/auth.controller.js'; // Importación directa
import { authMiddleware } from './src/middlewares/authMiddleware.js';

const app = express();

// 3. Middlewares
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
    origin: ['https://kareh-salud.vercel.app', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 4. Conexión a DB
prisma.$connect()
  .then(() => console.log('✅ DB Conectada con éxito'))
  .catch((e) => console.error('❌ Error DB:', e.message));

// 5. DEFINICIÓN DE RUTAS (El arreglo definitivo)

// Inyectamos prisma en las solicitudes
app.use((req, res, next) => {
    req.prisma = prisma;
    next();
});

// RUTA CRÍTICA: Definida explícitamente para el Frontend
// Esto soluciona el error: GET https://kareh-backend.onrender.com/auth/verify
app.get('/auth/verify', verifyToken); 
app.get('/api/auth/verify', verifyToken);

// Rutas generales de Autenticación
app.use('/api/auth', createAuthRoutes(prisma));

// Otras rutas de la API
app.use('/api/appointments', authMiddleware, createAppointmentRoutes(prisma));
app.use('/api/patients', authMiddleware, createPatientRoutes(prisma));
app.use('/api/cashflow', authMiddleware, createCashflowRoutes(prisma));
app.use('/api/clinical-history', authMiddleware, createClinicalHistoryRoutes(prisma));

// Health Checks
app.get('/health', (req, res) => res.json({ status: 'OK' }));
app.get('/', (req, res) => res.json({ message: '🚀 API Kareh Pro Online' }));

// 6. Manejo de errores
app.use((req, res) => {
  console.log(`❓ 404 detectado en: ${req.method} ${req.url}`);
  res.status(404).json({ message: "Ruta no encontrada" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});