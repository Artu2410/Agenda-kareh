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
// Fuerza a Node.js a priorizar IPv4 para evitar errores de conexión SMTP/API
dns.setDefaultResultOrder('ipv4first');

dotenv.config();
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
app.set('trust proxy', 1); 

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

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, 
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(generalLimiter);

// ========================================
// 4. CONEXIÓN A BASE DE DATOS
// ========================================
prisma.$connect()
  .then(() => console.log('✅ DB Conectada con éxito'))
  .catch((e) => console.error('❌ Error de conexión DB:', e.message));

// ========================================
// 5. DEFINICIÓN DE RUTAS (CORREGIDO)
// ========================================

// Guardamos las rutas de auth en una constante
const authRoutes = createAuthRoutes(prisma);

// REGISTRO DOBLE: Esto soluciona el error 404 del Frontend
app.use('/api/auth', authRoutes); // Para llamadas estándar
app.use('/auth', authRoutes);     // Para la llamada que hace tu frontend a /auth/verify

// Rutas protegidas por middleware
app.use('/api/appointments', authMiddleware, createAppointmentRoutes(prisma));
app.use('/api/patients', authMiddleware, createPatientRoutes(prisma));
app.use('/api/cashflow', authMiddleware, createCashflowRoutes(prisma));
app.use('/api/clinical-history', authMiddleware, createClinicalHistoryRoutes(prisma));

// Rutas de utilidad
app.get('/health', (req, res) => res.json({ status: 'OK', uptime: process.uptime() }));
app.get('/', (req, res) => res.json({ message: '🚀 KAREH PRO API - Online' }));

// ========================================
// 6. MANEJO DE ERRORES
// ========================================

// Error 404 para rutas no definidas
app.use((req, res) => {
  console.log(`❓ Ruta no encontrada: ${req.method} ${req.url}`);
  res.status(404).json({ message: `Ruta no encontrada: ${req.url}` });
});

// Manejador global de errores
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