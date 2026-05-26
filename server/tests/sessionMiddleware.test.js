import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import {
  sessionValidationMiddleware,
} from '../src/middlewares/sessionMiddleware.js';

const createApp = () => {
  const app = express();
  app.use(cookieParser());
  app.use((req, res, next) => {
    req.logger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    next();
  });
  app.use(sessionValidationMiddleware);
  app.get('/public', (req, res) => {
    res.json({
      ok: true,
      userId: req.user?.userId || null,
      role: req.user?.role || null,
    });
  });
  return app;
};

describe('sessionValidationMiddleware', () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = '12345678901234567890123456789012';
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it('permite rutas públicas sin token', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/public')
      .expect(200);

    expect(response.body).toEqual({
      ok: true,
      userId: null,
      role: null,
    });
  });

  it('adjunta contexto desde accessToken cookie con claims actuales', async () => {
    const app = createApp();
    const token = jwt.sign(
      {
        sub: 'user-123',
        email: 'admin@kareh.com',
        role: 'ADMIN',
        sid: 'session-123',
        type: 'access',
      },
      process.env.JWT_SECRET,
      { jwtid: 'jti-123', expiresIn: '15m' }
    );

    const response = await request(app)
      .get('/public')
      .set('Cookie', [`accessToken=${token}`])
      .expect(200);

    expect(response.body).toEqual({
      ok: true,
      userId: 'user-123',
      role: 'ADMIN',
    });
  });

  it('ignora tokens inválidos en rutas públicas en lugar de bloquear la request', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/public')
      .set('Cookie', ['accessToken=token-invalido'])
      .expect(200);

    expect(response.body).toEqual({
      ok: true,
      userId: null,
      role: null,
    });
  });
});
