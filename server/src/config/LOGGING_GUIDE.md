# Logging Guide

## Overview

El proyecto ahora utiliza Winston como logger centralizado. Todos los logs se dirigen automáticamente a archivos y consola.

## Características

✅ **Logging en múltiples formatos**
- Consola (desarrollo)
- Archivos (producción)
- Niveles: debug, info, warn, error

✅ **Contexto automático**
- Request IDs
- Información del usuario
- URL y método HTTP
- Timestamps

✅ **Rotación de archivos**
- Máximo 5MB por archivo
- Archivos históricos retenidos automáticamente

## Uso

### Logger Global

```javascript
import logger from './src/config/logger.js';

logger.info('Mensaje informativo', { userId: '123' });
logger.error('Error occurred', { errorCode: 'ERR_001' });
logger.warn('Warning message');
logger.debug('Debug info');
```

### Logger con Contexto (en requests)

En middlewares o controllers:

```javascript
export const createUser = (req, res, next) => {
  const logger = req.logger; // Logger con contexto de request
  
  logger.info('Creating new user', { email: req.body.email });
  
  // ...tu código...
  
  logger.error('User creation failed', { reason: error.message });
};
```

## Estructura de Logs

### Desarrollo (Console)

```
2026-05-25 14:30:45 [kareh-backend] info: Creating new user { email: 'user@test.com' }
```

### Producción (Archivos)

```json
{
  "level": "error",
  "message": "Database connection failed",
  "timestamp": "2026-05-25T14:30:45.123Z",
  "service": "kareh-backend",
  "errorCode": "DB_CONN_001",
  "stack": "Error: ECONNREFUSED 127.0.0.1:5432\n at..."
}
```

## Archivos de Log

Ubicación: `server/logs/`

- `error.log` - Solo errores (level >= error)
- `combined.log` - Todos los logs
- Rotación automática cada 5MB

## Niveles de Log

| Nivel | Cuándo usar | Ejemplo |
|-------|------------|---------|
| **error** | Errores que requieren atención | Fallos de BD, errores de validación |
| **warn** | Situaciones anómalas | Login fallido, recurso no encontrado |
| **info** | Eventos importantes | Usuario creado, login exitoso |
| **debug** | Información detallada (dev) | Valores de variables, pasos de flujo |

## Best Practices

### ✅ Bueno

```javascript
logger.error('Failed to create user', {
  email: user.email,
  reason: error.message,
  statusCode: 500
});
```

### ❌ Evitar

```javascript
logger.error(error); // Solo el error object
// No usar console.log en producción.
logger.info('a'); // Mensaje muy vago
```

## Contexto de Request

El middleware `createRequestLogger` agrega automáticamente:

```javascript
{
  requestId: 'req-1234567890-abc123',
  method: 'POST',
  path: '/api/users',
  ip: '192.168.1.1'
}
```

## Deshabilitando Logs en Tests

En `jest.setup.js`:

```javascript
// Esto suprime los logs durante tests
jest.mock('../src/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
    })),
  },
}));
```

## Integración con Monitoreo

Para producción, puedes conectar a servicios como:

- **DataDog** - Monitoring
- **New Relic** - APM
- **Loggly** - Log aggregation

## Troubleshooting

**Logs no aparecen en consola?**
- Verifica `NODE_ENV` - debug solo está habilitado en development
- Revisa permisos de escritura en directorio `logs/`

**Archivos de log crecen muy rápido?**
- Reduce la verbosidad en producción
- Implementa log sampling

**Performance degradado?**
- Considera usar asynchronous transports
- Implementa log buffering

## Próximos pasos

- [ ] Crear dashboard en DataDog
- [ ] Implementar alerts basados en logs
- [ ] Setup log aggregation en producción

