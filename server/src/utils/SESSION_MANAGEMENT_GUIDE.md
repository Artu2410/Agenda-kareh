# Session Management Guide

## Overview

Sistema avanzado de manejo de sesiones con:
- Token rotation automática
- Detección de dispositivos nuevos
- Audit logging completo
- Multi-device sessions
- Revocación granular

## Características

### 1. **Token Rotation**
```
Access Token: 15 minutos (JWT)
Refresh Token: 30 días (JWT)
Automático al usar refresh
Invalida tokens anteriores
```

### 2. **Device Detection**
```
Detecta: User-Agent + IP Address
Alerta: Nuevo dispositivo/ubicación
Registro: En audit log
Notificación: Opcional al usuario
```

### 3. **Audit Logging**
```
Events:
  - SESSION_CREATED: Nuevo login
  - TOKEN_ROTATED: Rotación automática
  - SESSION_REVOKED: Logout
  - ALL_SESSIONS_REVOKED: Logout de todos
  - DEVICE_DETECTED: Dispositivo nuevo
```

### 4. **Multi-Device Support**
```
Usuario puede tener múltiples sesiones
Cada dispositivo tiene su refresh token
Puede revocar sesiones individuales
Puede ver dispositivos activos
```

## Usage

### Login y Create Session

```javascript
import SessionManager from '../utils/sessionManager.js';

const sessionManager = new SessionManager(prisma);

// En login controller
const { refreshToken, sessionId } = await sessionManager.createSession(
  userId,
  req.ip,
  req.get('user-agent')
);

// Generar access token
const { token: accessToken } = sessionManager.generateAccessToken(userId, userRole);

res.cookie('sessionId', sessionId, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
});

res.json({
  accessToken,
  refreshToken,
  expiresIn: '15m',
});
```

### Token Refresh

```javascript
// En refresh endpoint
const { accessToken, refreshToken } = await sessionManager.rotateTokens(
  req.user.userId,
  req.body.refreshTokenHash
);

res.json({
  accessToken,
  refreshToken,
  expiresIn: '15m',
});
```

### Logout (Revoke Session)

```javascript
// Logout de dispositivo actual
await sessionManager.revokeSession(
  req.user.userId,
  req.session.id
);

res.json({ status: 'success', message: 'Logged out' });
```

### Logout de Todos los Dispositivos

```javascript
// Logout de todos los dispositivos
await sessionManager.revokeAllSessions(
  req.user.userId,
  'User requested logout from all devices'
);

res.json({ status: 'success', message: 'All sessions revoked' });
```

### Ver Dispositivos Activos

```javascript
// Obtener sesiones activas
const activeSessions = await sessionManager.getActiveSessions(req.user.userId);

res.json({
  sessions: activeSessions.map(session => ({
    id: session.id,
    device: parseUserAgent(session.userAgent),
    location: parseIpAddress(session.ipAddress),
    lastUsed: session.lastUsedAt,
    createdAt: session.createdAt,
  }))
});
```

## Middleware Integration

### Session Validation

```javascript
import { sessionValidationMiddleware } from '../middlewares/sessionMiddleware.js';

// Proteger rutas
app.use('/api/protected', sessionValidationMiddleware);
```

### Device Detection

```javascript
import { deviceDetectionMiddleware } from '../middlewares/sessionMiddleware.js';

app.use(deviceDetectionMiddleware);

// En controller
if (req.isNewDevice) {
  // Enviar email de notificación
  await emailService.sendNewDeviceAlert(req.user.email);
}
```

### Session Cleanup

```javascript
import { sessionCleanupMiddleware } from '../middlewares/sessionMiddleware.js';

const sessionManager = new SessionManager(prisma);
app.use(sessionCleanupMiddleware(sessionManager));
```

## Database Schema

Asegúrate que `AuthSession` model existe en Prisma:

```prisma
model AuthSession {
  id               String    @id @default(cuid())
  userId           String
  refreshTokenHash String    @unique
  accessTokenJti   String
  ipAddress        String?
  userAgent        String?
  createdAt        DateTime  @default(now())
  lastUsedAt       DateTime?
  expiresAt        DateTime
  revokedAt        DateTime?
  
  user             User      @relation(fields: [userId], references: [id])
  
  @@index([userId])
  @@index([expiresAt])
}

model AuditLog {
  id        String    @id @default(cuid())
  userId    String
  action    String    // SESSION_CREATED, TOKEN_ROTATED, etc
  metadata  String?   // JSON stringified
  createdAt DateTime  @default(now())
  
  user      User      @relation(fields: [userId], references: [id])
  
  @@index([userId])
  @@index([action])
  @@index([createdAt])
}
```

## Security Best Practices

### ✅ DO:
- **Rotar tokens regularmente** - Cada 15 minutos para access tokens
- **Almacenar refresh tokens hasheados** - SHA256 en base de datos
- **Limpiar sesiones expiradas** - Scheduled task o on-demand
- **Loguear todo** - Auditoría completa de cambios
- **Notificar dispositivos nuevos** - Email/SMS al usuario
- **Revocar en sospecha** - Acceso anómalo debe triggear logout
- **Usar HTTPS** - Siempre en producción

### ❌ DON'T:
- **Almacenar tokens en plaintext** - Siempre hash
- **Tokens sin expiración** - Siempre establecer TTL
- **Ignorar errores de sesión** - Loguear y alertar
- **Reutilizar refresh tokens** - Siempre generar nuevos
- **Confiar solo en JWT** - Validar en BD también
- **Dejar sesiones huérfanas** - Limpiar regulamente

## Token Anatomy

### Access Token (JWT)
```javascript
{
  userId: "user-123",
  role: "ADMIN",
  jti: "access-1234567890-abc123",
  type: "access",
  iat: 1621954261,
  exp: 1621955061  // +15 minutos
}
```

### Refresh Token (JWT)
```javascript
{
  userId: "user-123",
  jti: "refresh-1234567890-abc123",
  type: "refresh",
  iat: 1621954261,
  exp: 1629730261  // +30 días
}
```

## Scenarios

### Scenario 1: Normal Login Flow

```
1. User submits email/password
2. Credentials validated ✓
3. SessionManager.createSession() called
4. New refreshToken + accessToken generated
5. Session stored in DB with hash
6. Tokens returned to client
7. Audit log: SESSION_CREATED
8. Client stores accessToken in memory, refreshToken in httpOnly cookie
```

### Scenario 2: Token Expiration & Refresh

```
1. Client makes API request with expired accessToken
2. API returns 401 Unauthorized
3. Client calls refresh endpoint with refreshToken
4. SessionManager.rotateTokens() called
5. New accessToken + refreshToken generated
6. Old tokens invalidated
7. Audit log: TOKEN_ROTATED
8. Client retries original request with new token
9. Success ✓
```

### Scenario 3: Suspicious Activity

```
1. New device detected (different User-Agent + IP)
2. deviceDetectionMiddleware sets req.isNewDevice = true
3. Controller receives notification
4. Email sent to user: "New device login"
5. User can:
   - Accept: Continue ✓
   - Deny: Revoke session immediately
```

### Scenario 4: Logout from All Devices

```
1. User clicks "Logout from all devices"
2. SessionManager.revokeAllSessions() called
3. All active sessions marked as revoked
4. All refresh tokens invalidated
5. Audit log: ALL_SESSIONS_REVOKED
6. All devices become unauthorized
7. User must login again on all devices
```

## Monitoring

### Key Metrics
```
- Active sessions per user
- Token rotation frequency
- Device detection events
- Session revocation causes
- Auth failures by IP
```

### Alerts to Set Up
```
- Multiple simultaneous sessions from different countries
- Token rotation rate > threshold
- Failed auth attempts > 5 in 15 min
- New device from suspicious location
- Session revoked by system (security risk)
```

## Testing

```javascript
describe('SessionManager', () => {
  it('should create session', async () => {
    const { refreshToken, sessionId } = await sessionManager.createSession(
      'user-123',
      '192.168.1.1',
      'Mozilla/5.0...'
    );
    
    expect(refreshToken).toBeDefined();
    expect(sessionId).toBeDefined();
  });

  it('should rotate tokens', async () => {
    // Create session first
    const { refreshToken } = await sessionManager.createSession(...);
    
    // Hash and rotate
    const hash = sha256(refreshToken);
    const newTokens = await sessionManager.rotateTokens('user-123', hash);
    
    expect(newTokens.accessToken).toBeDefined();
    expect(newTokens.refreshToken !== refreshToken).toBe(true);
  });

  it('should detect new device', async () => {
    // Create session 1
    await sessionManager.createSession('user-123', '192.168.1.1', 'Device-A');
    
    // Create session 2 (different)
    await sessionManager.createSession('user-123', '192.168.1.100', 'Device-B');
    
    // Verify both exist
    const sessions = await sessionManager.getActiveSessions('user-123');
    expect(sessions.length).toBe(2);
  });
});
```

## Troubleshooting

**Sessions getting revoked unexpectedly?**
- Check cleanup task timing
- Verify expiresAt dates in DB
- Check for race conditions

**Device detection too aggressive?**
- User-Agent parsing might be flaky
- Consider only IP for first detection

**Performance issues?**
- Index the queries in DB
- Consider Redis for session store
- Batch audit log writes

