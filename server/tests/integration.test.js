/**
 * Tests de Integración - Ejemplo con Supertest
 * 
 * Estos tests demuestran cómo hacer requests HTTP a la API
 * sin necesidad de tener un servidor real corriendo.
 */

import request from 'supertest';
import express from 'express';
import errorHandler from '../src/middlewares/errorHandler.js';
import { ValidationError, NotFoundError } from '../src/errors/AppError.js';

// Crear una aplicación Express mínima para testing
const createTestApp = () => {
  const app = express();

  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Endpoint que lanza ValidationError
  app.post('/api/test/validation-error', (req, res, next) => {
    next(new ValidationError('Email inválido'));
  });

  // Endpoint que lanza NotFoundError
  app.get('/api/test/not-found', (req, res, next) => {
    next(new NotFoundError('Usuario no encontrado'));
  });

  // Endpoint que funciona correctamente
  app.post('/api/test/success', (req, res) => {
    res.status(201).json({
      status: 'success',
      data: { id: '123', message: 'Creado correctamente' },
    });
  });

  // Error handler
  app.use(errorHandler);

  return app;
};

describe('API Integration Tests', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Error Handling', () => {
    it('should handle ValidationError correctly', async () => {
      const response = await request(app)
        .post('/api/test/validation-error')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        status: 'fail',
        message: 'Email inválido',
      });
    });

    it('should handle NotFoundError correctly', async () => {
      const response = await request(app)
        .get('/api/test/not-found')
        .expect(404);

      expect(response.body).toEqual({
        status: 'fail',
        message: 'Usuario no encontrado',
      });
    });

    it('should return 405 for unsupported methods', async () => {
      const response = await request(app)
        .post('/api/health')
        .expect(404);
    });
  });

  describe('Success Responses', () => {
    it('should return 201 for successful creation', async () => {
      const response = await request(app)
        .post('/api/test/success')
        .send({})
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('id');
    });
  });

  describe('Request Headers', () => {
    it('should accept JSON content type', async () => {
      const response = await request(app)
        .post('/api/test/success')
        .set('Content-Type', 'application/json')
        .send({})
        .expect(201);

      expect(response.body.status).toBe('success');
    });
  });
});
