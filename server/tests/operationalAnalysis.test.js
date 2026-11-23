import {
  buildAdminAssessment,
  buildBottleneck,
  buildFutureAgenda,
  buildKinesiologistAssessment,
  buildPatientBreakdown,
  buildPeriodBreakdown,
  buildSlotSaturation,
  buildWeeklySaturation,
  getOperationalStatus,
  getSustainedGrowth,
} from '../src/domain/metrics/operationalAnalysis.js';
import { getCapacityForDate, getCapacityForMonth, getCapacityForWeek } from '../src/domain/metrics/capacity.service.js';
import { getCapacityMetrics } from '../src/controllers/capacity.controller.js';

const KAREH_SCHEDULE = [
  { dayOfWeek: 1, startTime: '14:00', endTime: '19:30' },
  { dayOfWeek: 2, startTime: '17:30', endTime: '19:30' },
  { dayOfWeek: 3, startTime: '14:00', endTime: '19:30' },
  { dayOfWeek: 4, startTime: '17:30', endTime: '19:30' },
  { dayOfWeek: 5, startTime: '14:00', endTime: '19:30' },
  { dayOfWeek: 6, startTime: '08:00', endTime: '12:30' },
];
const professionals = [{ id: 'prof-1', fullName: 'Kareh', workSchedule: KAREH_SCHEDULE }];
const config = { slotDuration: 30, capacityPerSlot: 5, nationalHolidaysClose: false };
const NOW = new Date(2026, 10, 22, 12); // domingo 22/11/2026
const appt = (day, status, patientId = 'p1', time = '14:00', month = 10) => ({
  date: new Date(2026, month, day, 0), status, patientId, time, professionalId: 'prof-1',
});
const holiday = (date) => ({
  id: date, date, name: 'Feriado', type: 'PUBLIC_HOLIDAY', isActive: true, isOperational: false, professionalId: null,
});

describe('capacidad: semana y mes desde el calendario real', () => {
  it('semana estándar de Kareh = 250 y semana con lunes feriado = 195', () => {
    const standard = getCapacityForWeek({ startDate: new Date(2026, 10, 15), professionals, agendaConfig: config });
    const withHoliday = getCapacityForWeek({
      startDate: new Date(2026, 10, 22), professionals, agendaConfig: config, calendarEntries: [holiday('2026-11-23')],
    });
    expect(standard.totalCapacity).toBe(250);
    expect(withHoliday.totalCapacity).toBe(195);
    expect(withHoliday.theoreticalCapacity).toBe(250);
  });

  it('noviembre 2026 = 1.055 teóricos; con dos cierres de 55 queda en 945 (no es semana × 4)', () => {
    const open = getCapacityForMonth({ year: 2026, month: 11, professionals, agendaConfig: config });
    const closed = getCapacityForMonth({
      year: 2026, month: 11, professionals, agendaConfig: config,
      calendarEntries: [holiday('2026-11-23'), holiday('2026-11-27')],
    });
    expect(open.totalCapacity).toBe(1055);
    expect(closed.totalCapacity).toBe(945);
    expect(closed.totalCapacity).not.toBe(195 * 4);
  });

  it.each([
    [2026, 2, 28], [2028, 2, 29], [2026, 4, 30], [2026, 3, 31],
  ])('recorre todos los días del mes %i-%i (%i días)', (year, month, length) => {
    expect(getCapacityForMonth({ year, month, professionals, agendaConfig: config }).days).toHaveLength(length);
  });

  it('la excepción operativa reabre un feriado y la duración de 60 min reduce franjas', () => {
    const reopened = getCapacityForDate({
      date: '2026-11-23', professionals, agendaConfig: config,
      calendarEntries: [holiday('2026-11-23'), { ...holiday('2026-11-23'), id: 'x', type: 'SCHEDULE_EXCEPTION', isOperational: true }],
    });
    expect(reopened.capacity).toBe(55);
    const sixty = getCapacityForDate({ date: '2026-11-16', professionals, agendaConfig: { ...config, slotDuration: 60 } });
    expect(sixty.capacity).toBe(25); // 14:00–19:30 → 5 franjas de 60 × 5
  });

  it('capacidad cero sin horarios', () => {
    const empty = getCapacityForMonth({ year: 2026, month: 11, professionals: [], agendaConfig: config });
    expect(empty.totalCapacity).toBe(0);
    expect(empty.occupancyRate).toBe(0);
  });
});

describe('buildPeriodBreakdown: conciliación por estado', () => {
  const appointments = [
    appt(10, 'COMPLETED'), appt(11, 'COMPLETED'),
    appt(12, 'NO_SHOW'),
    appt(13, 'SCHEDULED'), // pasado sin cerrar
    appt(22, 'SCHEDULED'), appt(25, 'SCHEDULED'), // hoy y futuro
    appt(14, 'CANCELLED'),
  ];

  it('separa asistidos, inasistencias, pendientes sin cerrar, próximos y cancelados', () => {
    const b = buildPeriodBreakdown({ appointments, capacity: 945, now: NOW });
    expect(b).toEqual(expect.objectContaining({
      attended: 2, noShow: 1, pendingPast: 1, upcoming: 2, cancelled: 1, reserved: 6, free: 939,
    }));
    expect(b.attended + b.noShow + b.pendingPast + b.upcoming + b.otherStatus).toBe(b.reserved);
    expect(b.reserved + b.free).toBe(b.capacity);
    expect(b.occupancyRate).toBe(0.6);
    expect(b.attendanceRate).toBe(66.7);
    expect(b.unclosedRate).toBe(25);
  });

  it('caso noviembre: 133 reservados − 89 asistidos = 44 explicados por estado', () => {
    const rows = [
      ...Array.from({ length: 89 }, () => appt(5, 'COMPLETED')),
      ...Array.from({ length: 6 }, () => appt(6, 'NO_SHOW')),
      ...Array.from({ length: 10 }, () => appt(18, 'SCHEDULED')),
      ...Array.from({ length: 28 }, () => appt(26, 'SCHEDULED')),
    ];
    const b = buildPeriodBreakdown({ appointments: rows, capacity: 945, now: NOW });
    expect(b.reserved).toBe(133);
    expect(b.reserved - b.attended).toBe(b.noShow + b.pendingPast + b.upcoming);
    expect(b.free).toBe(812);
    expect(b.occupancyRate).toBe(14.1);
  });

  it('los turnos con autorización en trámite son pendientes, no "otros estados"', () => {
    const b = buildPeriodBreakdown({
      appointments: [appt(10, 'PENDING_AUTHORIZATION'), appt(25, 'AUTHORIZED'), appt(26, 'REJECTED')],
      capacity: 10,
      now: NOW,
    });
    expect(b).toEqual(expect.objectContaining({ pendingPast: 1, upcoming: 2, otherStatus: 0, authorizationAttention: 2 }));
  });

  it('ocupación cero y capacidad cero no dividen por cero', () => {
    expect(buildPeriodBreakdown({ appointments: [], capacity: 0, now: NOW })).toEqual(expect.objectContaining({
      occupancyRate: 0, attendanceRate: null, free: 0,
    }));
  });

  it('marca sobreocupación cuando hay más turnos que capacidad', () => {
    const b = buildPeriodBreakdown({ appointments: [appt(10, 'COMPLETED'), appt(11, 'COMPLETED')], capacity: 1, now: NOW });
    expect(b.overbooked).toBe(1);
    expect(b.free).toBe(0);
  });

  it('un turno reprogramado (fecha actualizada) se cuenta una sola vez', () => {
    const moved = { ...appt(10, 'SCHEDULED') };
    moved.date = new Date(2026, 10, 27);
    expect(buildPeriodBreakdown({ appointments: [moved], capacity: 10, now: NOW }).reserved).toBe(1);
  });
});

describe('buildPatientBreakdown', () => {
  it('deduplica por identificador y separa nuevos, recurrentes y sin próximo turno', () => {
    const month = [appt(3, 'COMPLETED', 'a'), appt(4, 'COMPLETED', 'a'), appt(5, 'SCHEDULED', 'b'), appt(6, 'CANCELLED', 'c')];
    const history = [appt(10, 'COMPLETED', 'a', '14:00', 9), ...month];
    const result = buildPatientBreakdown({
      monthAppointments: month,
      futureAppointments: [appt(28, 'SCHEDULED', 'b')],
      historicalAppointments: history,
      monthStart: new Date(2026, 10, 1),
    });
    expect(result).toEqual({
      active: 2, attendedThisMonth: 1, withUpcoming: 1, newThisMonth: 1, recurrentThisMonth: 1, activeWithoutUpcoming: 1,
    });
  });
});

describe('buildFutureAgenda', () => {
  it('distingue días calendario hasta el último turno de días con turnos', () => {
    const agenda = buildFutureAgenda({
      futureAppointments: [appt(23, 'SCHEDULED'), appt(23, 'SCHEDULED', 'p2'), { ...appt(29, 'SCHEDULED'), date: new Date(2026, 11, 29) }],
      now: NOW,
      getDayCapacity: () => 10,
    });
    expect(agenda.calendarDaysToLastAppointment).toBe(37);
    expect(agenda.daysWithAppointments).toBe(2);
    expect(agenda.weeksWithAppointments).toBe(2);
    expect(agenda.patientCount).toBe(2);
    expect(agenda.window).toEqual({ days: 60, capacity: 600, reserved: 3, occupancyRate: 0.5 });
  });

  it('sin turnos futuros y sin capacidad devuelve "no disponible"', () => {
    const agenda = buildFutureAgenda({ futureAppointments: [], now: NOW });
    expect(agenda.lastAppointmentDate).toBeNull();
    expect(agenda.window.occupancyRate).toBeNull();
  });
});

describe('buildSlotSaturation', () => {
  const days = Array.from({ length: 28 }, (_, i) => getCapacityForDate({
    date: new Date(2026, 9, 25 + i), professionals, agendaConfig: config,
  }));

  it('detecta una franja saturada aunque la ocupación global sea baja', () => {
    const tuesdays = days.filter((d) => d.dayOfWeek === 2).map((d) => new Date(`${d.date}T00:00:00`));
    const appointments = tuesdays.flatMap((date) => Array.from({ length: 5 }, () => ({ date, time: '17:30', status: 'SCHEDULED' })));
    const result = buildSlotSaturation({ days, appointments, professionals, slotDuration: 30, capacityPerSlot: 5 });
    expect(result.saturatedSlotCount).toBe(1);
    expect(result.topSlots[0]).toEqual(expect.objectContaining({ dayOfWeek: 2, time: '17:30', occupancyRate: 100 }));
    expect(result.byDayOfWeek.find((d) => d.dayOfWeek === 2).occupancyRate).toBe(25);
  });

  it('una saturación puntual (menos de 4 ocurrencias) no cuenta', () => {
    const date = new Date(`${days.find((d) => d.dayOfWeek === 2).date}T00:00:00`);
    const appointments = Array.from({ length: 5 }, () => ({ date, time: '17:30', status: 'SCHEDULED' }));
    const shortWindow = days.slice(0, 7);
    expect(buildSlotSaturation({ days: shortWindow, appointments, professionals, slotDuration: 30, capacityPerSlot: 5 }).saturatedSlotCount).toBe(0);
  });
});

describe('recomendaciones', () => {
  const breakdown = buildPeriodBreakdown({
    appointments: Array.from({ length: 133 }, () => appt(5, 'COMPLETED')), capacity: 945, now: NOW,
  });
  const patients = { active: 28, newThisMonth: 4 };
  const noSaturation = { saturatedSlotCount: 0, slotCount: 50, saturatedShare: 0 };

  it('secretaría: con volumen alto pero sin datos de necesidad no recomienda contratar', () => {
    const admin = buildAdminAssessment({ breakdown, patients });
    expect(admin.recommended).toBe(false);
    expect(admin.status).toBe('INSUFFICIENT_DATA');
    expect(admin.volumeLevel).toBe('MEDIUM');
    expect(admin.need.every((item) => item.measured === false)).toBe(true);
  });

  it('segundo kinesiólogo: exige los 3 criterios', () => {
    const base = { occupancyRate: 90, futureOccupancyRate: 90, sustainedGrowth: true, saturation: noSaturation };
    expect(buildKinesiologistAssessment(base).recommended).toBe(true);
    expect(buildKinesiologistAssessment({ ...base, futureOccupancyRate: null }).recommended).toBe(false);
    expect(buildKinesiologistAssessment({ ...base, occupancyRate: 14.1 }).metCount).toBe(2);
  });

  it('crecimiento sostenido usa meses cerrados', () => {
    expect(getSustainedGrowth([{ attendedCount: 149 }, { attendedCount: 159 }, { attendedCount: 125 }])).toBe(false);
    expect(getSustainedGrowth([{ attendedCount: 100 }, { attendedCount: 110 }, { attendedCount: 120 }])).toBe(true);
  });

  it('estado operativo y cuello de botella no se contradicen', () => {
    const status = getOperationalStatus({ capacity: 945, occupancyRate: 14.1, unclosedRate: 0, saturation: noSaturation, sustainedGrowth: false });
    const bottleneck = buildBottleneck({ capacity: 945, occupancyRate: 14.1, saturation: noSaturation });
    expect(status.key).toBe('AVAILABLE_CAPACITY');
    expect(bottleneck.key).toBe('DEMAND');
    expect(getOperationalStatus({ capacity: 945, occupancyRate: 14.1, unclosedRate: 40, saturation: noSaturation }).key).toBe('INSUFFICIENT_DATA');
    expect(getOperationalStatus({ capacity: 0, occupancyRate: 0, unclosedRate: 0, saturation: noSaturation }).key).toBe('INSUFFICIENT_DATA');
    expect(getOperationalStatus({ capacity: 945, occupancyRate: 90, unclosedRate: 0, saturation: noSaturation }).key).toBe('GENERAL_SATURATION');
  });
});

describe('GET /capacity: noviembre en curso', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('reconcilia el mes, excluye cancelados y no recomienda contratar sin datos', async () => {
    const appointments = [
      appt(9, 'COMPLETED', 'a'), appt(10, 'NO_SHOW', 'b'), appt(11, 'SCHEDULED', 'c'),
      appt(25, 'SCHEDULED', 'a'), appt(12, 'CANCELLED', 'd'),
    ];
    const prisma = {
      agendaConfig: { findFirst: jest.fn().mockResolvedValue(config) },
      professional: { findMany: jest.fn().mockResolvedValue(professionals) },
      appointment: { findMany: jest.fn().mockResolvedValue(appointments) },
      agendaCalendarEntry: { findMany: jest.fn().mockResolvedValue([holiday('2026-11-23')]) },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await getCapacityMetrics({}, res, prisma);
    const payload = res.json.mock.calls[0][0];

    expect(payload.currentWeek.capacity).toBe(195);
    expect(payload.currentWeek.standardCapacity).toBe(250);
    expect(payload.currentWeek.closures).toEqual([expect.objectContaining({ date: '2026-11-23', lostCapacity: 55 })]);
    expect(payload.currentMonth.monthlyCapacity).toBe(1000);
    expect(payload.currentMonth.breakdown).toEqual(expect.objectContaining({
      reserved: 4, attended: 1, noShow: 1, pendingPast: 1, upcoming: 1, cancelled: 1, free: 996,
    }));
    expect(payload.currentMonth.occupiedCount).toBe(4);
    expect(payload.currentMonth.activePatients).toBe(3);
    expect(payload.currentMonth.isPartial).toBe(true);
    expect(payload.monthlyTrend.at(-1)).toEqual(expect.objectContaining({ isCurrentMonth: true, occupiedCount: 4 }));
    expect(payload.alerts.admin.recommended).toBe(false);
    expect(payload.bottleneck.key).not.toBe('ADMINISTRATION');
    expect(payload.operationalStatus.key).toBe('INSUFFICIENT_DATA'); // 1 de 3 turnos pasados sin cerrar
    expect(payload.definitions.occupancy).toMatch(/lugares de turno/);
  });
});

describe('buildWeeklySaturation', () => {
  it('arma una semana por entrada con % y pacientes citados por día', () => {
    const getWeekDays = (weekStart) => Array.from({ length: 7 }, (_, index) => getCapacityForDate({
      date: new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + index),
      professionals,
      agendaConfig: config,
      calendarEntries: [holiday('2026-11-23')],
    }));
    const appointments = [
      { date: new Date(2026, 10, 24), time: '17:30', status: 'COMPLETED', patientId: 'a' },
      { date: new Date(2026, 10, 24), time: '18:00', status: 'SCHEDULED', patientId: 'b' },
      { date: new Date(2026, 10, 24), time: '18:00', status: 'CANCELLED', patientId: 'c' },
      { date: new Date(2026, 10, 17), time: '17:30', status: 'COMPLETED', patientId: 'a' },
    ];
    const weeks = buildWeeklySaturation({
      now: NOW, weeksBack: 1, weeksAhead: 1, getWeekDays, appointments, professionals, slotDuration: 30, capacityPerSlot: 5,
    });

    expect(weeks.map((week) => week.weekStart)).toEqual(['2026-11-15', '2026-11-22', '2026-11-29']);
    const current = weeks[1];
    expect(current).toEqual(expect.objectContaining({ isCurrent: true, capacity: 195, reserved: 2, patients: 2 }));
    expect(current.closedDays).toEqual(['2026-11-23']);
    const tuesday = current.days.find((day) => day.dayOfWeek === 2);
    expect(tuesday).toEqual(expect.objectContaining({ date: '2026-11-24', reserved: 2, patients: 2, capacity: 20, occupancyRate: 10 }));
    expect(weeks[0].patients).toBe(1);
  });
});

describe('buildKinesiologistAssessment con el tope por kinesiólogo', () => {
  const base = {
    occupancyRate: 20,
    futureOccupancyRate: 10,
    sustainedGrowth: false,
    saturation: { saturatedSlotCount: 0, slotCount: 11, saturatedShare: 0 },
  };
  const loadRule = { maxPerDay: 27, maxPerWeek: 162 };

  it('superar 27 por día recomienda llamar otro kine aunque la ocupación sea baja', () => {
    const result = buildKinesiologistAssessment({ ...base, loadRule, weeklyLoad: { maxDay: 28, maxWeek: 100 } });
    expect(result.recommended).toBe(true);
    expect(result.loadExceeded).toBe(true);
    expect(result.label).toMatch(/Llamar otro kinesiólogo/);
    expect(result.criteria[0]).toMatchObject({ key: 'kine_load', met: true });
  });

  it('superar 162 por semana también dispara la alerta', () => {
    const result = buildKinesiologistAssessment({ ...base, loadRule, weeklyLoad: { maxDay: 27, maxWeek: 163 } });
    expect(result.loadExceeded).toBe(true);
  });

  it('dentro del tope sigue en observación', () => {
    const result = buildKinesiologistAssessment({ ...base, loadRule, weeklyLoad: { maxDay: 27, maxWeek: 162 } });
    expect(result.recommended).toBe(false);
    expect(result.label).toMatch(/en observación/);
  });
});
