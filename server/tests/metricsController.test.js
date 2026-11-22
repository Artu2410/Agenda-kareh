import { getMetrics } from '../src/controllers/metrics.controller.js';
import { metricsQuerySchema } from '../src/validations/metricsSchemas.js';

const createResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const buildAppointment = ({
  id,
  date,
  status,
  patientId,
  healthInsurance = 'PARTICULAR',
  treatAsParticular = true,
  isRespiratory = false,
  isIU = false,
}) => ({
  id,
  date: new Date(date),
  status,
  patientId,
  time: '10:00',
  slotNumber: 1,
  patient: {
    healthInsurance,
    treatAsParticular,
    isRespiratory,
    isIU,
  },
});

describe('getMetrics', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-30T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects incomplete month/year filter combinations with a descriptive error', () => {
    const result = metricsQuerySchema.safeParse({ month: '4' });

    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toBe('Si se envía month o year, ambos deben enviarse para filtrar por periodo.');
  });

  it('uses the requested month and year when they are provided in the query', async () => {
    const prisma = {
      appointment: {
        findMany: jest.fn(async () => []),
        count: jest.fn(async () => 0),
        groupBy: jest.fn(async () => []),
      },
    };

    const req = { query: { period: 'month', month: '4', year: '2026' } };
    const res = createResponse();

    await getMetrics(req, res, prisma);

    const payload = res.json.mock.calls[0][0];

    expect(payload.monthly.label).toBe('abril 2026');
  });

  it('uses the same Kareh weekly and actual-month capacity as the capacity domain service', async () => {
    const prisma = {
      agendaConfig: {
        findFirst: jest.fn(async () => ({ slotDuration: 30, capacityPerSlot: 5, nationalHolidaysClose: true })),
      },
      professional: {
        findMany: jest.fn(async () => ([{
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
        }])),
      },
      appointment: {
        findMany: jest.fn(async () => []),
        count: jest.fn(async () => 0),
        groupBy: jest.fn(async () => []),
      },
      agendaCalendarEntry: {
        findMany: jest.fn(async () => []),
      },
    };
    const req = { query: { month: '10', year: '2026' } };
    const res = createResponse();

    await getMetrics(req, res, prisma);

    const payload = res.json.mock.calls[0][0];
    expect(payload.weekly.capacity).toBe(250);
    expect(payload.weekly.occupiedCount).toBe(0);
    expect(payload.monthly.capacityMonthly).toBe(1065);
    expect(payload.monthly.capacityDays.find((day) => day.date === '2026-10-12').capacity).toBe(0);
    expect(payload.monthly.occupancyRate).toBe(0);
    expect(payload.monthly.attendanceRate).toBeNull();
  });

  it('returns future agenda metrics and filters inactive monthly rows', async () => {
    const appointments = [
      buildAppointment({ id: 'apr-1', date: '2026-04-05T12:00:00.000Z', status: 'COMPLETED', patientId: 'p1' }),
      buildAppointment({ id: 'apr-2', date: '2026-04-10T12:00:00.000Z', status: 'NO_SHOW', patientId: 'p2' }),
      buildAppointment({ id: 'may-1', date: '2026-05-03T12:00:00.000Z', status: 'COMPLETED', patientId: 'p1' }),
      buildAppointment({ id: 'may-2', date: '2026-05-15T12:00:00.000Z', status: 'SCHEDULED', patientId: 'p4' }),
      buildAppointment({ id: 'may-3', date: '2026-05-30T12:00:00.000Z', status: 'SCHEDULED', patientId: 'p1' }),
      buildAppointment({ id: 'jun-1', date: '2026-06-03T12:00:00.000Z', status: 'SCHEDULED', patientId: 'p1' }),
      buildAppointment({ id: 'jun-2', date: '2026-06-12T12:00:00.000Z', status: 'SCHEDULED', patientId: 'p4' }),
      buildAppointment({ id: 'jul-1', date: '2026-07-01T12:00:00.000Z', status: 'SCHEDULED', patientId: 'p2' }),
      buildAppointment({ id: 'jul-2', date: '2026-07-22T12:00:00.000Z', status: 'SCHEDULED', patientId: 'p2' }),
      buildAppointment({ id: 'aug-1', date: '2026-08-05T12:00:00.000Z', status: 'SCHEDULED', patientId: 'p6' }),
    ];

    const prisma = {
      appointment: {
        findMany: jest.fn(async ({ where }) => {
          const dateGte = where?.date?.gte ? new Date(where.date.gte) : null;
          const dateLt = where?.date?.lt ? new Date(where.date.lt) : null;
          const dateLte = where?.date?.lte ? new Date(where.date.lte) : null;

          return appointments.filter((appointment) => {
            const appointmentDate = new Date(appointment.date);

            if (dateGte && appointmentDate < dateGte) return false;
            if (dateLt && appointmentDate >= dateLt) return false;
            if (dateLte && appointmentDate > dateLte) return false;

            if (where?.status?.not === 'CANCELLED' && appointment.status === 'CANCELLED') return false;
            if (where?.status && typeof where.status === 'string' && appointment.status !== where.status) return false;
            if (where?.status?.not && appointment.status === where.status.not) return false;

            if (where?.patient?.isRespiratory && !appointment.patient.isRespiratory) return false;
            if (where?.patient?.isIU && !appointment.patient.isIU) return false;

            return true;
          });
        }),
        count: jest.fn(async ({ where }) => {
          const rows = await prisma.appointment.findMany({ where });
          return rows.length;
        }),
        groupBy: jest.fn(async ({ where }) => {
          const rows = appointments.filter((appointment) => {
            if (where?.status?.not === 'CANCELLED' && appointment.status === 'CANCELLED') return false;
            return true;
          });

          const byPatient = new Map();
          rows.forEach((appointment) => {
            const current = byPatient.get(appointment.patientId);
            if (!current || new Date(appointment.date) < new Date(current._min.date)) {
              byPatient.set(appointment.patientId, {
                patientId: appointment.patientId,
                _min: { date: new Date(appointment.date) },
              });
            }
          });

          return Array.from(byPatient.values());
        }),
      },
    };

    const req = {};
    const res = createResponse();

    await getMetrics(req, res, prisma);

    const payload = res.json.mock.calls[0][0];

    expect(payload.monthlyTrend.every((row) => row.appointmentCount > 0)).toBe(true);
    expect(payload.monthly).toEqual(expect.objectContaining({
      occupancyRate: expect.any(Number),
      capacityMonthly: expect.any(Number),
      freeCapacity: expect.any(Number),
    }));
    expect(payload.commercial).toEqual(expect.objectContaining({
      consultations: expect.any(Number),
      turnsGranted: expect.any(Number),
      assistances: expect.any(Number),
      continuityCount: expect.any(Number),
      abandonmentCount: expect.any(Number),
      conversions: expect.objectContaining({
        consultationsToTurns: expect.any(Number),
        turnsToAssistances: expect.any(Number),
        assistancesToContinuity: expect.any(Number),
      }),
    }));
    expect(payload.billingByCoverage).toEqual(expect.any(Array));
    expect(payload.insights).toEqual(expect.any(Array));
    expect(payload.futureAgenda).toEqual(expect.objectContaining({
      farthestLabel: expect.stringContaining('agosto'),
      appointmentCount: 6,
      patientCount: 4,
      activePatients: {
        total: 4,
        new: 1,
        recurrent: 3,
      },
    }));
    expect(payload.futureAgenda.coverageByMonth).toEqual([
      expect.objectContaining({ monthKey: '2026-05', appointmentCount: 1, patientCount: 1 }),
      expect.objectContaining({ monthKey: '2026-06', appointmentCount: 2, patientCount: 2 }),
      expect.objectContaining({ monthKey: '2026-07', appointmentCount: 2, patientCount: 1 }),
      expect.objectContaining({ monthKey: '2026-08', appointmentCount: 1, patientCount: 1 }),
    ]);
  });
});

describe('getMetrics · conciliación del Panel (noviembre en curso)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 22, 12));
  });
  afterEach(() => jest.useRealTimers());

  const schedule = [
    { dayOfWeek: 1, startTime: '14:00', endTime: '19:30' },
    { dayOfWeek: 2, startTime: '17:30', endTime: '19:30' },
    { dayOfWeek: 3, startTime: '14:00', endTime: '19:30' },
    { dayOfWeek: 4, startTime: '17:30', endTime: '19:30' },
    { dayOfWeek: 5, startTime: '14:00', endTime: '19:30' },
    { dayOfWeek: 6, startTime: '08:00', endTime: '12:30' },
  ];

  it('cuenta los turnos con autorización como pendientes y descuenta feriados anteriores a esta semana', async () => {
    const nov = [
      buildAppointment({ id: 'a', date: new Date(2026, 10, 3), status: 'COMPLETED', patientId: 'p1' }),
      buildAppointment({ id: 'b', date: new Date(2026, 10, 4), status: 'NO_SHOW', patientId: 'p2' }),
      buildAppointment({ id: 'c', date: new Date(2026, 10, 5), status: 'SCHEDULED', patientId: 'p3' }),
      buildAppointment({ id: 'd', date: new Date(2026, 10, 25), status: 'SCHEDULED', patientId: 'p1' }),
      buildAppointment({ id: 'e', date: new Date(2026, 10, 26), status: 'PENDING_AUTHORIZATION', patientId: 'p4' }),
      buildAppointment({ id: 'f', date: new Date(2026, 10, 27), status: 'AUTHORIZED', patientId: 'p5' }),
    ];
    const inRange = (where = {}) => nov.filter((row) => {
      const { gte, lt, lte } = where.date || {};
      if (gte && row.date < gte) return false;
      if (lt && row.date >= lt) return false;
      if (lte && row.date > lte) return false;
      const status = where.status;
      if (typeof status === 'string') return row.status === status;
      if (status?.in) return status.in.includes(row.status);
      if (status?.not) return row.status !== status.not;
      return true;
    });
    const prisma = {
      appointment: {
        findMany: jest.fn(async ({ where }) => inRange(where)),
        findFirst: jest.fn(async () => ({ date: new Date(2026, 10, 27) })),
        count: jest.fn(async ({ where }) => inRange(where).length),
        groupBy: jest.fn(async ({ where }) => [...new Set(inRange(where).map((r) => r.patientId))].map((patientId) => ({ patientId, _min: { date: null } }))),
      },
      agendaConfig: { findFirst: jest.fn(async () => ({ slotDuration: 30, capacityPerSlot: 5, nationalHolidaysClose: false })) },
      agendaCalendarEntry: {
        findMany: jest.fn(async () => [
          { id: 'h1', date: '2026-11-09', name: 'Cierre', type: 'CLINIC_CLOSURE', isActive: true, isOperational: false, professionalId: null },
          { id: 'h2', date: '2026-11-23', name: 'Feriado', type: 'PUBLIC_HOLIDAY', isActive: true, isOperational: false, professionalId: null },
        ]),
      },
      professional: { findMany: jest.fn(async () => [{ id: 'prof-1', workSchedule: schedule }]) },
    };
    const res = createResponse();

    await getMetrics({ query: {} }, res, prisma);
    const { monthly, weekly, futureAgenda } = res.json.mock.calls[0][0];

    expect(monthly.current).toBe(6);
    expect(monthly.completed + monthly.noShow + monthly.scheduled).toBe(monthly.current);
    expect(monthly).toEqual(expect.objectContaining({
      scheduled: 4, pendingPast: 1, upcoming: 3, authorizationAttention: 1, otherStatus: 0, isPartial: true,
    }));
    expect(monthly.capacityMonthly).toBe(945); // 1.055 − cierre 09/11 − feriado 23/11
    expect(monthly.changeLabel).toBe('Sin base');
    expect(weekly.scheduled).toBe(3);
    expect(weekly.attendanceRate).toBeNull();
    expect(futureAgenda.daysWithAppointments).toBe(3);
    expect(futureAgenda.calendarDaysToLastAppointment).toBe(5);
  });
});
