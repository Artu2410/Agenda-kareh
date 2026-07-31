# Integration Guide - Fase 2

Este archivo muestra cómo integrar todas las nuevas características en `server.js`.

## 1. Agregar Imports

```javascript
// En server.js - agregar estos imports después de los existentes
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './src/config/swagger.js';
import {
  apiLimiter,
  authLimiter,
  otpLimiter,
  uploadLimiter,
  searchLimiter,
  strictLimiter,
} from './src/config/rateLimits.js';
import SessionManager from './src/utils/sessionManager.js';
import {
  sessionValidationMiddleware,
  deviceDetectionMiddleware,
  sessionCleanupMiddleware,
} from './src/middlewares/sessionMiddleware.js';
```

## 2. Inicializar Session Manager

```javascript
const sessionManager = new SessionManager(prisma);

// Cleanup periódico de sesiones expiradas
setInterval(async () => {
  try {
    await sessionManager.cleanupExpiredSessions();
  } catch (error) {
    logger.error('Session cleanup failed', { error: error.message });
  }
}, 60 * 60 * 1000); // Cada 1 hora
```

## 3. Agregar Swagger UI

```javascript
// Agregar después de los middlewares de seguridad (helmet, cors, etc)

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  swaggerOptions: {
    persistAuthorization: true,
    displayOperationIds: true,
  },
  customCss: `.topbar { display: none }`,
}));

// Endpoint para obtener swagger.json
app.get('/api/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});
```

## 4. Aplicar Rate Limiting

```javascript
// Aplicar rate limiting general a toda la API
app.use('/api', apiLimiter);

// Rate limiting en endpoints específicos
// Auth routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/verify-otp', otpLimiter);
app.use('/api/auth/request-otp', strictLimiter);

// Upload routes
app.use('/api/upload', uploadLimiter);
app.use('/api/attachments', uploadLimiter);

// Search routes
app.use('/api/patients/search', searchLimiter);
app.use('/api/appointments/search', searchLimiter);

// O aplicar a rutas específicas:
// router.post('/login', authLimiter, authController.login);
```

## 5. Integrar Session Management

```javascript
// Session validation middleware
app.use('/api/protected', sessionValidationMiddleware);

// Device detection
app.use(deviceDetectionMiddleware);

// Session cleanup
app.use(sessionCleanupMiddleware(sessionManager));

// Pasar sessionManager a req
app.use((req, res, next) => {
  req.sessionManager = sessionManager;
  next();
});
```

## 6. Async Error Handler

```javascript
// Importar al inicio
import 'express-async-errors';

// Esto debe estar ANTES de definir rutas
// Permite que async/await en routes lance errores automáticamente al errorHandler
```

## 7. Endpoints de Sesión (ejemplo)

```javascript
// En auth.routes.js o nuevo routes/sessions.routes.js

/**
 * @swagger
 * /api/sessions/active:
 *   get:
 *     summary: Get all active sessions
 *     security:
 *       - bearerAuth: []
 */
router.get('/sessions/active', sessionValidationMiddleware, async (req, res) => {
  const sessions = await req.sessionManager.getActiveSessions(req.user.userId);
  res.json({ sessions });
});

/**
 * @swagger
 * /api/sessions/{sessionId}/revoke:
 *   post:
 *     summary: Revoke specific session
 *     security:
 *       - bearerAuth: []
 */
router.post('/sessions/:sessionId/revoke', sessionValidationMiddleware, async (req, res) => {
  await req.sessionManager.revokeSession(req.user.userId, req.params.sessionId);
  res.json({ status: 'success' });
});

/**
 * @swagger
 * /api/sessions/revoke-all:
 *   post:
 *     summary: Logout from all devices
 *     security:
 *       - bearerAuth: []
 */
router.post('/sessions/revoke-all', sessionValidationMiddleware, async (req, res) => {
  await req.sessionManager.revokeAllSessions(req.user.userId, 'User requested');
  res.json({ status: 'success', message: 'All sessions revoked' });
});
```

## 8. Actualizar Auth Flow

```javascript
// En auth.controller.js - actualizar login

export const login = async (req, res, next) => {
  try {
    // Validar credenciales...
    const user = await validateCredentials(req.body.email, req.body.password);

    // Crear sesión
    const { refreshToken, sessionId } = await req.sessionManager.createSession(
      user.id,
      req.ip,
      req.get('user-agent')
    );

    // Generar access token
    const { token: accessToken } = req.sessionManager.generateAccessToken(
      user.id,
      user.role
    );

    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken,
      refreshToken,
      expiresIn: '15m',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Nuevo endpoint para refresh token
export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new Error('Refresh token required');

    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const tokens = await req.sessionManager.rotateTokens(req.user.userId, hash);

    res.json(tokens);
  } catch (error) {
    next(error);
  }
};

// Logout endpoint
export const logout = async (req, res, next) => {
  try {
    await req.sessionManager.revokeSession(req.user.userId, req.session.id);
    res.clearCookie('sessionId');
    res.json({ status: 'success' });
  } catch (error) {
    next(error);
  }
};
```

## 9. Documentar Endpoints Existentes

Agregar comentarios Swagger a tus rutas existentes:

```javascript
// En routes/appointments.routes.js

/**
 * @swagger
 * /api/appointments:
 *   get:
 *     summary: Get all appointments
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of appointments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Appointment'
 */
router.get('/', getAppointments);
```

## 10. Error Handling Mejorado

Ya está integrado en `errorHandler.js`, simplemente asegura que esté siendo usado:

```javascript
// En server.js - al final
app.use(errorHandler);
```

## Full Example - Simplified server.js Integration

```javascript
// === TOP OF FILE ===
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import 'express-async-errors'; // Agregar esto
import logger, { createRequestLogger } from './src/config/logger.js';
import { validateEnv } from './src/config/env.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './src/config/swagger.js';
import { apiLimiter, authLimiter, otpLimiter } from './src/config/rateLimits.js';
import SessionManager from './src/utils/sessionManager.js';
import { sessionValidationMiddleware } from './src/middlewares/sessionMiddleware.js';

// === SETUP ===
dotenv.config();
const env = validateEnv();
const prisma = new PrismaClient();
const app = express();

// Session manager
const sessionManager = new SessionManager(prisma);

// === MIDDLEWARES ===
app.set('trust proxy', 1);
app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});
app.use(createRequestLogger);

// Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/swagger.json', (req, res) => {
  res.send(swaggerSpec);
});

// CORS, security, etc...
app.use(cors({ /* ... */ }));
app.use(cookieParser());
app.use(helmet());

// Body parser
app.use(express.json({ limit: '50mb' }));

// Rate limiting
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/verify-otp', otpLimiter);

// Session support
app.use((req, res, next) => {
  req.sessionManager = sessionManager;
  next();
});

// === ROUTES ===
app.use('/api/auth', createAuthRoutes());
app.use('/api/appointments', createAppointmentRoutes());
// ... más rutas

// === ERROR HANDLER ===
app.use(errorHandler);

// === START SERVER ===
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
```

## Testing the Integration

```bash
# Test Swagger
curl http://localhost:5000/api-docs

# Test Rate Limiting
for i in {1..6}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done

# Should get 429 on 6th request

# Test Session Management
curl http://localhost:5000/api/sessions/active \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Next Steps

1. ✅ Agregar Swagger a server.js
2. ✅ Integrar rate limiters en endpoints críticos
3. ✅ Integrar session manager en login flow
4. ✅ Documentar todos los endpoints con JSDoc
5. ✅ Actualizar frontend para usar refresh tokens
6. ✅ Agregar notificaciones de nuevo dispositivo
7. ✅ Setup alerts para actividad sospechosa

