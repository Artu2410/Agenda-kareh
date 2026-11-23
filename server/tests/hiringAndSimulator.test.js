import 'express-async-errors';
import express from 'express';
import request from 'supertest';
import { startOfMonth, addDays, format } from 'date-fns';
import { getHiringRecommendations } from '../src/controllers/hiring.controller.js';
import { getStrategicSimulator } from '../src/controllers/strategicSimulator.controller.js';
import { getCapacityForMonth } from '../src/domain/metrics/capacity.service.js';
import { getHolidaysForDateRange } from '../src/services/holidayCalendar.service.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';

// Estas dos pantallas estuvieron rotas desde 98d7f8b (funciones borradas y en uso)
// sin que ningún test lo detectara. Además, el simulador calculaba una capacidad
// distinta a la de la pantalla de Capacidad.

const agendaConfig = { slotDuration: 30, capacityPerSlot: 5, nationalHolidaysClose: true };
const professionals = [{
  id: 'pr1',
  fullName: 'Lic. Romero',
  isActive: true,
  isArchived: false,
  workSchedule: [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startTime: '08:00', endTime: '12:00', isActive: true })),
}];

const monthStart = startOfMonth(new Date());
const appointments = [
  { id: 'a1', date: addDays(monthStart, 2), status: 'COMPLETED', patientId: 'p1', professionalId: 'pr1', time: '09:00' },
  { id: 'a2', date: addDays(monthStart, 3), status: 'SCHEDULED', patientId: 'p2', professionalId: 'pr1', time: '10:00' },
];

const buildPrisma = () => ({
  agendaConfig: { findFirst: jest.fn().mockResolvedValue(agendaConfig) },
  professional: { findMany: jest.fn().mockResolvedValue(professionals) },
  appointment: {
    findMany: jest.fn().mockResolvedValue(appointments),
    count: jest.fn().mockResolvedValue(0),
  },
  billingInvoice: { findMany: jest.fn().mockResolvedValue([]) },
  cashFlow: { findMany: jest.fn().mockResolvedValue([]) },
  agendaCalendarEntry: { findMany: jest.fn().mockResolvedValue([]) },
});

const buildApp = (prisma) => {
  const app = express();
  app.use((req, res, next) => { req.user = { userId: 'u1', role: 'ADMIN' }; next(); });
  app.get('/hiring', (req, res) => getHiringRecommendations(req, res, prisma));
  app.get('/simulator', (req, res) => getStrategicSimulator(req, res, prisma));
  app.use(errorHandler);
  return app;
};

const expectedMonth = async () => {
  const end = addDays(startOfMonth(addDays(monthStart, 40)), -1);
  const holidays = await getHolidaysForDateRange(format(monthStart, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'), { nationalHolidaysClose: true });
  return getCapacityForMonth({
    year: monthStart.getFullYear(),
    month: monthStart.getMonth() + 1,
    professionals,
    agendaConfig,
    appointments,
    calendarEntries: [],
    holidays,
  });
};

describe('Contratación', () => {
  it('responde 200 con histórico mensual y la misma capacidad que la pantalla de Capacidad', async () => {
    const res = await request(buildApp(buildPrisma())).get('/hiring');
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('Invalid');
    const expected = await expectedMonth();
    expect(body).toContain(String(expected.effectiveCapacity));
  });
});

describe('Simulador estratégico', () => {
  it('responde 200 con escenarios', async () => {
    const res = await request(buildApp(buildPrisma())).get('/simulator');
    expect(res.status).toBe(200);
    expect(res.body.scenarios.length).toBeGreaterThan(0);
    expect(res.body.baseline.month).toMatch(/\d{4}/);
  });

  it('usa la capacidad de la pantalla de Capacidad (franjas × lugares, sin días cerrados)', async () => {
    const res = await request(buildApp(buildPrisma())).get('/simulator');
    const expected = await expectedMonth();
    expect(expected.effectiveCapacity).toBeGreaterThan(0);
    expect(res.body.baseline.monthlyCapacity).toBe(expected.effectiveCapacity);
    expect(res.body.baseline.freeMonthlyCapacity).toBe(expected.available);
    expect(res.body.baseline.occupancyRate).toBeCloseTo(expected.occupancyRate, 1);
  });
});
