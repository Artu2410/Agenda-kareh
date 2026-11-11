import 'express-async-errors';
import express from 'express';
import request from 'supertest';
import createPatientRoutes from '../src/routes/patient.routes.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';

const PATIENT_ID = 'cmpatient000000000000001';

const buildPrisma = (current = { id: PATIENT_ID, actaBookRecordedAt: null, actaBookFolio: null }) => ({
  patient: {
    findFirst: jest.fn().mockResolvedValue(current),
    update: jest.fn(async ({ data }) => ({ id: PATIENT_ID, ...data })),
  },
  auditLog: { create: jest.fn().mockResolvedValue({}) },
});

const buildApp = (prisma) => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { userId: 'u1', role: 'SECRETARIA' }; req.headers['user-agent'] = 'jest'; next(); });
  app.use('/api/patients', createPatientRoutes(prisma));
  app.use(errorHandler);
  return app;
};

describe('libro de actas', () => {
  it('marca al paciente como pasado al libro con folio', async () => {
    const prisma = buildPrisma();

    const response = await request(buildApp(prisma))
      .patch(`/api/patients/${PATIENT_ID}/acta-book`)
      .send({ recorded: true, folio: ' 12 ' })
      .expect(200);

    const { data } = prisma.patient.update.mock.calls[0][0];
    expect(data.actaBookRecordedAt).toBeInstanceOf(Date);
    expect(data.actaBookFolio).toBe('12');
    expect(data).not.toHaveProperty('actaBookRecordedById');
    expect(response.body.actaBookFolio).toBe('12');
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('conserva la fecha original al corregir el folio', async () => {
    const originalDate = new Date('2026-10-01T12:00:00Z');
    const prisma = buildPrisma({ id: PATIENT_ID, actaBookRecordedAt: originalDate, actaBookFolio: '3' });

    await request(buildApp(prisma))
      .patch(`/api/patients/${PATIENT_ID}/acta-book`)
      .send({ recorded: true, folio: '4' })
      .expect(200);

    expect(prisma.patient.update.mock.calls[0][0].data.actaBookRecordedAt).toBe(originalDate);
  });

  it('desmarca y limpia folio y fecha', async () => {
    const prisma = buildPrisma({ id: PATIENT_ID, actaBookRecordedAt: new Date(), actaBookFolio: '3' });

    await request(buildApp(prisma))
      .patch(`/api/patients/${PATIENT_ID}/acta-book`)
      .send({ recorded: false })
      .expect(200);

    expect(prisma.patient.update.mock.calls[0][0].data).toEqual({
      actaBookRecordedAt: null,
      actaBookFolio: null,
    });
  });

  it('rechaza pedidos sin el estado y pacientes fuera de alcance', async () => {
    await request(buildApp(buildPrisma()))
      .patch(`/api/patients/${PATIENT_ID}/acta-book`)
      .send({ folio: '1' })
      .expect(400);

    const prisma = buildPrisma(null);
    await request(buildApp(prisma))
      .patch(`/api/patients/${PATIENT_ID}/acta-book`)
      .send({ recorded: true })
      .expect(404);
    expect(prisma.patient.update).not.toHaveBeenCalled();
  });
});
