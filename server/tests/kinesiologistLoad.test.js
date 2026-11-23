import 'express-async-errors';
import express from 'express';
import request from 'supertest';
import { addDays, startOfWeek } from 'date-fns';
import { getKinesiologistLoadRule } from '../src/domain/metrics/capacity.service.js';
import { getHiringRecommendations, getWeeklyKinesiologistLoad } from '../src/controllers/hiring.controller.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';

// Regla del consultorio: agenda 14:00–19:00 de lunes a sábado, 5 pacientes por franja
// (55 por día, ~330 por semana), pero un kinesiólogo atiende como máximo 27 por día (162 por semana).
const agendaConfig = { slotDuration: 30, capacityPerSlot: 5 };
const kine = (id) => ({
  id,
  fullName: `Kine ${id}`,
  workSchedule: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: '14:00', endTime: '19:00' })),
});

describe('getKinesiologistLoadRule', () => {
  it('27 por día y 162 por semana con jornada de 14 a 19 de lunes a sábado', () => {
    const rule = getKinesiologistLoadRule({ professionals: [kine('k1')], agendaConfig, environment: {} });
    expect(rule.maxPerDay).toBe(27);
    expect(rule.operatingDaysPerWeek).toBe(6);
    expect(rule.maxPerWeek).toBe(162);
    expect(rule.turnsPerHour).toBeCloseTo(27 / 5, 5);
  });

  it('el tope se puede configurar', () => {
    const rule = getKinesiologistLoadRule({ professionals: [kine('k1')], agendaConfig, environment: { KAREH_MAX_PATIENTS_PER_KINE_DAY: '30' } });
    expect(rule.maxPerWeek).toBe(180);
  });
});

describe('getWeeklyKinesiologistLoad', () => {
  it('mide al kinesiólogo más cargado y su día más cargado en la semana actual', () => {
    const now = new Date();
    const monday = addDays(startOfWeek(now), 1);
    const appointments = [
      ...Array.from({ length: 28 }, (_, i) => ({ id: `a${i}`, date: monday, professionalId: 'k1' })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: `b${i}`, date: monday, professionalId: 'k2' })),
      { id: 'a0', date: monday, professionalId: 'k1' }, // duplicado: no cuenta dos veces
      { id: 'x', date: addDays(monday, 14), professionalId: 'k1' }, // otra semana
    ];
    expect(getWeeklyKinesiologistLoad(appointments, now)).toMatchObject({ maxDay: 28, maxWeek: 28 });
  });
});

describe('Contratación con la regla de carga', () => {
  const buildApp = (appointments) => {
    const prisma = {
      agendaConfig: { findFirst: jest.fn().mockResolvedValue(agendaConfig) },
      professional: { findMany: jest.fn().mockResolvedValue([kine('k1')]) },
      appointment: { findMany: jest.fn().mockResolvedValue(appointments), count: jest.fn().mockResolvedValue(0) },
      billingInvoice: { findMany: jest.fn().mockResolvedValue([]) },
      cashFlow: { findMany: jest.fn().mockResolvedValue([]) },
      agendaCalendarEntry: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const app = express();
    app.use((req, res, next) => { req.user = { userId: 'u1', role: 'ADMIN' }; next(); });
    app.get('/hiring', (req, res) => getHiringRecommendations(req, res, prisma));
    app.use(errorHandler);
    return app;
  };

  it('con más de 27 pacientes en un día para un kine recomienda llamar otro', async () => {
    const today = new Date();
    const appointments = Array.from({ length: 30 }, (_, i) => ({
      id: `a${i}`, date: today, status: 'SCHEDULED', patientId: `p${i}`, professionalId: 'k1',
    }));
    const res = await request(buildApp(appointments)).get('/hiring');
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.body);
    expect(text).toContain('llamar otro kinesiólogo');
    expect(text).toContain('30/día');
  });

  it('dentro del tope no dispara la alerta', async () => {
    const today = new Date();
    const appointments = Array.from({ length: 10 }, (_, i) => ({
      id: `a${i}`, date: today, status: 'SCHEDULED', patientId: `p${i}`, professionalId: 'k1',
    }));
    const res = await request(buildApp(appointments)).get('/hiring');
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('llamar otro kinesiólogo');
  });
});
