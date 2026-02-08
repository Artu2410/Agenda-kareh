import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import path from 'path';

// 1. Configuración de variables de entorno
dotenv.config();

// Inicializamos Prisma ANTES de usarlo
const prisma = new PrismaClient();

console.log('--- Verificación de Entorno ---');
console.log('Email configurado:', process.env.GMAIL_USER ? '✅ SI' : '❌ NO');
console.log('Pass configurada:', process.env.GMAIL_APP_PASSWORD ? '✅ SI' : '❌ NO');
console.log('Database URL detectada:', process.env.DATABASE_URL ? '✅ SI' : '❌ NO');
console.log('-------------------------------');

// Importación de rutas
import createAppointmentRoutes from './src/routes/appointments.routes.js';
import createPatientRoutes from './src/routes/patient.routes.js';
import createCashflowRoutes from './src/routes/cashflow.routes.js';
import createClinicalHistoryRoutes from './src/routes/clinicalHistory.routes.js';
import createMetricsRoutes from './src/routes/metrics.routes.js';
import createAuthRoutes from './src/routes/auth.routes.js';
import professionalRoutes from './src/routes/professionalRoutes.js';
import { authMiddleware } from './src/middlewares/authMiddleware.js';

const app = express();

// ========================================
// CONFIGURACIÓN PARA RENDER
// ========================================
app.set('trust proxy', 1); // Necesario para rate-limit en Render

// ========================================
// SEGURIDAD Y MIDDLEWARES
// ========================================
app.use(helmet({
  contentSecurityPolicy: false, 
}));

app.use(cors({
  // Permitimos cualquier origen en producción si tienes problemas de CORS, 
  // o tu URL de Vercel específica
  origin: true, 
  credentials: true
}));

app.use(express.json());

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  skip: () => process.env.NODE_ENV !== 'production', 
});
app.use(generalLimiter);

// ========================================
// CONEXIÓN A DB
// ========================================
prisma.$connect()
  .then(() => console.log('✅ DB Conectada con éxito'))
  .catch((e) => {
    console.error('❌ Error de conexión DB:', e.message);
  });

// Ruta de salud (Vital para el Health Check de Render)
app.get('/health', (req, res) => res.json({ status: 'OK', uptime: process.uptime() }));

// --- RUTAS ---
// Pasamos 'prisma' a todas las funciones que lo requieran
app.use('/api/auth', createAuthRoutes(prisma)); 
app.use('/api/appointments', authMiddleware, createAppointmentRoutes(prisma));
app.use('/api/patients', authMiddleware, createPatientRoutes(prisma));
app.use('/api/cashflow', authMiddleware, createCashflowRoutes(prisma));
app.use('/api/clinical-history', authMiddleware, createClinicalHistoryRoutes(prisma));
app.use('/api/metrics', authMiddleware, createMetricsRoutes(prisma));
app.use('/api/professionals', authMiddleware, professionalRoutes); 

// Ruta base
app.get('/', (req, res) => {
  res.json({ message: '🚀 API de Kareh Pro activa' });
});

// Manejo de 404
app.use((req, res) => {
  console.log(`⚠️ 404 - Ruta no encontrada: ${req.method} ${req.url}`);
  res.status(404).json({ message: 'Ruta no encontrada' });
});

// ========================================
// INICIO DEL SERVIDOR
// ========================================
const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0'; 

app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor Kareh Pro corriendo en puerto ${PORT}`);
  console.log(`🌍 Acceso externo configurado correctamente en ${HOST}`);
});