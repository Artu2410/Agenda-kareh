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
    create: jest.fn(async ({ data }) => ({ id: 'r1', issueDate: new Date('2026-11-10T12:00:00Z'), createdAt: new Date(), ...data })),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue({ number: 41 }),
    delete: jest.fn().mockResolvedValue({}),
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

  it('numbers as last + 1 so deleting the latest receipt frees its number', async () => {
    const prisma = buildPrisma();
    prisma.patientReceipt.findFirst.mockResolvedValue(null);

    const response = await request(buildApp(prisma))
      .post('/api/receipts')
      .send({ patientId: 'p1', description: 'x', amount: 10 })
      .expect(201);

    expect(prisma.patientReceipt.create.mock.calls[0][0].data.number).toBe(1);
    expect(response.body.displayNumber).toBe('0001-00000001');
  });

  it('retries with the next number when two receipts collide', async () => {
    const prisma = buildPrisma();
    prisma.patientReceipt.findFirst
      .mockResolvedValueOnce({ number: 5 })
      .mockResolvedValueOnce({ number: 6 });
    prisma.patientReceipt.create
      .mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }));

    await request(buildApp(prisma))
      .post('/api/receipts')
      .send({ patientId: 'p1', description: 'x', amount: 10 })
      .expect(201);

    expect(prisma.patientReceipt.create).toHaveBeenCalledTimes(2);
    expect(prisma.patientReceipt.create.mock.calls[1][0].data.number).toBe(7);
  });

  it('uses the chosen issue date at midday UTC, or today when omitted', async () => {
    const prisma = buildPrisma();

    await request(buildApp(prisma))
      .post('/api/receipts')
      .send({ patientId: 'p1', description: 'x', amount: 10, issueDate: '2026-10-31' })
      .expect(201);
    expect(prisma.patientReceipt.create.mock.calls[0][0].data.issueDate.toISOString()).toBe('2026-10-31T12:00:00.000Z');

    await request(buildApp(prisma))
      .post('/api/receipts')
      .send({ patientId: 'p1', description: 'x', amount: 10 })
      .expect(201);
    expect(prisma.patientReceipt.create.mock.calls[1][0].data.issueDate).toBeInstanceOf(Date);
  });

  it('rejects impossible issue dates', () => {
    const base = { patientId: 'p1', description: 'x', amount: 10 };
    expect(createReceiptBodySchema.safeParse({ ...base, issueDate: '2026-02-31' }).success).toBe(false);
    expect(createReceiptBodySchema.safeParse({ ...base, issueDate: '31/10/2026' }).success).toBe(false);
    expect(createReceiptBodySchema.safeParse({ ...base, issueDate: '2026-02-28' }).success).toBe(true);
  });

  it('rejects typo dates far in the past or future', () => {
    const base = { patientId: 'p1', description: 'x', amount: 10 };
    const nextYear = new Date().getUTCFullYear() + 2;
    expect(createReceiptBodySchema.safeParse({ ...base, issueDate: '0202-05-10' }).success).toBe(false);
    expect(createReceiptBodySchema.safeParse({ ...base, issueDate: `${nextYear}-05-10` }).success).toBe(false);
    expect(createReceiptBodySchema.safeParse({ ...base, issueDate: '2001-05-10' }).success).toBe(true);
  });

  it('deletes a receipt and records it in the audit log', async () => {
    const prisma = buildPrisma();
    prisma.patientReceipt.findFirst.mockResolvedValue({ id: 'r1', number: 1, patientId: 'p1', amount: '200000', description: '10 sesiones' });

    await request(buildApp(prisma)).delete('/api/receipts/r1').expect(204);

    expect(prisma.patientReceipt.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('returns 404 when deleting a missing or out-of-scope receipt', async () => {
    const prisma = buildPrisma();
    prisma.patientReceipt.findFirst.mockResolvedValue(null);

    await request(buildApp(prisma)).delete('/api/receipts/nope').expect(404);
    expect(prisma.patientReceipt.delete).not.toHaveBeenCalled();
  });
});
