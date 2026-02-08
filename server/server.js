import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import path from 'path'; // Importación necesaria para la ruta del .env

// 1. Configuración de variables de entorno (FORZADA)
// Usamos process.cwd() para asegurar que busque en la raíz de la carpeta del servidor
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Log de depuración (puedes borrarlo después de verificar que funcione)
console.log('--- Verificación de Entorno ---');
console.log('Email configurado:', process.env.GMAIL_USER ? '✅ SI' : '❌ NO');
console.log('Pass configurada:', process.env.GMAIL_APP_PASSWORD ? '✅ SI' : '❌ NO');
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
const prisma = new PrismaClient();

// ========================================
// SEGURIDAD: Helmet + Rate Limiting
// ========================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
}));

// Rate limiter general
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Demasiadas peticiones, intenta más tarde',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production', 
});

// Rate limiter específico para Auth (Prevención de fuerza bruta)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Aumentado a 10 para evitar bloqueos accidentales en pruebas
  message: 'Demasiados intentos, intenta más tarde',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

// Middleware básico
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Conexión a DB
prisma.$connect()
  .then(() => console.log('✅ DB Conectada con éxito'))
  .catch((e) => {
    console.error('❌ Error de conexión DB:', e);
    process.exit(1);
  });

// Ruta de salud
app.get('/health', (req, res) => res.json({ status: 'OK' }));

// --- RUTAS API PÚBLICAS ---
// Aplicamos el limitador específicamente aquí
app.use('/api/auth/request-otp', loginLimiter);
app.use('/api/auth/verify-otp', loginLimiter);
app.use('/api/auth', createAuthRoutes());

// --- RUTAS API PROTEGIDAS ---
app.use('/api/appointments', authMiddleware, createAppointmentRoutes(prisma));
app.use('/api/patients', authMiddleware, createPatientRoutes(prisma));
app.use('/api/cashflow', authMiddleware, createCashflowRoutes(prisma));
app.use('/api/clinical-history', authMiddleware, createClinicalHistoryRoutes(prisma));
app.use('/api/metrics', authMiddleware, createMetricsRoutes(prisma));
app.use('/api/professionals', authMiddleware, professionalRoutes); 

// Manejo de 404
app.use((req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('❌ Error detectado:', err.stack);
  res.status(500).json({ 
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor Kareh Pro corriendo en http://localhost:${PORT}`);
});