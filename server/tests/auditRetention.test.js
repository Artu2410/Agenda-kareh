import { getAuditRetentionDays, purgeExpiredAuditLogs } from '../src/controllers/audit.controller.js';
import { findPatientTimeConflict } from '../src/controllers/AppointmentController.js';

describe('audit retention', () => {
  afterEach(() => {
    delete process.env.AUDIT_RETENTION_DAYS;
  });

  it('defaults to 10 years and never goes below 1 year', () => {
    expect(getAuditRetentionDays()).toBe(3650);
    process.env.AUDIT_RETENTION_DAYS = '30';
    expect(getAuditRetentionDays()).toBe(365);
  });

  it('deletes only logs older than the retention window', async () => {
    const prisma = { auditLog: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) } };
    const now = Date.UTC(2026, 10, 9);

    const result = await purgeExpiredAuditLogs(prisma, now);

    expect(result.deletedCount).toBe(3);
    const { createdAt } = prisma.auditLog.deleteMany.mock.calls[0][0].where;
    expect(createdAt.lt.toISOString()).toBe(new Date(now - 3650 * 86_400_000).toISOString());
  });
});

describe('patient time conflict', () => {
  it('looks for active appointments of the same patient at the same date and time', async () => {
    const tx = { appointment: { findFirst: jest.fn().mockResolvedValue({ id: 'a1' }) } };
    const date = new Date(2026, 10, 10, 12);

    const conflict = await findPatientTimeConflict(tx, { patientId: 'p1', date, time: '10:00', excludeId: 'a2' });

    expect(conflict).toEqual({ id: 'a1' });
    expect(tx.appointment.findFirst).toHaveBeenCalledWith({
      where: { patientId: 'p1', date, time: '10:00', status: { not: 'CANCELLED' }, id: { not: 'a2' } },
      select: { id: true },
    });
  });
});
