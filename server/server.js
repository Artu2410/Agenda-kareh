import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import dns from 'node:dns';

// ========================================
// 1. CONFIGURACIÓN CRÍTICA DE RED (RENDER)
// ========================================
// Esto obliga a Node.js a ignorar IPv6 y usar IPv4, eliminando el error ENETUNREACH
dns.setDefaultResultOrder('ipv4first');

// Carga de variables de entorno
dotenv.config();

// Inicialización de Prisma
const prisma = new PrismaClient();

// ========================================
// 2. IMPORTACIÓN DE RUTAS
// ========================================
import createAppointmentRoutes from './src/routes/appointments.routes.js';
import createPatientRoutes from './src/routes/patient.routes.js';
import createCashflowRoutes from './src/routes/cashflow.routes.js';
import createClinicalHistoryRoutes from './src/routes/clinicalHistory.routes.js';
import createAuthRoutes from './src/routes/auth.routes.js';
import { authMiddleware } from './src/middlewares/authMiddleware.js';

const app = express();

// ========================================
// 3. MIDDLEWARES DE SEGURIDAD Y CONFIG.
// ========================================
app.set('trust proxy', 1); // Indispensable para Render

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: [
    'https://kareh-salud.vercel.app', 
    'http://localhost:5173',
    'http://localhost:5174'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Aumentamos límites para evitar problemas con historiales clínicos pesados
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // Límite generoso
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(generalLimiter);

// ========================================
// 4. CONEXIÓN A BASE DE DATOS
// ========================================
prisma.$connect()
  .then(() => console.log('✅ DB Conectada con éxito'))
  .catch((e) => {
    console.error('❌ Error de conexión DB:', e.message);
  });

// Verificación de entorno en consola de Render
console.log('--- Verificación de Entorno ---');
console.log('Email configurado:', process.env.GMAIL_USER ? '✅ SI' : '❌ NO');
console.log('Pass configurada:', process.env.GMAIL_APP_PASSWORD ? '✅ SI' : '❌ NO');
console.log('-------------------------------');

// ========================================
// 5. DEFINICIÓN DE RUTAS
// ========================================

// Ruta de salud para Render
app.get('/health', (req, res) => res.json({ status: 'OK' }));

// Ruta base
app.get('/', (req, res) => {
    res.json({ message: '🚀 KAREH PRO API - Online' });
});

// Rutas de la API
app.use('/api/auth', createAuthRoutes(prisma));
app.use('/api/appointments', authMiddleware, createAppointmentRoutes(prisma));
app.use('/api/patients', authMiddleware, createPatientRoutes(prisma));
app.use('/api/cashflow', authMiddleware, createCashflowRoutes(prisma));
app.use('/api/clinical-history', authMiddleware, createClinicalHistoryRoutes(prisma));

// ========================================
// 6. MANEJO DE ERRORES
// ========================================

// Error 404
app.use((req, res) => {
  console.log(`❓ Ruta no encontrada: ${req.method} ${req.url}`);
  res.status(404).json({ message: `Ruta no encontrada: ${req.url}` });
});

// Error Global
app.use((err, req, res, next) => {
  console.error('❌ Error detectado:', err.message);
  res.status(err.status || 500).json({ 
    message: 'Error interno del servidor',
    error: err.message 
  });
});

// ========================================
// 7. INICIO DEL SERVIDOR
// ========================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Kareh Pro corriendo en puerto ${PORT}`);
});