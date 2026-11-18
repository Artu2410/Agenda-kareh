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
    findUnique: jest.fn().mockResolvedValue({ id: 'rep1', patientId: 'p1', professionalId: 'prOriginal', type: 'fkt', title: 'Informe Kinésico', data: reportData, professional: null }),
    update: jest.fn(async ({ where, data }) => ({
      id: where.id,
      patientId: 'p1',
      createdAt: new Date('2026-11-11T12:00:00Z'),
      professional: { fullName: 'Lic. Romero' },
      ...data,
    })),
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

  it('edits a saved report and keeps its patient', async () => {
    const prisma = buildPrisma();
    const { patientId: _ignored, ...body } = validBody;
    const editedData = { ...reportData, diagnosis: 'Lumbalgia crónica' };

    const response = await request(buildApp(prisma))
      .put('/api/reports/rep1')
      .send({ ...body, patientId: 'otro', data: editedData })
      .expect(200);

    const { where, data } = prisma.patientReport.update.mock.calls[0][0];
    expect(where).toEqual({ id: 'rep1' });
    expect(data).toMatchObject({ professionalId: 'pr1', type: 'fkt', data: editedData });
    expect(data.patientId).toBeUndefined();
    expect(response.body.data.diagnosis).toBe('Lumbalgia crónica');
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('keeps the signing professional when the edit does not send one', async () => {
    const prisma = buildPrisma();
    const { patientId: _p, professionalId: _pr, ...body } = validBody;

    await request(buildApp(prisma)).put('/api/reports/rep1').send(body).expect(200);

    expect(prisma.patientReport.update.mock.calls[0][0].data.professionalId).toBe('prOriginal');
  });

  it('does not edit reports whose patient is out of scope', async () => {
    const prisma = buildPrisma();
    prisma.patient.findFirst.mockResolvedValue(null);

    await request(buildApp(prisma)).put('/api/reports/rep1').send(validBody).expect(404);
    expect(prisma.patientReport.update).not.toHaveBeenCalled();
  });

  it('corrects the spelling of the report texts', async () => {
    const correctSpelling = jest.fn().mockResolvedValue({ anamnesis: 'Dolor lumbar desde hace tres meses.' });
    const app = express();
    app.use(express.json());
    app.use('/api/reports', createReportsRoutes(buildPrisma(), { correctSpelling }));
    app.use(errorHandler);

    const response = await request(app)
      .post('/api/reports/spellcheck')
      .send({ texts: { anamnesis: 'dolor lumbar dsde hace tres mese' } })
      .expect(200);

    expect(correctSpelling).toHaveBeenCalledWith({ anamnesis: 'dolor lumbar dsde hace tres mese' });
    expect(response.body.texts.anamnesis).toBe('Dolor lumbar desde hace tres meses.');
  });

  it('explains when spelling correction is not configured', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/reports', createReportsRoutes(buildPrisma(), { correctSpelling: jest.fn().mockResolvedValue(null) }));
    app.use(errorHandler);

    await request(app).post('/api/reports/spellcheck').send({ texts: { a: 'hola' } }).expect(503);
  });
});
