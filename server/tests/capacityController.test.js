import express from 'express';
import request from 'supertest';
import { getCapacityMetrics } from '../src/controllers/capacity.controller.js';
import createCapacityRoutes from '../src/routes/capacity.routes.js';

const createResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('getCapacityMetrics', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 3, 12));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses the centralized capacity service and derives the weekly Kareh capacity from configuration', async () => {
    const prisma = {
      agendaConfig: {
        findFirst: jest.fn().mockResolvedValue({ slotDuration: 30, capacityPerSlot: 5, nationalHolidaysClose: false }),
      },
      professional: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'prof-1',
            fullName: 'Dr. Kareh',
            specialty: 'Kinesiología',
            workSchedule: [
              { dayOfWeek: 1, startTime: '14:00', endTime: '19:30' },
              { dayOfWeek: 2, startTime: '17:30', endTime: '19:30' },
              { dayOfWeek: 3, startTime: '14:00', endTime: '19:30' },
              { dayOfWeek: 4, startTime: '17:30', endTime: '19:30' },
              { dayOfWeek: 5, startTime: '14:00', endTime: '19:30' },
              { dayOfWeek: 6, startTime: '08:00', endTime: '12:30' },
            ],
          },
        ]),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      agendaCalendarEntry: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const req = {};
    const res = createResponse();

    await getCapacityMetrics(req, res, prisma);

    const payload = res.json.mock.calls[0][0];
    expect(payload.currentMonth.weeklyCapacity).toBe(250);
    expect(payload.currentWeek.capacity).toBe(250);
    expect(payload.currentMonth.monthlyCapacity).toBe(1120);
    expect(payload.professionals[0].monthlyCapacity).toBe(1120);
    expect(payload.currentMonth.occupancyRate).toBe(0);
    expect(payload.currentMonth.attendanceRate).toBe(0);

    prisma.agendaCalendarEntry.findMany.mockResolvedValue([{
      id: 'holiday-1',
      date: '2026-10-12',
      name: 'Feriado de prueba',
      type: 'CLINIC_CLOSURE',
      isActive: true,
      isOperational: false,
      professionalId: null,
    }]);
    const holidayRes = createResponse();
    await getCapacityMetrics(req, holidayRes, prisma);

    const holidayPayload = holidayRes.json.mock.calls[0][0];
    expect(holidayPayload.currentMonth.monthlyCapacity).toBe(1065);
    expect(holidayPayload.currentMonth.days.find((day) => day.date === '2026-10-12').capacity).toBe(0);
    expect(holidayPayload.currentMonth.freeMonthlyCapacity).toBe(1065);
  });

  it('serves generated national holidays through GET /api/capacity without manual holiday rows', async () => {
    const prisma = {
      agendaConfig: {
        findFirst: jest.fn().mockResolvedValue({ slotDuration: 30, capacityPerSlot: 5, nationalHolidaysClose: true }),
      },
      professional: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'prof-1',
          fullName: 'Dr. Kareh',
          specialty: 'Kinesiología',
          workSchedule: [
            { dayOfWeek: 1, startTime: '14:00', endTime: '19:30' },
            { dayOfWeek: 2, startTime: '17:30', endTime: '19:30' },
            { dayOfWeek: 3, startTime: '14:00', endTime: '19:30' },
            { dayOfWeek: 4, startTime: '17:30', endTime: '19:30' },
            { dayOfWeek: 5, startTime: '14:00', endTime: '19:30' },
            { dayOfWeek: 6, startTime: '08:00', endTime: '12:30' },
          ],
        }]),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      agendaCalendarEntry: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const app = express();
    app.use((req, res, next) => {
      req.user = { userId: 'admin-1', role: 'ADMIN' };
      next();
    });
    app.use('/api/capacity', createCapacityRoutes(prisma));

    const response = await request(app).get('/api/capacity');

    expect(response.status).toBe(200);
    expect(response.body.currentWeek.capacity).toBe(250);
    expect(response.body.currentMonth.monthlyCapacity).toBe(1065);
    expect(response.body.professionals[0].monthlyCapacity).toBe(1065);
    expect(response.body.currentMonth.days.find((day) => day.date === '2026-10-12').capacity).toBe(0);
    expect(response.body.currentMonth.days.find((day) => day.date === '2026-10-12').theoreticalCapacity).toBe(55);
  });

  it('calculates historical occupancy from reserved turns, separately from attendance', async () => {
    const appointments = [
      { id: 'completed', date: new Date(2026, 9, 2, 12), status: 'COMPLETED', patientId: 'p1', professionalId: 'prof-1' },
      { id: 'scheduled', date: new Date(2026, 9, 2, 12), status: 'SCHEDULED', patientId: 'p2', professionalId: 'prof-1' },
      { id: 'no-show', date: new Date(2026, 9, 2, 12), status: 'NO_SHOW', patientId: 'p3', professionalId: 'prof-1' },
    ];
    const prisma = {
      agendaConfig: {
        findFirst: jest.fn().mockResolvedValue({ slotDuration: 30, capacityPerSlot: 5, nationalHolidaysClose: false }),
      },
      professional: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'prof-1',
          fullName: 'Dr. Kareh',
          specialty: 'Kinesiología',
          workSchedule: [
            { dayOfWeek: 1, startTime: '14:00', endTime: '19:00' },
            { dayOfWeek: 2, startTime: '17:30', endTime: '19:00' },
            { dayOfWeek: 3, startTime: '14:00', endTime: '19:00' },
            { dayOfWeek: 4, startTime: '17:30', endTime: '19:00' },
            { dayOfWeek: 5, startTime: '14:00', endTime: '19:00' },
            { dayOfWeek: 6, startTime: '08:00', endTime: '12:00' },
          ],
        }]),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue(appointments),
      },
      agendaCalendarEntry: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const res = createResponse();

    await getCapacityMetrics({}, res, prisma);

    const payload = res.json.mock.calls[0][0];
    const monthlyTrend = payload.monthlyTrend;
    expect(monthlyTrend).toHaveLength(8);
    expect(monthlyTrend[0].monthKey).toBe('2026-03');
    expect(monthlyTrend.some((row) => row.monthKey === '2026-02')).toBe(false);
    const octoberTrend = monthlyTrend.find((row) => row.monthKey === '2026-10');
    expect(octoberTrend).toEqual(expect.objectContaining({
      turns: 3,
      completedCount: 1,
      occupancyRate: 0.3,
      occupiedCount: 3,
      attendedCount: 1,
      effectiveCapacity: expect.any(Number),
      historicalCapacitySource: 'CURRENT_CONFIGURATION_RECONSTRUCTION',
    }));
    expect(new Set(monthlyTrend.map((row) => row.effectiveCapacity)).size).toBeGreaterThan(1);
    expect(payload.professionals[0]).toEqual(expect.objectContaining({
      occupiedCount: 3,
      completedCount: 1,
    }));
    monthlyTrend.forEach((row) => {
      expect(row.capacity).toBe(row.effectiveCapacity);
      expect(row.occupancyRate).toBe(
        row.effectiveCapacity > 0 ? Math.round((row.occupiedCount / row.effectiveCapacity) * 1000) / 10 : 0,
      );
    });
  });
});
