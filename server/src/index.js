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

// --- CORRECCIÓN PARA RENDER (Indispensable) ---
app.set('trust proxy', 1); 

// 1. Seguridad con Helmet
app.use(helmet({
  contentSecurityPolicy: false, // Desactivado temporalmente para facilitar el despliegue
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 2. Configuración de CORS (CORREGIDO PARA VERCEL)
app.use(cors({
  origin: [
    'https://kareh-salud.vercel.app', // <--- TU URL DE VERCEL
    'http://localhost:5173',
    'http://localhost:5174'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 3. Rate Limiting (Ajustado para no bloquearte a ti mismo)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, // Aumentamos el límite para evitar bloqueos por error
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 4. Conexión a la base de datos
prisma.$connect()
  .then(() => console.log('✅ DB Conectada con éxito'))
  .catch((e) => {
    console.error('❌ Error de conexión DB:', e.message);
    // No cerramos el proceso para permitir que Render nos de logs
  });

// --- RUTAS ---

// Ruta base para verificar que el servidor vive
app.get('/', (req, res) => {
    res.json({ message: '✅ KAREH PRO API - Online' });
});

// 6. Rutas públicas
// Nota: Si creas las rutas con createAuthRoutes, asegúrate de que dentro de ese archivo
// no estés repitiendo el prefijo /api o /auth
app.use('/api/auth', createAuthRoutes(prisma));

// 7. Rutas protegidas
app.use('/api/appointments', authMiddleware, createAppointmentRoutes(prisma));
app.use('/api/patients', authMiddleware, createPatientRoutes(prisma));
app.use('/api/cashflow', authMiddleware, createCashflowRoutes(prisma));
app.use('/api/clinical-history', authMiddleware, createClinicalHistoryRoutes(prisma));

// 8. Manejo de errores global
app.use((err, req, res, next) => {
  console.error('❌ Error detectado:', err.message);
  res.status(err.status || 500).json({ 
    message: 'Error interno del servidor',
    error: err.message 
  });
});

// 9. 404 Handler
app.use((req, res) => {
  console.log(`❓ Ruta no encontrada: ${req.method} ${req.url}`);
  res.status(404).json({ message: `Ruta no encontrada: ${req.url}` });
});

const PORT = process.env.PORT || 10000; // Render usa el 10000 por defecto
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Kareh Pro corriendo en puerto ${PORT}`);
});