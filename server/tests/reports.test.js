import 'express-async-errors';
import express from 'express';
import request from 'supertest';
import createReportsRoutes, { createReportBodySchema } from '../src/routes/reports.routes.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';

const reportData = {
  title: 'Informe Kinésico',
  patient: { fullName: 'Pérez, Ana', dni: '30.111.222' },
  diagnosis: 'Lumbalgia',
  techniques: [{ name: 'Fisioterapia', detail: 'TENS' }],
};

const buildPrisma = () => ({
  patient: { findFirst: jest.fn().mockResolvedValue({ id: 'p1' }) },
  patientReport: {
    create: jest.fn(async ({ data }) => ({
      id: 'rep1',
      createdAt: new Date('2026-11-11T12:00:00Z'),
      professional: { fullName: 'Lic. Romero' },
      ...data,
    })),
    findMany: jest.fn().mockResolvedValue([
      { id: 'rep1', patientId: 'p1', type: 'fkt', title: 'Informe Kinésico', reportDate: new Date('2026-11-10T00:00:00Z'), professional: { fullName: 'Lic. Romero' } },
    ]),
    findUnique: jest.fn().mockResolvedValue({ id: 'rep1', patientId: 'p1', type: 'fkt', title: 'Informe Kinésico', data: reportData, professional: null }),
  },
  auditLog: { create: jest.fn().mockResolvedValue({}) },
});

const buildApp = (prisma, user = { userId: 'u1', role: 'SECRETARIA' }) => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = user; req.headers['user-agent'] = 'jest'; next(); });
  app.use('/api/reports', createReportsRoutes(prisma));
  app.use(errorHandler);
  return app;
};

const validBody = {
  patientId: 'p1',
  professionalId: 'pr1',
  type: 'fkt',
  title: 'Informe Kinésico',
  reportDate: '2026-11-10',
  data: reportData,
};

describe('patient reports', () => {
  it('saves the full report snapshot linked to the patient', async () => {
    const prisma = buildPrisma();

    const response = await request(buildApp(prisma)).post('/api/reports').send(validBody).expect(201);

    const { data } = prisma.patientReport.create.mock.calls[0][0];
    expect(data).toMatchObject({
      patientId: 'p1',
      professionalId: 'pr1',
      type: 'fkt',
      title: 'Informe Kinésico',
      data: reportData,
      createdById: 'u1',
    });
    expect(data.reportDate).toBeInstanceOf(Date);
    expect(response.body.professionalName).toBe('Lic. Romero');
    expect(response.body.professional).toBeUndefined();
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('rejects reports for patients that do not exist or are out of scope', async () => {
    const prisma = buildPrisma();
    prisma.patient.findFirst.mockResolvedValue(null);

    await request(buildApp(prisma)).post('/api/reports').send(validBody).expect(404);
    expect(prisma.patientReport.create).not.toHaveBeenCalled();
  });

  it('validates the required fields', () => {
    expect(createReportBodySchema.safeParse({ ...validBody, type: '' }).success).toBe(false);
    expect(createReportBodySchema.safeParse({ ...validBody, reportDate: 'no-date' }).success).toBe(false);
    expect(createReportBodySchema.safeParse({ ...validBody, data: 'texto' }).success).toBe(false);
    expect(createReportBodySchema.safeParse({ ...validBody, data: { big: 'x'.repeat(100_001) } }).success).toBe(false);
  });

  it('lists the reports of one patient, newest first, ready to reprint', async () => {
    const prisma = buildPrisma();

    const response = await request(buildApp(prisma)).get('/api/reports?patientId=p1').expect(200);

    const query = prisma.patientReport.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ patientId: 'p1' });
    expect(query.orderBy[0]).toEqual({ reportDate: 'desc' });
    expect(query.select.data).toBe(true);
    expect(response.body[0]).toMatchObject({ id: 'rep1', professionalName: 'Lic. Romero' });
  });

  it('requires a patient to list reports', async () => {
    await request(buildApp(buildPrisma())).get('/api/reports').expect(400);
  });

  it('returns the full report for reprinting', async () => {
    const response = await request(buildApp(buildPrisma())).get('/api/reports/rep1').expect(200);
    expect(response.body.data).toEqual(reportData);
  });

  it('hides reports whose patient is out of scope', async () => {
    const prisma = buildPrisma();
    prisma.patient.findFirst.mockResolvedValue(null);

    await request(buildApp(prisma)).get('/api/reports/rep1').expect(404);
  });
});
