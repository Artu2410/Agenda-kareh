import {
  calculateOperationalCapacity,
  getScheduleMinutesByDay,
} from '../src/domain/metrics/capacity.service.js';

describe('calculateOperationalCapacity', () => {
  const karehSchedule = [
    { dayOfWeek: 1, startTime: '14:00', endTime: '19:30' },
    { dayOfWeek: 2, startTime: '17:30', endTime: '19:30' },
    { dayOfWeek: 3, startTime: '14:00', endTime: '19:30' },
    { dayOfWeek: 4, startTime: '17:30', endTime: '19:30' },
    { dayOfWeek: 5, startTime: '14:00', endTime: '19:30' },
    { dayOfWeek: 6, startTime: '08:00', endTime: '12:30' },
  ];

  it('calculates the validated Kareh capacity without multiplying by capacityPerSlot', () => {
    const result = calculateOperationalCapacity({
      professionals: [{ id: 'prof-1', fullName: 'Kareh', workSchedule: karehSchedule }],
      agendaConfig: { slotDuration: 30, capacityPerSlot: 5 },
      occupiedCount: 119,
    });

    expect(result.totalAvailableMinutes).toBe(1500);
    expect(result.weeklyCapacity).toBe(50);
    expect(result.monthlyCapacity).toBe(216.5);
    expect(Number(result.occupancyRate.toFixed(2))).toBe(54.97);
    expect(result.freeMonthlyCapacity).toBe(97.5);
    expect(result.capacityPerSlot).toBe(5);
  });

  it('excludes cancelled appointments when deriving the occupancy numerator from appointments', () => {
    const result = calculateOperationalCapacity({
      professionals: [{ id: 'prof-1', fullName: 'Kareh', workSchedule: karehSchedule }],
      agendaConfig: { slotDuration: 30 },
      appointments: [
        { status: 'COMPLETED' },
        { status: 'SCHEDULED' },
        { status: 'NO_SHOW' },
        { status: 'CANCELLED' },
      ],
    });

    expect(result.occupiedCount).toBe(3);
    expect(Number(result.occupancyRate.toFixed(2))).toBe(1.39);
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
