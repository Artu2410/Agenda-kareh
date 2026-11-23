import 'express-async-errors';
import express from 'express';
import request from 'supertest';
import { getWeekAppointments, getAppointmentBatch } from '../src/controllers/AppointmentController.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';

// Regresión: el refactor del servicio de reservas dejó APPOINTMENT_ORDER sin importar
// y /appointments/week respondía 500 en producción.
const buildApp = (prisma) => {
  const app = express();
  app.use((req, res, next) => { req.user = { userId: 'u1', role: 'ADMIN' }; next(); });
  app.get('/week', (req, res) => getWeekAppointments(req, res, prisma));
  app.get('/:id/batch', (req, res) => getAppointmentBatch(req, res, prisma));
  app.use(errorHandler);
  return app;
};

describe('lecturas de agenda', () => {
  it('GET /week devuelve los turnos ordenados', async () => {
    const prisma = { appointment: { findMany: jest.fn().mockResolvedValue([{ id: 'a1' }]) } };
    const res = await request(buildApp(prisma)).get('/week?startDate=2026-11-23&endDate=2026-11-29');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'a1' }]);
    expect(prisma.appointment.findMany.mock.calls[0][0].orderBy).toEqual([
      { date: 'asc' }, { time: 'asc' }, { slotNumber: 'asc' },
    ]);
  });

  it('GET /:id/batch no falla', async () => {
    const prisma = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue({ id: 'a1', patientId: 'p1', professionalId: 'pr1' }),
        findFirst: jest.fn().mockResolvedValue({ id: 'a1', patientId: 'p1', professionalId: 'pr1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const res = await request(buildApp(prisma)).get('/a1/batch');
    expect(res.status).toBeLessThan(500);
  });
});
