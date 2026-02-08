import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';

// Importación de las funciones de rutas y middleware
import createAppointmentRoutes from './src/routes/appointments.routes.js';
import createPatientRoutes from './src/routes/patient.routes.js';
import createCashflowRoutes from './src/routes/cashflow.routes.js';
import createClinicalHistoryRoutes from './src/routes/clinicalHistory.routes.js';
import createAuthRoutes from './src/routes/auth.routes.js';
import { authMiddleware } from './src/middlewares/authMiddleware.js';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

// 1. Seguridad con Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
}));

// 2. Configuración de CORS
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5173', 
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175'
  ],
  credentials: true
}));

// 3. Rate Limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos por IP
  message: '❌ Demasiados intentos de login. Intenta de nuevo más tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por IP
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', generalLimiter);
app.use('/api/auth/google-callback', loginLimiter);

// 4. Configuración de JSON y Límites de carga
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 5. Conexión a la base de datos
prisma.$connect()
  .then(() => console.log('✅ DB Conectada con éxito'))
  .catch((e) => {
    console.error('❌ Error de conexión DB:', e);
    process.exit(1);
  });

// 6. Rutas públicas (SIN autenticación)
app.use('/api/auth', createAuthRoutes(prisma));

// 7. Rutas protegidas (REQUIEREN autenticación)
app.use('/api/appointments', authMiddleware, createAppointmentRoutes(prisma));
app.use('/api/patients', authMiddleware, createPatientRoutes(prisma));
app.use('/api/cashflow', authMiddleware, createCashflowRoutes(prisma));
app.use('/api/clinical-history', authMiddleware, createClinicalHistoryRoutes(prisma));

// Ruta base de prueba
app.get('/', (req, res) => {
    res.json({ 
      message: '✅ KAREH PRO API - Online',
      timestamp: new Date().toISOString(),
      version: '2.0.0'
    });
});

// Ruta de health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 8. Manejo de errores global
app.use((err, req, res, next) => {
  console.error('❌ Error detectado:', err.stack);
  res.status(err.status || 500).json({ 
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Contacta al administrador'
  });
});

// 9. 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor Kareh Pro corriendo en http://localhost:${PORT}`);
    console.log(`📝 API base: http://localhost:${PORT}/api`);
    console.log(`🔐 Seguridad: Helmet + Rate Limiting + JWT Auth`);
    console.log(`📦 Límite de carga: 50MB`);
});