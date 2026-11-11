import 'express-async-errors';
import express from 'express';
import request from 'supertest';
import createReceiptsRoutes, { createReceiptBodySchema } from '../src/routes/receipts.routes.js';
import { isReceiptDeletable, serializeReceipt } from '../src/controllers/receipts.controller.js';
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

  it('lets the database sequence assign the number (never reused)', async () => {
    const prisma = buildPrisma();

    const response = await request(buildApp(prisma))
      .post('/api/receipts')
      .send({ patientId: 'p1', description: 'x', amount: 10 })
      .expect(201);

    expect(prisma.patientReceipt.create.mock.calls[0][0].data).not.toHaveProperty('number');
    expect(response.body).toMatchObject({ displayNumber: '0001-00000042', canDelete: true });
  });

  it('only the latest receipt, issued today in Argentina, is deletable', () => {
    const now = new Date('2026-11-11T15:00:00Z'); // 12:00 en Argentina
    const today = { number: 10, createdAt: new Date('2026-11-11T04:00:00Z') }; // 01:00 AR del 11
    const yesterdayLate = { number: 10, createdAt: new Date('2026-11-11T02:30:00Z') }; // 23:30 AR del 10

    expect(isReceiptDeletable(today, 10, now)).toBe(true);
    expect(isReceiptDeletable(today, 11, now)).toBe(false);
    expect(isReceiptDeletable(yesterdayLate, 10, now)).toBe(false);
    expect(isReceiptDeletable(today, null, now)).toBe(false);
  });

  it('marks only the deletable receipt in listings', async () => {
    const prisma = buildPrisma();
    prisma.patientReceipt.findMany.mockResolvedValue([
      { id: 'r2', number: 42, amount: '10', createdAt: new Date() },
      { id: 'r1', number: 41, amount: '10', createdAt: new Date() },
    ]);
    prisma.patientReceipt.findFirst.mockResolvedValue({ number: 42 });

    const response = await request(buildApp(prisma)).get('/api/receipts').expect(200);

    expect(response.body.map((item) => item.canDelete)).toEqual([true, false]);
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

  it('deletes the latest same-day receipt and records it in the audit log', async () => {
    const prisma = buildPrisma();
    prisma.patientReceipt.findFirst
      .mockResolvedValueOnce({ id: 'r1', number: 1, patientId: 'p1', amount: '200000', description: '10 sesiones', createdAt: new Date() })
      .mockResolvedValueOnce({ number: 1 });

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

describe('patient receipts deletion rules', () => {
  it('refuses to delete a receipt that is not the latest one', async () => {
    const prisma = buildPrisma();
    prisma.patientReceipt.findFirst
      .mockResolvedValueOnce({ id: 'r1', number: 5, createdAt: new Date() })
      .mockResolvedValueOnce({ number: 6 });

    await request(buildApp(prisma)).delete('/api/receipts/r1').expect(409);
    expect(prisma.patientReceipt.delete).not.toHaveBeenCalled();
  });

  it('refuses to delete the latest receipt once the day it was issued is over', async () => {
    const prisma = buildPrisma();
    prisma.patientReceipt.findFirst
      .mockResolvedValueOnce({ id: 'r1', number: 6, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) })
      .mockResolvedValueOnce({ number: 6 });

    await request(buildApp(prisma)).delete('/api/receipts/r1').expect(409);
    expect(prisma.patientReceipt.delete).not.toHaveBeenCalled();
  });
});
