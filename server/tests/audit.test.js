jest.mock('../src/config/logger.js', () => ({
  __esModule: true,
  default: {
    child: jest.fn(() => ({
      error: jest.fn(),
    })),
  },
}));

import { auditActions, safeWriteAuditLog, writeAuditLog } from '../src/utils/audit.js';

const createRequest = () => ({
  user: { userId: 'user-1' },
  headers: {
    'x-forwarded-for': '203.0.113.10',
    'user-agent': 'Jest/1.0',
  },
  ip: '127.0.0.1',
});

const createPrisma = (resolveValue = { id: 'audit-1' }) => ({
  auditLog: {
    create: jest.fn().mockResolvedValue(resolveValue),
  },
});

describe('audit helpers', () => {
  it('exposes canonical audit action constants', () => {
    expect(auditActions.authLoginSucceeded).toBe('AUTH_LOGIN_SUCCEEDED');
    expect(auditActions.obraSocialDeleted).toBe('OBRA_SOCIAL_DELETED');
  });

  it('writes sanitized audit logs with request metadata', async () => {
    const prisma = createPrisma();
    const req = createRequest();

    await expect(writeAuditLog(prisma, req, {
      action: auditActions.patientUpdated,
      entityType: 'patient',
      entityId: 'patient-1',
      oldValues: {
        visible: 'ok',
        otp: '123456',
      },
      newValues: {
        accessToken: 'secret',
        nested: {
          keep: true,
          authorizationFileUrl: 'private',
        },
      },
      details: {
        attachments: ['a.pdf'],
        note: 'visible',
      },
    })).resolves.toEqual({ id: 'audit-1' });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        action: auditActions.patientUpdated,
        entityType: 'patient',
        entityId: 'patient-1',
        oldValues: { visible: 'ok' },
        newValues: { nested: { keep: true } },
        details: { note: 'visible' },
        ipAddress: '203.0.113.10',
        userAgent: 'Jest/1.0',
      },
    });
  });

  it('skips audit writes when required data is missing', async () => {
    const prisma = createPrisma();
    const req = createRequest();

    await expect(writeAuditLog(prisma, req, {
      entityType: 'patient',
      entityId: 'patient-1',
    })).resolves.toBeNull();

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('does not throw if the audit write fails', async () => {
    const prisma = {
      auditLog: {
        create: jest.fn().mockRejectedValue(new Error('boom')),
      },
    };
    const req = createRequest();

    await expect(safeWriteAuditLog(prisma, req, {
      action: auditActions.patientUpdated,
      entityType: 'patient',
      entityId: 'patient-1',
    })).resolves.toBeUndefined();

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });
});
