import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import path from 'path';

// 1. Configuración de variables de entorno
dotenv.config();

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
app.set('trust proxy', 1);

// ========================================
// SEGURIDAD Y MIDDLEWARES
// ========================================
app.use(helmet({
  contentSecurityPolicy: false, // Desactivado temporalmente para facilitar el despliegue
}));

app.use(cors({
  // Permitimos localhost y tu futuro dominio de Vercel (puedes usar '*' temporalmente para probar)
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
    // No cerramos el proceso inmediatamente para que Render nos deje ver los logs
  });

// Ruta de salud (Importante para Render)
app.get('/health', (req, res) => res.json({ status: 'OK', uptime: process.uptime() }));

// --- RUTAS ---
app.use('/api/auth', createAuthRoutes());
app.use('/api/appointments', authMiddleware, createAppointmentRoutes(prisma));
app.use('/api/patients', authMiddleware, createPatientRoutes(prisma));
app.use('/api/cashflow', authMiddleware, createCashflowRoutes(prisma));
app.use('/api/clinical-history', authMiddleware, createClinicalHistoryRoutes(prisma));
app.use('/api/metrics', authMiddleware, createMetricsRoutes(prisma));
app.use('/api/professionals', authMiddleware, professionalRoutes); 

// Manejo de 404
app.use((req, res) => res.status(404).json({ message: 'Ruta no encontrada' }));

// ========================================
// INICIO DEL SERVIDOR (AJUSTE PARA RENDER)
// ========================================
const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0'; // IMPORTANTE: Render requiere esto para mapear el puerto

app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor Kareh Pro corriendo en puerto ${PORT}`);
  console.log(`🌍 Acceso externo configurado correctamente`);
});