import express from 'express';
import request from 'supertest';
import { validate } from '../src/middlewares/validate.js';
import {
  addPaymentBodySchema,
  createClinicalHistoryBodySchema,
  createInvoiceBodySchema,
  createProfessionalBodySchema,
  createUserBodySchema,
  updateProfessionalBodySchema,
  updateUserBodySchema,
  workScheduleBodySchema,
} from '../src/validations/adminSchemas.js';

const isValid = (schema, value) => schema.safeParse(value).success;

describe('admin validation schemas', () => {
  it('validates users without dropping unknown fields', () => {
    expect(isValid(createUserBodySchema, { email: 'ana@kareh.com', fullName: 'Ana', role: 'ADMIN' })).toBe(true);
    expect(isValid(createUserBodySchema, { email: 'no-es-email', fullName: 'Ana' })).toBe(false);
    expect(isValid(updateUserBodySchema, { isActive: 'false' })).toBe(false);
    expect(updateUserBodySchema.parse({ isActive: true, extra: 1 })).toEqual({ isActive: true, extra: 1 });
  });

  it('keeps empty strings and nulls so the UI can clear professional fields', () => {
    expect(updateProfessionalBodySchema.parse({ phone: '', birthDate: null })).toEqual({ phone: '', birthDate: null });
    expect(isValid(createProfessionalBodySchema, { fullName: 'Juan', licenseNumber: '' })).toBe(false);
    expect(isValid(updateProfessionalBodySchema, { birthDate: '2026-02-31x' })).toBe(false);
  });

  it('requires a coherent work schedule list', () => {
    expect(isValid(workScheduleBodySchema, { schedules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '18:00' }] })).toBe(true);
    expect(isValid(workScheduleBodySchema, {})).toBe(false);
    expect(isValid(workScheduleBodySchema, { schedules: [{ dayOfWeek: 1, startTime: '18:00', endTime: '09:00' }] })).toBe(false);
    expect(isValid(workScheduleBodySchema, { schedules: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
      { dayOfWeek: 1, startTime: '13:00', endTime: '18:00' },
    ] })).toBe(false);
  });

  it('rejects impossible clinical history dates and accepts attachments as array or string', () => {
    expect(isValid(createClinicalHistoryBodySchema, { patientId: 'p1', createdAt: 'no-es-fecha' })).toBe(false);
    expect(isValid(createClinicalHistoryBodySchema, { patientId: 'p1', attachments: [{ url: '/uploads/a.png' }] })).toBe(true);
    expect(isValid(createClinicalHistoryBodySchema, { patientId: 'p1', attachments: '[]' })).toBe(true);
    expect(isValid(createClinicalHistoryBodySchema, { evolution: 'sin paciente' })).toBe(false);
  });

  it('rejects billing payloads with objects where ids or amounts go', () => {
    expect(isValid(createInvoiceBodySchema, { obraSocialId: { id: 'x' } })).toBe(false);
    expect(isValid(createInvoiceBodySchema, { totalAmount: '1500.50', items: [{ quantity: 2, unitAmount: 100 }] })).toBe(true);
    expect(isValid(addPaymentBodySchema, {})).toBe(false);
    expect(isValid(addPaymentBodySchema, { amount: 1000 })).toBe(true);
  });

  it('returns 400 through the validate middleware before reaching the controller', async () => {
    const app = express();
    app.use(express.json());
    const handler = jest.fn((req, res) => res.json({ ok: true }));
    app.post('/schedule', validate({ body: workScheduleBodySchema }), handler);

    const response = await request(app).post('/schedule').send({ schedules: 'lunes' });

    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });
});
