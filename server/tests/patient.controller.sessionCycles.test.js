jest.mock('../src/utils/audit.js', () => ({
  __esModule: true,
  auditActions: {
    appointmentRead: 'APPOINTMENT_READ',
  },
  safeWriteAuditLog: jest.fn().mockResolvedValue(undefined),
}));

import { getSessionCycles } from '../src/controllers/patient.controller.js';

const createResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('patient.controller session cycles', () => {
  it('returns completed and absent sessions using the stored cycle length', async () => {
    const appointments = [
      {
        id: 'apt-1',
        date: new Date('2026-06-01T12:00:00.000Z'),
        time: '10:00',
        slotNumber: 1,
        status: 'COMPLETED',
        cycleId: 'cycle-1',
        sessionNumber: 1,
        isFirstSession: true,
        treatmentCycle: { totalSessions: 5 },
      },
      {
        id: 'apt-2',
        date: new Date('2026-06-03T12:00:00.000Z'),
        time: '10:00',
        slotNumber: 1,
        status: 'COMPLETED',
        cycleId: 'cycle-1',
        sessionNumber: 2,
        isFirstSession: false,
        treatmentCycle: { totalSessions: 5 },
      },
      {
        id: 'apt-3',
        date: new Date('2026-06-05T12:00:00.000Z'),
        time: '10:00',
        slotNumber: 1,
        status: 'NO_SHOW',
        cycleId: 'cycle-1',
        sessionNumber: 3,
        isFirstSession: false,
        treatmentCycle: { totalSessions: 5 },
      },
      {
        id: 'apt-4',
        date: new Date('2026-06-07T12:00:00.000Z'),
        time: '10:00',
        slotNumber: 1,
        status: 'COMPLETED',
        cycleId: 'cycle-1',
        sessionNumber: 4,
        isFirstSession: false,
        treatmentCycle: { totalSessions: 5 },
      },
      {
        id: 'apt-5',
        date: new Date('2026-06-09T12:00:00.000Z'),
        time: '10:00',
        slotNumber: 1,
        status: 'NO_SHOW',
        cycleId: 'cycle-1',
        sessionNumber: 5,
        isFirstSession: false,
        treatmentCycle: { totalSessions: 5 },
      },
    ];

    const prisma = {
      appointment: {
        findMany: jest.fn().mockResolvedValue(appointments),
      },
    };
    const req = {
      params: { patientId: 'pat-1' },
      user: { role: 'ADMIN' },
    };
    const res = createResponse();

    await getSessionCycles(req, res, prisma);

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        patientId: 'pat-1',
      }),
      select: expect.objectContaining({
        cycleId: true,
        treatmentCycle: expect.any(Object),
      }),
    }));
    expect(res.status).toHaveBeenCalledWith(200);

    const payload = res.json.mock.calls[0][0];
    expect(payload).toEqual([
      expect.objectContaining({
        year: 2026,
        totalCompleted: 3,
        completedSessions: 3,
        absentSessions: 2,
        recordedSessions: 5,
        sessionsInCurrentCycle: 0,
        targetSessionsInCurrentCycle: 10,
        cycles: [
          expect.objectContaining({
            targetSessions: 5,
            completedSessions: 3,
            absentSessions: 2,
            pendingSessions: 0,
            isComplete: true,
            sessions: expect.arrayContaining([
              expect.objectContaining({ status: 'NO_SHOW', isAbsent: true }),
              expect.objectContaining({ status: 'COMPLETED', isCompleted: true }),
            ]),
          }),
        ],
        currentCycle: null,
      }),
    ]);
  });
});
