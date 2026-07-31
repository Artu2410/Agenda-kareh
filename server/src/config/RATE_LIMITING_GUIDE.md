# Rate Limiting Guide

## Overview

El proyecto implementa rate limiting estratégico para proteger contra:
- Brute force attacks (login, OTP)
- DOS attacks (API general)
- Abuse de uploads
- Scraping de datos

## Rate Limiters Disponibles

### 1. **apiLimiter** - General API Protection
```
Límite: 100 requests / 15 minutos
Uso: Endpoints normales de lectura/escritura
Headers: X-RateLimit-Limit, X-RateLimit-Remaining
```

### 2. **authLimiter** - Authentication Protection
```
Límite: 5 intentos fallidos / 15 minutos
Usa: Solo cuenta intentos fallidos
Endpoints: /api/auth/login, /api/auth/register
Protege contra: Brute force de contraseña
```

### 3. **otpLimiter** - OTP Verification
```
Límite: 5 intentos / 15 minutos
Usa: Solo intentos fallidos
Endpoints: /api/auth/verify-otp
Protege contra: Fuerza bruta de códigos OTP
```

### 4. **uploadLimiter** - File Upload Protection
```
Límite: 20 uploads / 1 hora
Endpoints: /api/upload, /api/attachments
Protege contra: Storage abuse
```

### 5. **strictLimiter** - Sensitive Endpoints
```
Límite: 3 requests / 1 hora
Endpoints: OTP generation, password reset
Protege contra: Abuse de recursos costosos
```

### 6. **searchLimiter** - Search/Filter Protection
```
Límite: 30 búsquedas / 1 minuto
Endpoints: /api/patients/search, /api/appointments/search
Protege contra: Query complexity abuse
```

## Cómo Usar

### En Routes

```javascript
import { authLimiter, apiLimiter } from '../config/rateLimits.js';

router.post('/login', authLimiter, authController.login);
router.get('/patients', apiLimiter, patientController.getPatients);
router.post('/upload', uploadLimiter, uploadController.upload);
```

### En Middlewares

```javascript
import { apiLimiter } from '../config/rateLimits.js';

// Aplicar a todas las rutas API
app.use('/api', apiLimiter);
```

## Headers de Rate Limit

Cada respuesta incluye headers estándar:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1621954261
Retry-After: 300
```

El cliente puede usar `Retry-After` para saber cuándo reintentar.

## Configuración en Development vs Production

### Development
- Rate limits más altos
- Saltan si `NODE_ENV === 'test'`
- Logging detallado

### Production
- Límites estrictos
- Almacenamiento en Redis (opcional)
- IP-based tracking

## Bypass Rate Limiting

Para usuarios admin o en testing:

```javascript
app.use((req, res, next) => {
  if (req.user?.role === 'SUPER_USER') {
    // Bypass rate limiting
  }
  next();
});
```

## Store Options

Por defecto usa memory store (local). Para producción con múltiples servidores, usa Redis:

```javascript
import RedisStore from 'rate-limit-redis';
import redis from 'redis';

const redisClient = redis.createClient();

export const authLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:auth:',
  }),
  // ... resto de configuración
});
```

## Monitoreo

Puedes agregar hooks para alertas:

```javascript
authLimiter.on('limit', (req, res, options) => {
  logger.warn('Rate limit hit', {
    ip: req.ip,
    endpoint: req.path,
  });
  
  // Enviar alerta si hay muchos hits
  if (req.rateLimit.current > 10) {
    alerting.sendAlert('Too many failed auth attempts');
  }
});
```

## Skip Conditions

Puedes hacer skip de rate limiting:

```javascript
export const apiLimiter = rateLimit({
  skip: (req) => {
    // Skip para admins
    if (req.user?.role === 'SUPER_USER') return true;
    // Skip en testing
    if (process.env.NODE_ENV === 'test') return true;
    return false;
  },
});
```

## Error Responses

Cuando se excede el límite:

```json
{
  "status": "fail",
  "message": "Demasiadas requests, intenta más tarde"
}
```

HTTP 429 Too Many Requests

## Scenarios

### Login Attack Simulation

```bash
# Si intentas más de 5 veces en 15 min, blockeado
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"wrong"}'

# Respuesta después de 5 intentos:
# HTTP 429
# {
#   "status": "fail",
#   "message": "Demasiados intentos fallidos..."
# }
```

### Upload Limit

```bash
# 20 uploads en 1 hora - el 21ero será rechazado
curl -X POST http://localhost:5000/api/upload \
  -F "file=@image.jpg"

# Después de 20:
# HTTP 429
```

## Best Practices

✅ **DO:**
- Combina rate limiting con CORS
- Implementa exponential backoff en cliente
- Loguea todos los rate limit hits
- Usa diferentes límites para diferentes endpoints
- Considera IP + User ID para tracking

❌ **DON'T:**
- No desactives rate limiting en prod
- No uses muy estrictos por defecto
- No olvides limpiar old rate limit records
- No ignores patrones de ataque

## Testing

```javascript
describe('Rate Limiting', () => {
  it('should limit auth attempts', async () => {
    for (let i = 0; i < 6; i++) {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'wrong' });
      
      if (i < 5) {
        expect(response.status).toBe(400); // Bad credentials
      } else {
        expect(response.status).toBe(429); // Rate limited
      }
    }
  });
});
```

## Troubleshooting

**Rate limit no funciona?**
- Verifica que `skip` no esté retornando `true`
- Confirma que NODE_ENV está correcto
- Chequea los headers de respuesta

**Too restrictive?**
- Ajusta los valores de `max` y `windowMs`
- Usa `skipSuccessfulRequests: true` donde sea posible

**IP no detectada correctamente?**
- Asegura `app.set('trust proxy', 1)` en server.js
- Verifica headers `X-Forwarded-For`

