import { getCapacityMetrics } from '../src/controllers/capacity.controller.js';

const createResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('getCapacityMetrics', () => {
  it('computes weekly and monthly capacity from available minutes without multiplying by capacityPerSlot', async () => {
    const prisma = {
      agendaConfig: {
        findFirst: jest.fn().mockResolvedValue({ slotDuration: 30, capacityPerSlot: 5 }),
      },
      professional: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'prof-1',
            fullName: 'Dr. Kareh',
            specialty: 'Kinesiología',
            workSchedule: [
              { dayOfWeek: 1, startTime: '08:00', endTime: '13:00' },
              { dayOfWeek: 2, startTime: '08:00', endTime: '13:00' },
              { dayOfWeek: 3, startTime: '08:00', endTime: '13:00' },
              { dayOfWeek: 4, startTime: '08:00', endTime: '13:00' },
              { dayOfWeek: 5, startTime: '08:00', endTime: '13:00' },
            ],
          },
        ]),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const req = {};
    const res = createResponse();

    await getCapacityMetrics(req, res, prisma);

    const payload = res.json.mock.calls[0][0];

    expect(payload.currentMonth.weeklyCapacity).toBe(50);
    expect(payload.currentMonth.monthlyCapacity).toBe(216.5);
  });
});
