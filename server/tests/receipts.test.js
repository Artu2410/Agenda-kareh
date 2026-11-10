import 'express-async-errors';
import express from 'express';
import request from 'supertest';
import createReceiptsRoutes, { createReceiptBodySchema } from '../src/routes/receipts.routes.js';
import { serializeReceipt } from '../src/controllers/receipts.controller.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';

const patient = {
  id: 'p1',
  fullName: 'Pérez, Ana',
  dni: '30111222',
  healthInsurance: 'OSDE',
  treatAsParticular: false,
  affiliateNumber: '123-45',
  obraSocial: { nombreOs: 'OSDE 210' },
  appointments: [
    { diagnosis: '', professionalId: 'pr1' },
    { diagnosis: 'Lumbalgia', professionalId: 'pr1' },
  ],
};

const buildPrisma = () => ({
  patient: { findFirst: jest.fn().mockResolvedValue(patient) },
  professional: {
    findUnique: jest.fn().mockResolvedValue({ id: 'pr1', fullName: 'Lic. Romero', licenseNumber: '18900', licenseNumberMP: '10318' }),
  },
  patientReceipt: {
    create: jest.fn(async ({ data }) => ({ id: 'r1', number: 42, issueDate: new Date('2026-11-10T12:00:00Z'), createdAt: new Date(), ...data })),
    findMany: jest.fn().mockResolvedValue([]),
  },
  auditLog: { create: jest.fn().mockResolvedValue({}) },
});

const buildApp = (prisma, user = { userId: 'u1', role: 'SECRETARIA' }) => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = user; req.headers['user-agent'] = 'jest'; next(); });
  app.use('/api/receipts', createReceiptsRoutes(prisma));
  app.use(errorHandler);
  return app;
};

describe('patient receipts', () => {
  it('fills patient, coverage, diagnosis and professional automatically', async () => {
    const prisma = buildPrisma();

    const response = await request(buildApp(prisma))
      .post('/api/receipts')
      .send({ patientId: 'p1', description: 'Sesiones de kinesiología', amount: '15000.505' })
      .expect(201);

    const { data } = prisma.patientReceipt.create.mock.calls[0][0];
    expect(data).toMatchObject({
      patientName: 'Pérez, Ana',
      patientDni: '30111222',
      coverage: 'OSDE 210',
      affiliateNumber: '123-45',
      diagnosis: 'Lumbalgia',
      professionalId: 'pr1',
      professionalLicense: 'MN 18900 / MP 10318',
      amount: 15000.51,
      createdById: 'u1',
    });
    expect(response.body.displayNumber).toBe('0001-00000042');
  });

  it('only accepts a description and a positive amount as manual input', () => {
    expect(createReceiptBodySchema.safeParse({ patientId: 'p1', description: '', amount: 10 }).success).toBe(false);
    expect(createReceiptBodySchema.safeParse({ patientId: 'p1', description: 'x', amount: 0 }).success).toBe(false);
    const parsed = createReceiptBodySchema.parse({ patientId: 'p1', description: 'x', amount: 10, patientName: 'Otro' });
    expect(parsed.patientName).toBeUndefined();
  });

  it('returns 404 when the patient does not exist or is out of scope', async () => {
    const prisma = buildPrisma();
    prisma.patient.findFirst.mockResolvedValue(null);

    await request(buildApp(prisma))
      .post('/api/receipts')
      .send({ patientId: 'nope', description: 'x', amount: 10 })
      .expect(404);
    expect(prisma.patientReceipt.create).not.toHaveBeenCalled();
  });

  it('serializes amounts and the receipt number for printing', () => {
    expect(serializeReceipt({ number: 7, amount: '1200.50' })).toMatchObject({ amount: 1200.5, displayNumber: '0001-00000007' });
  });
});
