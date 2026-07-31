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
