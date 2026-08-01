# Swagger Documentation Guide

## Overview

Todos los endpoints ahora pueden ser documentados automáticamente usando comentarios JSDoc.

## How to Document Endpoints

Agrega comentarios JSDoc en tus route files para documentar automáticamente:

### Ejemplo Básico

```javascript
/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: List all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter by user role
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
```

### POST con Request Body

```javascript
/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - fullName
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               fullName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [ADMIN, PROFESSIONAL]
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request
 */
```

### Path Parameters

```javascript
/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 */
```

## Common Tags

Agrupa endpoints usando tags:

```javascript
tags: [Users]          // Para endpoints de usuarios
tags: [Appointments]   // Para appointments
tags: [Auth]          // Para autenticación
tags: [Cashflow]      // Para gestión de pagos
tags: [Clinical]      // Para historias clínicas
```

## Security Schemes

### Bearer Token (JWT)

```javascript
security:
  - bearerAuth: []
```

### Cookie Auth

```javascript
security:
  - cookieAuth: []
```

### Optional Auth

```javascript
security:
  - bearerAuth: []
  - {}  // Also allow unauthenticated
```

## Response Codes

| Código | Cuándo | Ejemplo |
|--------|--------|---------|
| 200 | GET exitoso, PUT exitoso | Fetching data, update complete |
| 201 | POST exitoso | User created |
| 204 | DELETE exitoso | Resource deleted, no content |
| 400 | Bad request | Invalid input validation |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Permissions issue |
| 404 | Not found | Resource doesn't exist |
| 409 | Conflict | Duplicate entry |
| 429 | Too many requests | Rate limited |
| 500 | Server error | Unexpected error |

## Schema References

Usa schemas predefinidos en swagger.js:

```javascript
$ref: '#/components/schemas/User'
$ref: '#/components/schemas/Appointment'
$ref: '#/components/schemas/Error'
```

O define localmente:

```javascript
schema:
  type: object
  properties:
    id:
      type: string
    name:
      type: string
```

## Array Responses

```javascript
responses:
  200:
    description: List of appointments
    content:
      application/json:
        schema:
          type: array
          items:
            $ref: '#/components/schemas/Appointment'
```

## Pagination

```javascript
parameters:
  - in: query
    name: page
    schema:
      type: integer
      default: 1
  - in: query
    name: limit
    schema:
      type: integer
      default: 20
```

## Date/Time Formats

```javascript
date:
  type: string
  format: date           // "2026-05-25"

dateTime:
  type: string
  format: date-time      // "2026-05-25T14:30:00Z"

time:
  type: string
  format: time           // "14:30:00"
```

## File Upload

```javascript
requestBody:
  required: true
  content:
    multipart/form-data:
      schema:
        type: object
        properties:
          file:
            type: string
            format: binary
          description:
            type: string
```

## Examples

### Complete Endpoint Documentation

```javascript
/**
 * @swagger
 * /api/appointments:
 *   post:
 *     summary: Create new appointment
 *     description: Creates a new patient appointment with professional
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *               - startTime
 *               - patientId
 *               - professionalId
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2026-05-25"
 *               startTime:
 *                 type: string
 *                 example: "14:30"
 *               patientId:
 *                 type: string
 *               professionalId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Appointment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   $ref: '#/components/schemas/Appointment'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized - invalid token
 *       409:
 *         description: Conflict - time slot already booked
 */
```

## Accessing Swagger UI

Una vez integrado en server.js:

```
http://localhost:5000/api-docs
```

## Tips

1. **Siempre describe parámetros requeridos** con `required: true`
2. **Incluye ejemplos** con `example: "value"`
3. **Usa descripciones claras** en español para devs locales
4. **Agrupa endpoints relacionados** con el mismo tag
5. **Documenta todos los códigos de error** posibles
6. **Actualiza Swagger cuando cambies endpoints**

## Validación

Puedes validar tu spec OpenAPI en:
https://editor.swagger.io/

Copia todo el content de `/api/swagger.json` y pega en el editor.

## Next Steps

- [ ] Documentar todos los endpoints de auth
- [ ] Documentar endpoints de appointments
- [ ] Documentar endpoints de patients
- [ ] Documentar endpoints de clinical histories
- [ ] Agregar webhooks de WhatsApp
- [ ] Crear guardia (guard) para validar spec

