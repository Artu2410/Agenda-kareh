import 'express-async-errors';
import express from 'express';
import request from 'supertest';
import {
  deleteAppointment,
  cancelFutureAppointments,
  getAppointmentDeletionBlocker,
} from '../src/controllers/AppointmentController.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';

const futureDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date;
};

const buildAppointment = (overrides = {}) => ({
  id: 'a1',
  date: futureDate(),
  time: '10:00',
  slotNumber: 1,
  patientId: 'p1',
  professionalId: 'pr1',
  status: 'SCHEDULED',
  _count: { billingInvoiceItems: 0 },
  ...overrides,
});

const buildPrisma = ({ reference = buildAppointment(), candidates = [] } = {}) => {
  const tx = {
    appointment: {
      findUnique: jest.fn().mockResolvedValue(reference),
      findMany: jest.fn(async ({ where }) => (where?.patientId && !where?.OR && !where?.AND && !where?.date ? [] : candidates)),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn(async ({ where }) => ({ count: where.id.in.length })),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    ...tx,
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(async (fn) => fn(tx)),
  };
  return { prisma, tx };
};

const buildApp = (prisma, role = 'ADMIN') => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { userId: 'u1', role, professionalId: role === 'PROFESSIONAL' ? 'pr1' : null };
    next();
  });
  app.delete('/appointments/:id', (req, res) => deleteAppointment(req, res, prisma));
  app.post('/appointments/patients/:patientId/cancel-future', (req, res) => cancelFutureAppointments(req, res, prisma));
  app.use(errorHandler);
  return app;
};

describe('getAppointmentDeletionBlocker', () => {
  it('protege turnos atendidos, ausentes y facturados', () => {
    expect(getAppointmentDeletionBlocker({ status: 'COMPLETED' })).toMatch(/atendido/);
    expect(getAppointmentDeletionBlocker({ status: 'NO_SHOW' })).toMatch(/ausente/);
    expect(getAppointmentDeletionBlocker({ status: 'SCHEDULED', _count: { billingInvoiceItems: 1 } })).toMatch(/facturado/);
    expect(getAppointmentDeletionBlocker({ status: 'SCHEDULED', _count: { billingInvoiceItems: 0 } })).toBeNull();
  });
});

describe('DELETE /appointments/:id', () => {
  it('rechaza con 409 un turno atendido y no lo borra', async () => {
    const { prisma, tx } = buildPrisma({ reference: buildAppointment({ status: 'COMPLETED' }) });
    const res = await request(buildApp(prisma)).delete('/appointments/a1');
    expect(res.status).toBe(409);
    expect(tx.appointment.delete).not.toHaveBeenCalled();
  });

  it('rechaza con 409 un turno facturado', async () => {
    const { prisma, tx } = buildPrisma({ reference: buildAppointment({ _count: { billingInvoiceItems: 1 } }) });
    const res = await request(buildApp(prisma)).delete('/appointments/a1');
    expect(res.status).toBe(409);
    expect(tx.appointment.delete).not.toHaveBeenCalled();
  });

  it('borra un turno pendiente y deja auditoría', async () => {
    const { prisma, tx } = buildPrisma();
    const res = await request(buildApp(prisma)).delete('/appointments/a1');
    expect(res.status).toBe(200);
    expect(tx.appointment.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('en modo futuras saltea los turnos protegidos', async () => {
    const { prisma, tx } = buildPrisma({
      candidates: [
        buildAppointment({ id: 'a2' }),
        buildAppointment({ id: 'a3', status: 'COMPLETED' }),
        buildAppointment({ id: 'a4', _count: { billingInvoiceItems: 2 } }),
      ],
    });
    const res = await request(buildApp(prisma)).delete('/appointments/a1?deleteFuture=true');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ count: 1, skipped: 2 });
    expect(tx.appointment.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['a2'] } } });
  });

  it('un profesional no puede borrar turnos de otro profesional', async () => {
    const { prisma, tx } = buildPrisma({ reference: buildAppointment({ professionalId: 'pr2' }) });
    const res = await request(buildApp(prisma, 'PROFESSIONAL')).delete('/appointments/a1');
    expect(res.status).toBe(403);
    expect(tx.appointment.delete).not.toHaveBeenCalled();
  });
});

describe('POST /appointments/patients/:patientId/cancel-future', () => {
  it('exige fromDate válida', async () => {
    const { prisma, tx } = buildPrisma();
    const missing = await request(buildApp(prisma)).post('/appointments/patients/p1/cancel-future').send({});
    const invalid = await request(buildApp(prisma)).post('/appointments/patients/p1/cancel-future').send({ fromDate: 'no-es-fecha' });
    expect(missing.status).toBe(400);
    expect(invalid.status).toBe(400);
    expect(tx.appointment.deleteMany).not.toHaveBeenCalled();
  });

  it('no permite cancelar desde una fecha pasada', async () => {
    const { prisma, tx } = buildPrisma();
    const res = await request(buildApp(prisma)).post('/appointments/patients/p1/cancel-future').send({ fromDate: '2020-01-01' });
    expect(res.status).toBe(400);
    expect(tx.appointment.deleteMany).not.toHaveBeenCalled();
  });

  it('borra solo turnos no protegidos, deja auditoría por turno y respeta el alcance del profesional', async () => {
    const { prisma, tx } = buildPrisma({
      candidates: [buildAppointment({ id: 'a2' }), buildAppointment({ id: 'a3' }), buildAppointment({ id: 'a4', _count: { billingInvoiceItems: 1 } })],
    });
    const res = await request(buildApp(prisma, 'PROFESSIONAL'))
      .post('/appointments/patients/p1/cancel-future')
      .send({ fromDate: new Date().toISOString() });
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    const where = tx.appointment.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain('pr1');
    expect(JSON.stringify(where)).toContain('NO_SHOW');
    expect(tx.appointment.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['a2', 'a3'] } } });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
  });
});
