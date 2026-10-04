import {
  calculateOperationalCapacity,
  getCapacityForDate,
  getEffectiveCapacityForDate,
  getCapacityForMonth,
  getCapacityForWeek,
  getScheduleMinutesByDay,
} from '../src/domain/metrics/capacity.service.js';
import { getHolidays } from '../src/services/holidayCalendar.service.js';
import { mockOfficialHolidayFeed } from './helpers/officialHolidayFixture.js';

describe('Kareh capacity derived from real agenda configuration', () => {
  beforeEach(() => mockOfficialHolidayFeed());
  const karehSchedule = [
    { dayOfWeek: 1, startTime: '14:00', endTime: '19:30' },
    { dayOfWeek: 2, startTime: '17:30', endTime: '19:30' },
    { dayOfWeek: 3, startTime: '14:00', endTime: '19:30' },
    { dayOfWeek: 4, startTime: '17:30', endTime: '19:30' },
    { dayOfWeek: 5, startTime: '14:00', endTime: '19:30' },
    { dayOfWeek: 6, startTime: '08:00', endTime: '12:30' },
  ];

  const karehProfessionals = [{ id: 'prof-1', fullName: 'Kareh', workSchedule: karehSchedule }];

  const agendaConfig = { slotDuration: 30, capacityPerSlot: 5, nationalHolidaysClose: false };

  it('calculates exactly 250 weekly appointments and the expected capacity for every weekday', () => {
    const result = calculateOperationalCapacity({
      professionals: karehProfessionals,
      agendaConfig,
      referenceDate: '2026-10-05',
    });

    expect(result.weeklyCapacity).toBe(250);
    expect(result.professionals[0].weeklyCapacity).toBe(250);
    expect(result.capacityPerSlot).toBe(5);
    expect(result.totalAvailableMinutes).toBeGreaterThan(0);

    const week = getCapacityForWeek({
      startDate: '2026-10-05',
      professionals: karehProfessionals,
      agendaConfig,
    });

    expect(week.startDate).toBe('2026-10-05');
    expect(week.days.map(({ dayOfWeek, capacity }) => [dayOfWeek, capacity])).toEqual([
      [1, 55],
      [2, 20],
      [3, 55],
      [4, 20],
      [5, 55],
      [6, 45],
      [0, 0],
    ]);
    expect(week.totalCapacity).toBe(250);
  });

  it.each([
    [5, 250],
    [4, 200],
    [3, 150],
    [1, 50],
  ])('multiplies each available start block by capacityPerSlot=%s', (capacityPerSlot, expectedWeeklyCapacity) => {
    const result = calculateOperationalCapacity({
      professionals: karehProfessionals,
      agendaConfig: { ...agendaConfig, capacityPerSlot },
      referenceDate: '2026-10-05',
    });

    expect(result.weeklyCapacity).toBe(expectedWeeklyCapacity);
  });

  it('recalculates weekly and monthly capacity when only Monday hours change', () => {
    const shorterMonday = karehSchedule.map((entry) => (
      entry.dayOfWeek === 1 ? { ...entry, endTime: '18:00' } : entry
    ));
    const result = calculateOperationalCapacity({
      professionals: [{ ...karehProfessionals[0], workSchedule: shorterMonday }],
      agendaConfig,
      referenceDate: '2026-10-05',
    });

    expect(result.weeklyCapacity).toBe(235);
    expect(result.monthlyCapacity).toBe(1060);
  });

  it('counts 60-minute starts with an exclusive schedule end', () => {
    const week = getCapacityForWeek({
      startDate: '2026-10-05',
      professionals: karehProfessionals,
      agendaConfig: { ...agendaConfig, slotDuration: 60 },
    });

    expect(week.days.map((day) => day.capacity)).toEqual([25, 10, 25, 10, 25, 20, 0]);
    expect(week.totalCapacity).toBe(115);
    expect(calculateOperationalCapacity({
      professionals: karehProfessionals,
      agendaConfig: { ...agendaConfig, slotDuration: 60 },
      referenceDate: '2026-10-05',
    }).weeklyCapacity).toBe(115);
  });

  it('sums each actual October date and applies blocked, Sunday, empty, and Saturday rules', () => {
    const month = getCapacityForMonth({
      year: 2026,
      month: 10,
      professionals: karehProfessionals,
      agendaConfig,
      blockedDates: ['2026-10-15'],
    });

    expect(month.days).toHaveLength(31);
    expect(month.totalCapacity).toBe(1100);
    expect(month.days.some((day) => day.date === '2026-10-15' && day.capacity === 0)).toBe(true);
    expect(month.days.filter((day) => day.dayOfWeek === 0).every((day) => day.capacity === 0)).toBe(true);
    expect(month.days.find((day) => day.date === '2026-10-03').capacity).toBe(45);
    expect(getCapacityForDate({
      date: '2026-10-05',
      professionals: [{ id: 'without-schedule', workSchedule: [] }],
      agendaConfig,
    }).capacity).toBe(0);

    const octoberWithoutBlockedDay = getCapacityForMonth({
      year: 2026,
      month: 10,
      professionals: karehProfessionals,
      agendaConfig,
    });
    expect(octoberWithoutBlockedDay.totalCapacity).toBe(1120);
    expect(octoberWithoutBlockedDay.days.reduce((sum, day) => sum + day.capacity, 0))
      .toBe(octoberWithoutBlockedDay.totalCapacity);

    const operational = calculateOperationalCapacity({
      professionals: karehProfessionals,
      agendaConfig,
      referenceDate: '2026-10-03',
    });
    expect(operational.weeklyCapacity).toBe(250);
    expect(operational.monthlyCapacity).toBe(1120);
    expect(operational.professionals[0].monthlyCapacity).toBe(1120);
  });

  it('reduces October capacity by the holiday date capacity without changing other dates', () => {
    const baseline = getCapacityForMonth({
      year: 2026,
      month: 10,
      professionals: karehProfessionals,
      agendaConfig,
    });
    const withHoliday = getCapacityForMonth({
      year: 2026,
      month: 10,
      professionals: karehProfessionals,
      agendaConfig,
      calendarEntries: [{
        date: '2026-10-12',
        name: 'Feriado de prueba',
        type: 'CLINIC_CLOSURE',
        isActive: true,
        isOperational: false,
      }],
    });

    expect(baseline.totalCapacity).toBe(1120);
    expect(withHoliday.days.find((day) => day.date === '2026-10-12').capacity).toBe(0);
    expect(withHoliday.totalCapacity).toBe(baseline.totalCapacity - 55);
    expect(withHoliday.totalCapacity).toBe(1065);
    expect(withHoliday.days.filter((day) => day.date !== '2026-10-12'))
      .toEqual(baseline.days.filter((day) => day.date !== '2026-10-12'));
  });

  it('reports theoretical and effective daily capacity with the closure reason', async () => {
    const holiday = (await getHolidays(2026)).find((entry) => entry.date === '2026-10-12');
    const result = getEffectiveCapacityForDate({
      date: '2026-10-12',
      professionals: karehProfessionals,
      agendaConfig: { ...agendaConfig, nationalHolidaysClose: true },
      holidays: [holiday],
    });

    expect(result.theoreticalCapacity).toBe(55);
    expect(result.effectiveCapacity).toBe(0);
    expect(result.closureReasons).toEqual([expect.objectContaining({
      type: 'NATIONAL_HOLIDAY',
      name: holiday.name,
    })]);
  });

  it('reports a national holiday closure even when that date has no habitual schedule', async () => {
    const holiday = (await getHolidays(2026)).find((entry) => entry.date === '2026-10-12');
    const result = getEffectiveCapacityForDate({
      date: holiday.date,
      professionals: [{
        ...karehProfessionals[0],
        workSchedule: karehSchedule.filter((entry) => entry.dayOfWeek !== 1),
      }],
      agendaConfig: { ...agendaConfig, nationalHolidaysClose: true },
      holidays: [holiday],
    });

    expect(result.theoreticalCapacity).toBe(0);
    expect(result.effectiveCapacity).toBe(0);
    expect(result.isOperational).toBe(false);
    expect(result.isClosed).toBe(true);
    expect(result.closureReasons).toEqual([expect.objectContaining({ type: 'NATIONAL_HOLIDAY' })]);
  });

  it('does not close the centre automatically on an optional tourism day', async () => {
    const tourismHoliday = (await getHolidays(2026)).find((entry) => entry.type === 'TOURISM_DAY');
    const result = getEffectiveCapacityForDate({
      date: tourismHoliday.date,
      professionals: karehProfessionals,
      agendaConfig: { ...agendaConfig, nationalHolidaysClose: true },
      holidays: [tourismHoliday],
    });

    expect(result.theoreticalCapacity).toBe(result.effectiveCapacity);
    expect(result.isOperational).toBe(true);
  });

  it('honors the generated holiday policy flag when national holidays are configured not to close', async () => {
    const holiday = (await getHolidays(2026, { nationalHolidaysClose: false }))
      .find((entry) => entry.date === '2026-10-12');
    const result = getEffectiveCapacityForDate({
      date: holiday.date,
      professionals: karehProfessionals,
      agendaConfig: { ...agendaConfig, nationalHolidaysClose: false },
      holidays: [holiday],
    });

    expect(result.theoreticalCapacity).toBe(55);
    expect(result.effectiveCapacity).toBe(55);
    expect(result.isOperational).toBe(true);
  });

  it('automatically reduces the October total for public holidays only when configured', async () => {
    const holidays = await getHolidays(2026);
    const closed = getCapacityForMonth({
      year: 2026,
      month: 10,
      professionals: karehProfessionals,
      agendaConfig: { ...agendaConfig, nationalHolidaysClose: true },
      holidays,
    });
    const open = getCapacityForMonth({
      year: 2026,
      month: 10,
      professionals: karehProfessionals,
      agendaConfig: { ...agendaConfig, nationalHolidaysClose: false },
      holidays,
    });

    expect(closed.totalCapacity).toBe(1065);
    expect(closed.days.find((day) => day.date === '2026-10-12').theoreticalCapacity).toBe(55);
    expect(closed.days.find((day) => day.date === '2026-10-12').effectiveCapacity).toBe(0);
    expect(open.totalCapacity).toBe(1120);
  });

  it('removes Saturday capacity for a holiday while retaining historical appointments', () => {
    const day = getCapacityForDate({
      date: '2026-10-03',
      professionals: karehProfessionals,
      agendaConfig,
      calendarEntries: [{
        date: '2026-10-03',
        name: 'Feriado de prueba',
        type: 'CLINIC_CLOSURE',
        isActive: true,
        isOperational: false,
      }],
      appointments: [
        { date: '2026-10-03', status: 'COMPLETED', slotNumber: 1 },
      ],
    });

    expect(day.capacity).toBe(0);
    expect(day.occupied).toBe(1);
    expect(day.attendedCount).toBe(1);
    expect(day.available).toBe(0);
    expect(day.occupancyRate).toBe(0);
  });

  it('lets an active operational schedule exception reopen only its professional scope', () => {
    const professionals = [
      ...karehProfessionals,
      { id: 'prof-2', fullName: 'Otro profesional', workSchedule: karehSchedule },
    ];
    const day = getCapacityForDate({
      date: '2026-10-12',
      professionals,
      agendaConfig: { ...agendaConfig, nationalHolidaysClose: true },
      calendarEntries: [
        {
          date: '2026-10-12',
          name: 'Feriado',
          type: 'CLINIC_CLOSURE',
          isActive: true,
          isOperational: false,
        },
        {
          date: '2026-10-12',
          name: 'Atiende Kareh',
          type: 'SCHEDULE_EXCEPTION',
          professionalId: 'prof-1',
          isActive: true,
          isOperational: true,
        },
      ],
    });

    expect(day.capacity).toBe(55);
    expect(day.slots).toBe(11);
    expect(day.isBlocked).toBe(false);
    expect(day.capacityByProfessional.map((row) => row.capacity)).toEqual([55, 0]);
    expect(day.closureReasons).toEqual([expect.objectContaining({
      type: 'CLINIC_CLOSURE',
      professionalId: null,
    })]);
  });

  it('does not let a global reopening override a more specific professional closure', () => {
    const professionals = [
      ...karehProfessionals,
      { id: 'prof-2', fullName: 'Otro profesional', workSchedule: karehSchedule },
    ];
    const day = getCapacityForDate({
      date: '2026-10-12',
      professionals,
      agendaConfig,
      calendarEntries: [
        {
          date: '2026-10-12',
          name: 'Reapertura general',
          type: 'SCHEDULE_EXCEPTION',
          isActive: true,
          isOperational: true,
        },
        {
          date: '2026-10-12',
          name: 'Cierre de Kareh',
          type: 'CLINIC_CLOSURE',
          professionalId: 'prof-1',
          isActive: true,
          isOperational: false,
        },
      ],
    });

    expect(day.capacity).toBe(55);
    expect(day.slots).toBe(11);
    expect(day.isBlocked).toBe(false);
    expect(day.capacityByProfessional.map((row) => row.capacity)).toEqual([0, 55]);
    expect(day.closureReasons).toEqual([expect.objectContaining({
      type: 'CLINIC_CLOSURE',
      professionalId: 'prof-1',
    })]);
  });

  it('lets a global exceptional opening reopen all scheduled professionals on an official holiday', async () => {
    const professionals = [
      ...karehProfessionals,
      { id: 'prof-2', fullName: 'Otro profesional', workSchedule: karehSchedule },
    ];
    const day = getCapacityForDate({
      date: '2026-10-12',
      professionals,
      agendaConfig,
      calendarEntries: [{
        date: '2026-10-12',
        name: 'Apertura general',
        type: 'SCHEDULE_EXCEPTION',
        isActive: true,
        isOperational: true,
      }],
      holidays: await getHolidays(2026),
    });

    expect(day.theoreticalCapacity).toBe(110);
    expect(day.effectiveCapacity).toBe(110);
    expect(day.capacity).toBe(110);
    expect(day.capacityByProfessional.map((row) => row.capacity)).toEqual([55, 55]);
  });

  it('lets a single explicit reopening override a closure at the same scope', () => {
    const day = getCapacityForDate({
      date: '2026-10-12',
      professionals: karehProfessionals,
      agendaConfig,
      calendarEntries: [
        {
          date: '2026-10-12',
          name: 'Apertura',
          type: 'SCHEDULE_EXCEPTION',
          isActive: true,
          isOperational: true,
        },
        {
          date: '2026-10-12',
          name: 'Cierre',
          type: 'CLINIC_CLOSURE',
          isActive: true,
          isOperational: false,
        },
      ],
    });

    expect(day.capacity).toBe(55);
    expect(day.isBlocked).toBe(false);
  });

  it('fails closed when two schedule exceptions contradict each other at the same scope', () => {
    const day = getCapacityForDate({
      date: '2026-10-12',
      professionals: karehProfessionals,
      agendaConfig,
      calendarEntries: [
        {
          date: '2026-10-12',
          name: 'Apertura',
          type: 'SCHEDULE_EXCEPTION',
          isActive: true,
          isOperational: true,
        },
        {
          date: '2026-10-12',
          name: 'Cierre excepcional',
          type: 'SCHEDULE_EXCEPTION',
          isActive: true,
          isOperational: false,
        },
      ],
    });

    expect(day.capacity).toBe(0);
    expect(day.isBlocked).toBe(true);
  });

  it('enables or disables Saturday from the professional work schedule', () => {
    const professionalsWithoutSaturday = [{
      id: 'prof-without-saturday',
      workSchedule: karehSchedule.filter((item) => item.dayOfWeek !== 6),
    }];
    const enabled = getCapacityForDate({
      date: '2026-10-03',
      professionals: karehProfessionals,
      agendaConfig,
    });
    const disabled = getCapacityForDate({
      date: '2026-10-03',
      professionals: professionalsWithoutSaturday,
      agendaConfig,
    });

    expect(enabled.capacity).toBe(45);
    expect(disabled.capacity).toBe(0);
    expect(getCapacityForWeek({
      startDate: '2026-10-05',
      professionals: professionalsWithoutSaturday,
      agendaConfig,
    }).totalCapacity).toBe(205);
    expect(getCapacityForMonth({
      year: 2026,
      month: 10,
      professionals: professionalsWithoutSaturday,
      agendaConfig,
    }).totalCapacity).toBe(895);
  });

  it('counts appointment rows as occupied patient seats while keeping attendance separate', () => {
    const day = getCapacityForDate({
      date: '2026-10-05',
      professionals: karehProfessionals,
      agendaConfig,
      appointments: [
        { date: '2026-10-05', status: 'SCHEDULED', slotNumber: 1 },
        { date: '2026-10-05', status: 'COMPLETED', slotNumber: 2 },
        { date: '2026-10-05', status: 'NO_SHOW', slotNumber: 3 },
        { date: '2026-10-05', status: 'CANCELLED', slotNumber: 4 },
      ],
    });

    expect(day.capacity).toBe(55);
    expect(day.occupied).toBe(3);
    expect(day.reservedCount).toBe(3);
    expect(day.scheduledCount).toBe(1);
    expect(day.attendedCount).toBe(1);
    expect(day.noShowCount).toBe(1);
    expect(day.attendanceRate).toBe(50);
    expect(day.occupancyRate).toBeCloseTo((3 / 55) * 100);

    const result = calculateOperationalCapacity({
      professionals: karehProfessionals,
      agendaConfig,
      appointments: [
        { date: '2026-10-05', status: 'COMPLETED' },
        { date: '2026-10-05', status: 'SCHEDULED' },
        { date: '2026-10-05', status: 'NO_SHOW' },
        { date: '2026-10-05', status: 'CANCELLED' },
      ],
      referenceDate: '2026-10-05',
    });
    expect(result.occupiedCount).toBe(3);
    expect(result.attendedCount).toBe(1);
    expect(result.noShowCount).toBe(1);
    expect(result.attendanceRate).toBe(50);
  });
});

describe('getScheduleMinutesByDay', () => {
  it('returns zero minutes for invalid or inverted schedule entries', () => {
    expect(getScheduleMinutesByDay([
      { dayOfWeek: 1, startTime: '10:00', endTime: '09:00' },
      { dayOfWeek: 2, startTime: 'bad', endTime: '12:00' },
    ])).toEqual([
      { dayOfWeek: 1, startTime: '10:00', endTime: '09:00', minutes: 0 },
      { dayOfWeek: 2, startTime: 'bad', endTime: '12:00', minutes: 0 },
    ]);
  });
});
