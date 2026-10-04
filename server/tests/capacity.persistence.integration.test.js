import express from 'express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createAppointment, updateAppointment } from '../src/controllers/AppointmentController.js';
import createAgendaRoutes from '../src/routes/agenda.routes.js';
import createCapacityRoutes from '../src/routes/capacity.routes.js';
import createMetricsRoutes from '../src/routes/metrics.routes.js';

const integrationDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const createResponse = () => {
  const res = {};
  res.statusCode = 200;
  res.status = jest.fn((statusCode) => {
    res.statusCode = statusCode;
    return res;
  });
  res.json = jest.fn((body) => {
    res.body = body;
    return res;
  });
  return res;
};

const createIntegrationApp = (prisma) => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { userId: 'integration-admin', role: 'ADMIN' };
    next();
  });
  app.use('/api/agenda', createAgendaRoutes(prisma));
  app.use('/api/capacity', createCapacityRoutes(prisma));
  app.use('/api/metrics', createMetricsRoutes(prisma));
  return app;
};

integrationDescribe('capacity persistence integration (isolated PostgreSQL only)', () => {
  let prisma;
  let app;
  let professionalId;
  let agendaConfigId;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.TEST_DATABASE_URL } },
    });
    await prisma.$connect();

    const existingConfig = await prisma.agendaConfig.findFirst();
    if (existingConfig) await prisma.agendaConfig.delete({ where: { id: existingConfig.id } });

    const existingTestProfessionals = await prisma.professional.findMany({
      where: { licenseNumber: { startsWith: 'TEST-' } },
      select: { id: true },
    });
    for (const professional of existingTestProfessionals) {
      await prisma.agendaCalendarEntry.deleteMany({ where: { professionalId: professional.id } });
      await prisma.appointment.deleteMany({ where: { professionalId: professional.id } });
      await prisma.workSchedule.deleteMany({ where: { professionalId: professional.id } });
      await prisma.professional.delete({ where: { id: professional.id } });
    }
    await prisma.patient.deleteMany({ where: { dni: { startsWith: 'TEST-HOLIDAY-' } } });
    await prisma.agendaCalendarEntry.deleteMany({ where: { name: 'Integration clinic closure' } });

    app = createIntegrationApp(prisma);
    const settingsResponse = await request(app)
      .put('/api/agenda/config')
      .send({
        weekdayStartTime: '08:00',
        weekdayEndTime: '19:00',
        saturdayEnabled: true,
        saturdayStartTime: '08:00',
        saturdayEndTime: '12:00',
        slotDuration: 30,
        capacityPerSlot: 5,
        nationalHolidaysClose: true,
      });
    expect([200, 201]).toContain(settingsResponse.status);
    expect(settingsResponse.body.nationalHolidaysClose).toBe(true);
    agendaConfigId = settingsResponse.body.id;

    const professional = await prisma.professional.create({
      data: {
        fullName: 'Kareh Capacity Integration Fixture',
        licenseNumber: `TEST-${Date.now()}`,
        workSchedule: {
          create: [
            { dayOfWeek: 1, startTime: '14:00', endTime: '19:00' },
            { dayOfWeek: 2, startTime: '17:30', endTime: '19:00' },
            { dayOfWeek: 3, startTime: '14:00', endTime: '19:00' },
            { dayOfWeek: 4, startTime: '17:30', endTime: '19:00' },
            { dayOfWeek: 5, startTime: '14:00', endTime: '19:00' },
            { dayOfWeek: 6, startTime: '08:00', endTime: '12:00' },
          ],
        },
      },
    });
    professionalId = professional.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.agendaCalendarEntry.deleteMany({ where: { name: 'Integration clinic closure' } });
    if (professionalId) {
      await prisma.appointment.deleteMany({ where: { professionalId } });
      await prisma.workSchedule.deleteMany({ where: { professionalId } });
      await prisma.professional.delete({ where: { id: professionalId } });
    }
    await prisma.patient.deleteMany({ where: { dni: { startsWith: 'TEST-HOLIDAY-' } } });
    if (agendaConfigId) await prisma.agendaConfig.delete({ where: { id: agendaConfigId } });
    await prisma.$disconnect();
  });

  it('persists Settings and calendar writes, then Capacity and Dashboard return identical effective capacity', async () => {
    const closureResponse = await request(app)
      .post('/api/agenda/calendar-entries')
      .send({
        date: '2026-10-19',
        name: 'Integration clinic closure',
        type: 'CLINIC_CLOSURE',
      });
    expect(closureResponse.status).toBe(201);

    const persistedEntries = await prisma.agendaCalendarEntry.findMany({
      where: { name: 'Integration clinic closure', isActive: true },
    });
    expect(persistedEntries).toHaveLength(1);

    const calendarFeed = await request(app)
      .get('/api/agenda/calendar-entries?from=2026-10-01&to=2026-10-31')
      .expect(200);
    expect(calendarFeed.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: '2026-10-12', type: 'NATIONAL_HOLIDAY', isClosedForScope: true }),
      expect.objectContaining({ date: '2026-10-19', type: 'CLINIC_CLOSURE', isClosedForScope: true }),
    ]));

    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 3, 12));
    try {
      const capacityResponse = await request(app).get('/api/capacity').expect(200);
      expect(capacityResponse.body.currentWeek.capacity).toBe(250);
      expect(capacityResponse.body.currentMonth.monthlyCapacity).toBe(1010);
      expect(capacityResponse.body.currentMonth.days.find((day) => day.date === '2026-10-12')).toEqual(
        expect.objectContaining({ theoreticalCapacity: 55, effectiveCapacity: 0 }),
      );
      expect(capacityResponse.body.currentMonth.days.find((day) => day.date === '2026-10-19').effectiveCapacity).toBe(0);

      const metricsResponse = await request(app).get('/api/metrics?month=10&year=2026').expect(200);
      expect(metricsResponse.body.weekly.capacity).toBe(250);
      expect(metricsResponse.body.monthly.capacityMonthly).toBe(capacityResponse.body.currentMonth.monthlyCapacity);
      expect(metricsResponse.body.monthly.capacityDays.find((day) => day.date === '2026-10-12').effectiveCapacity).toBe(0);
      expect(metricsResponse.body.monthly.capacityDays.find((day) => day.date === '2026-10-19').effectiveCapacity).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects a single new appointment on a national holiday', async () => {
    await expect(createAppointment({
      user: { role: 'ADMIN', userId: 'integration-admin' },
      body: {
        patientData: {
          dni: 'TEST-HOLIDAY-SINGLE',
          fullName: 'Paciente de prueba',
          birthDate: '2000-01-01',
          treatAsParticular: true,
          healthInsurance: 'PARTICULAR',
        },
        professionalId,
        date: '2026-10-12',
        time: '14:00',
        sessionCount: 1,
      },
    }, createResponse(), prisma)).rejects.toMatchObject({ statusCode: 409 });

    expect(await prisma.appointment.count({
      where: { professionalId, date: new Date(2026, 9, 12, 12) },
    })).toBe(0);
    expect(await prisma.patient.findUnique({ where: { dni: 'TEST-HOLIDAY-SINGLE' } })).toBeNull();
  });

  it('skips national holidays and manual closures while creating a recurring series', async () => {
    const response = {
      statusCode: 200,
      body: null,
      status(statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    expect(typeof response.status).toBe('function');
    const appointmentPrisma = new Proxy(prisma, {
      get(target, property, receiver) {
        if (property === 'auditLog') return undefined;
        const value = Reflect.get(target, property, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    await createAppointment({
      user: { role: 'ADMIN', userId: 'integration-admin' },
      headers: {},
      body: {
        patientData: {
          dni: 'TEST-HOLIDAY-SERIES',
          fullName: 'Paciente de serie',
          birthDate: '2000-01-01',
          treatAsParticular: true,
          healthInsurance: 'PARTICULAR',
        },
        professionalId,
        date: '2026-10-12',
        time: '14:00',
        sessionCount: 2,
        selectedDays: [1],
      },
    }, response, appointmentPrisma);

    const createdDates = response.body.appointments.map((appointment) => (
      new Date(appointment.date).toISOString().slice(0, 10)
    ));
    expect(createdDates).toEqual(['2026-10-26', '2026-11-02']);
    expect(createdDates).not.toContain('2026-10-12');
    expect(createdDates).not.toContain('2026-10-19');
  });

  it('rejects moving a persisted appointment to a national holiday without deleting or moving it', async () => {
    const appointment = await prisma.appointment.findFirst({
      where: { patient: { dni: 'TEST-HOLIDAY-SERIES' } },
      orderBy: { date: 'asc' },
    });
    const originalDate = appointment.date;

    await expect(updateAppointment({
      params: { id: appointment.id },
      body: {
        patientId: appointment.patientId,
        date: '2026-10-12',
        time: '14:00',
      },
    }, createResponse(), prisma)).rejects.toMatchObject({ statusCode: 409 });

    const unchanged = await prisma.appointment.findUnique({ where: { id: appointment.id } });
    expect(unchanged.date).toEqual(originalDate);
  });
});
