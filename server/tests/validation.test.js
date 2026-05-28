import express from 'express';
import request from 'supertest';
import { validate } from '../src/middlewares/validate.js';
import { requestOtpBodySchema } from '../src/validations/authSchemas.js';
import { createPatientBodySchema, patientIdParamsSchema, updatePatientBodySchema } from '../src/validations/patientSchemas.js';
import {
  appointmentIdParamsSchema,
  appointmentWeekQuerySchema,
  createAppointmentBodySchema,
  updateAppointmentEvolutionBodySchema,
} from '../src/validations/appointmentSchemas.js';
import { createCashflowBodySchema } from '../src/validations/cashflowSchemas.js';

const createValidationApp = ({ method = 'post', path = '/', schema }) => {
  const app = express();
  app.use(express.json());
  app[method](path, validate(schema), (req, res) => {
    res.json({
      success: true,
      body: req.body,
      params: req.params,
      query: req.query,
    });
  });
  return app;
};

describe('centralized zod validation middleware', () => {
  it('returns normalized auth validation errors', async () => {
    const app = createValidationApp({
      schema: { body: requestOtpBodySchema },
    });

    const response = await request(app)
      .post('/')
      .send({ email: 'invalid-email' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'body.email',
          message: 'Email inválido',
        }),
      ]),
    );
  });

  it('accepts valid auth payloads and strips unknown fields', async () => {
    const app = createValidationApp({
      schema: { body: requestOtpBodySchema },
    });

    const response = await request(app)
      .post('/')
      .send({ email: 'TEST@MAIL.COM ', ignored: 'value' })
      .expect(200);

    expect(response.body.body).toEqual({ email: 'test@mail.com' });
  });

  it('rejects invalid patient create payloads', async () => {
    const app = createValidationApp({
      schema: { body: createPatientBodySchema },
    });

    const response = await request(app)
      .post('/')
      .send({ fullName: '', dni: 123 })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'body.fullName' }),
        expect.objectContaining({ path: 'body.dni' }),
      ]),
    );
  });

  it('accepts valid patient updates with params and partial body', async () => {
    const app = createValidationApp({
      path: '/patients/:id',
      schema: { params: patientIdParamsSchema, body: updatePatientBodySchema },
    });

    const response = await request(app)
      .post('/patients/c1234567890')
      .send({ phone: '+54 9 11 2345-6789', medicalNotes: 'Seguimiento' })
      .expect(200);

    expect(response.body.params).toEqual({ id: 'c1234567890' });
    expect(response.body.body).toEqual({
      phone: '+54 9 11 2345-6789',
      medicalNotes: 'Seguimiento',
    });
  });

  it('rejects invalid appointment create payloads', async () => {
    const app = createValidationApp({
      schema: { body: createAppointmentBodySchema },
    });

    const response = await request(app)
      .post('/')
      .send({
        date: '2026-13-40',
        time: '99:99',
        sessionCount: 'abc',
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'body.date' }),
        expect.objectContaining({ path: 'body.time' }),
        expect.objectContaining({ path: 'body.sessionCount' }),
      ]),
    );
  });

  it('requires patient reference when creating appointments', async () => {
    const app = createValidationApp({
      schema: { body: createAppointmentBodySchema },
    });

    const response = await request(app)
      .post('/')
      .send({
        date: '2026-05-10',
        time: '10:30',
        sessionCount: 3,
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'body.patientId', message: 'Debes enviar patientId o patientData' }),
      ]),
    );
  });

  it('accepts valid appointment availability queries', async () => {
    const app = createValidationApp({
      method: 'get',
      schema: { query: appointmentWeekQuerySchema },
    });

    const response = await request(app)
      .get('/?startDate=2026-05-01&endDate=2026-05-07&professionalId=c1234567890')
      .expect(200);

    expect(response.body.query).toEqual({
      startDate: '2026-05-01',
      endDate: '2026-05-07',
      professionalId: 'c1234567890',
    });
  });

  it('accepts evolution payloads with empty optional insurance fields', async () => {
    const app = createValidationApp({
      method: 'patch',
      path: '/appointments/:id/evolution',
      schema: { params: appointmentIdParamsSchema, body: updateAppointmentEvolutionBodySchema },
    });

    const response = await request(app)
      .patch('/appointments/c1234567890/evolution')
      .send({
        diagnosis: 'Control',
        status: 'COMPLETED',
        patientData: {
          healthInsurance: 'OSDE',
          obraSocialId: '',
          treatAsParticular: false,
          affiliateNumber: '',
          birthDate: '',
          hasCancer: false,
          hasMarcapasos: false,
          usesEA: false,
          usesWheelchair: false,
          isRespiratory: false,
          isIU: false,
        },
        documentsChecklist: { documents: [], additionalInfo: '' },
        authorizationNumber: '',
        authorizationFileUrl: '',
        paidInAdvance: false,
        sessionToken: '',
        evolution: 'Seguimiento',
        isFirstSession: false,
      })
      .expect(200);

    expect(response.body.params).toEqual({ id: 'c1234567890' });
    expect(response.body.body.patientData).toEqual({
      healthInsurance: 'OSDE',
      treatAsParticular: false,
      hasCancer: false,
      hasMarcapasos: false,
      usesEA: false,
      usesWheelchair: false,
      isRespiratory: false,
      isIU: false,
    });
    expect(response.body.body.sessionToken).toBeUndefined();
    expect(response.body.body.authorizationNumber).toBeUndefined();
    expect(response.body.body.authorizationFileUrl).toBeUndefined();
  });

  it('preserves valid session tokens in evolution payloads', async () => {
    const app = createValidationApp({
      method: 'patch',
      path: '/appointments/:id/evolution',
      schema: { params: appointmentIdParamsSchema, body: updateAppointmentEvolutionBodySchema },
    });

    const response = await request(app)
      .patch('/appointments/c1234567890/evolution')
      .send({
        diagnosis: 'Control',
        status: 'COMPLETED',
        patientData: {
          healthInsurance: 'OSDE',
          obraSocialId: 'c1234567890',
          treatAsParticular: false,
          affiliateNumber: '12345',
          hasCancer: false,
          hasMarcapasos: false,
          usesEA: false,
          usesWheelchair: false,
          isRespiratory: false,
          isIU: false,
        },
        documentsChecklist: { documents: [], additionalInfo: '' },
        authorizationNumber: 'AUTH-42',
        authorizationFileUrl: 'https://example.com/auth.pdf',
        paidInAdvance: false,
        sessionToken: 'TOKEN-123',
        evolution: 'Seguimiento',
        isFirstSession: false,
      })
      .expect(200);

    expect(response.body.body.sessionToken).toBe('TOKEN-123');
    expect(response.body.body.authorizationNumber).toBe('AUTH-42');
    expect(response.body.body.authorizationFileUrl).toBe('https://example.com/auth.pdf');
  });

  it('accepts long document names in evolution payloads', async () => {
    const app = createValidationApp({
      method: 'patch',
      path: '/appointments/:id/evolution',
      schema: { params: appointmentIdParamsSchema, body: updateAppointmentEvolutionBodySchema },
    });

    const longDocumentName = 'Documento requerido por obra social con nombre extenso '.padEnd(200, 'x');

    const response = await request(app)
      .patch('/appointments/c1234567890/evolution')
      .send({
        diagnosis: 'Control',
        status: 'COMPLETED',
        patientData: {
          healthInsurance: 'OSDE',
          obraSocialId: 'c1234567890',
          treatAsParticular: false,
          affiliateNumber: '12345',
          hasCancer: false,
          hasMarcapasos: false,
          usesEA: false,
          usesWheelchair: false,
          isRespiratory: false,
          isIU: false,
        },
        documentsChecklist: {
          documents: [
            { name: longDocumentName },
          ],
          additionalInfo: '',
        },
        authorizationNumber: 'AUTH-42',
        authorizationFileUrl: 'https://example.com/auth.pdf',
        paidInAdvance: false,
        sessionToken: 'TOKEN-123',
        evolution: 'Seguimiento',
        isFirstSession: false,
      })
      .expect(200);

    expect(response.body.body.documentsChecklist.documents[0].name).toBe(longDocumentName);
  });

  it('rejects invalid cashflow payloads', async () => {
    const app = createValidationApp({
      schema: { body: createCashflowBodySchema },
    });

    const response = await request(app)
      .post('/')
      .send({
        type: 'INVALID',
        amount: 0,
        concept: '',
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'body.type' }),
        expect.objectContaining({ path: 'body.amount' }),
        expect.objectContaining({ path: 'body.concept' }),
      ]),
    );
  });

  it('accepts valid transfer cashflow payloads', async () => {
    const app = createValidationApp({
      schema: { body: createCashflowBodySchema },
    });

    const response = await request(app)
      .post('/')
      .send({
        type: 'TRANSFER',
        amount: 15000,
        concept: 'Traspaso interno',
        account: 'CASH',
        destinationAccount: 'MERCADO_PAGO',
        date: '2026-05-20',
      })
      .expect(200);

    expect(response.body.body).toEqual({
      type: 'TRANSFER',
      amount: 15000,
      concept: 'Traspaso interno',
      account: 'CASH',
      destinationAccount: 'MERCADO_PAGO',
      date: '2026-05-20',
    });
  });
});
