import express from 'express';
import request from 'supertest';
import { updateUser, updateUserRole } from '../src/controllers/users.controller.js';
import createClinicalHistoryRoutes from '../src/routes/clinicalHistory.routes.js';

const createResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const userRecord = (overrides = {}) => ({
  id: 'katia',
  email: 'katia@example.com',
  fullName: 'Katia',
  role: 'PROFESSIONAL',
  professionalId: 'prof-1',
  isActive: true,
  professional: { fullName: 'Katia' },
  ...overrides,
});

const prismaWith = (record) => ({
  user: {
    findUnique: jest.fn().mockResolvedValue(record),
    update: jest.fn(async ({ data }) => ({ ...record, ...data })),
  },
  auditLog: { create: jest.fn() },
});

describe('usuarios y roles', () => {
  it('activar/desactivar un PROFESSIONAL vinculado no exige reenviar el profesional', async () => {
    const prisma = prismaWith(userRecord());
    const res = createResponse();
    await updateUser({ params: { id: 'katia' }, body: { isActive: false }, user: { userId: 'admin', role: 'ADMIN' } }, res, prisma);

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ isActive: false }),
    }));
  });

  it('nadie puede desactivarse a sí mismo', async () => {
    const prisma = prismaWith(userRecord({ id: 'super', role: 'SUPER_USER', professionalId: null }));
    const res = createResponse();
    await updateUser({ params: { id: 'super' }, body: { isActive: false }, user: { userId: 'super', role: 'SUPER_USER' } }, res, prisma);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('al pasar de PROFESSIONAL a SECRETARIA se quita el vínculo profesional', async () => {
    const prisma = prismaWith(userRecord());
    const res = createResponse();
    await updateUserRole({ params: { id: 'katia' }, body: { role: 'SECRETARIA', professionalId: 'prof-1' }, user: { userId: 'admin', role: 'ADMIN' } }, res, prisma);

    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { role: 'SECRETARIA', professionalId: null },
    }));
  });

  it('un ADMIN no puede ascender a nadie a ADMIN', async () => {
    const prisma = prismaWith(userRecord({ role: 'SECRETARIA', professionalId: null }));
    const res = createResponse();
    await expect(updateUserRole({ params: { id: 'katia' }, body: { role: 'ADMIN' }, user: { userId: 'admin', role: 'ADMIN' } }, res, prisma))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('historias clínicas', () => {
  const appFor = (role) => {
    const app = express();
    app.use((req, res, next) => { req.user = { userId: 'u', role, professionalId: 'prof-1' }; next(); });
    app.use('/clinical-history', createClinicalHistoryRoutes({
      clinicalHistory: { findMany: jest.fn().mockResolvedValue([]) },
    }));
    return app;
  };

  it('SECRETARIA no accede por API', async () => {
    const response = await request(appFor('SECRETARIA')).get('/clinical-history/p1');
    expect(response.status).toBe(403);
  });

  it('PROFESSIONAL sí accede', async () => {
    const response = await request(appFor('PROFESSIONAL')).get('/clinical-history/p1');
    expect(response.status).not.toBe(403);
  });
});
