import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import dns from 'node:dns';

// 1. Prioridad IPv4 para evitar errores de red en Render
dns.setDefaultResultOrder('ipv4first');

dotenv.config();
const prisma = new PrismaClient();

// 2. Importaciones de rutas y controladores
import createAppointmentRoutes from './src/routes/appointments.routes.js';
import createPatientRoutes from './src/routes/patient.routes.js';
import createCashflowRoutes from './src/routes/cashflow.routes.js';
import createClinicalHistoryRoutes from './src/routes/clinicalHistory.routes.js';
import createAuthRoutes from './src/routes/auth.routes.js';
import { verifyToken } from './src/controllers/auth.controller.js'; 
import { authMiddleware } from './src/middlewares/authMiddleware.js';

const app = express();

// 3. Middlewares de Seguridad y Configuración
app.set('trust proxy', 1); 

app.use(helmet({ 
  contentSecurityPolicy: false, 
  crossOriginResourcePolicy: { policy: "cross-origin" } 
}));

// CORS CONFIGURACIÓN CRÍTICA
app.use(cors({
    origin: [
      'https://kareh-salud.vercel.app', 
      'http://localhost:5173'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Inyectar prisma en req para todos los controladores
app.use((req, res, next) => {
    req.prisma = prisma;
    next();
});

// 4. DEFINICIÓN DE RUTAS (ORDEN CRÍTICO)

// Ruta de salud rápida
app.get('/health', (req, res) => res.json({ status: 'OK' }));

// RUTAS DE AUTENTICACIÓN DIRECTAS (Para evitar el error HTML 404)
// Estas deben ir antes que cualquier otra ruta de la API
app.get('/auth/verify', verifyToken);
app.get('/api/auth/verify', verifyToken);

// Agrupación de rutas por módulo
app.use('/api/auth', createAuthRoutes(prisma));
app.use('/api/appointments', authMiddleware, createAppointmentRoutes(prisma));
app.use('/api/patients', authMiddleware, createPatientRoutes(prisma));
app.use('/api/cashflow', authMiddleware, createCashflowRoutes(prisma));
app.use('/api/clinical-history', authMiddleware, createClinicalHistoryRoutes(prisma));

// Ruta raíz
app.get('/', (req, res) => {
    res.json({ message: '🚀 API Kareh Pro Online' });
});

// 5. MANEJO DE ERRORES (Al final de todo)

// Si llega aquí, es que ninguna ruta anterior coincidió (Error 404)
app.use((req, res) => {
  console.log(`❓ Ruta no encontrada: ${req.method} ${req.url}`);
  res.status(404).json({ 
    message: "Ruta no encontrada",
    path: req.url 
  });
});

// Manejador de errores global (Para evitar colapsos)
app.use((err, req, res, next) => {
  console.error('❌ Error Interno:', err.message);
  res.status(err.status || 500).json({ 
    message: 'Error interno del servidor',
    error: err.message 
  });
});

// 6. INICIO DEL SERVIDOR
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Kareh Pro corriendo en puerto ${PORT}`);
});