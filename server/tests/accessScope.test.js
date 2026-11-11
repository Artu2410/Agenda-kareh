import 'express-async-errors';
import express from 'express';
import request from 'supertest';
import {
  assertScopedProfessionalId,
  buildProfessionalPatientWhere,
  getScopedProfessionalId,
  withProfessionalScope,
} from '../src/utils/accessScope.js';
import createReceiptsRoutes from '../src/routes/receipts.routes.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';

const unlinkedProfessional = { userId: 'u9', role: 'PROFESSIONAL', professionalId: null };
const linkedProfessional = { userId: 'u1', role: 'PROFESSIONAL', professionalId: 'pr1' };

describe('professional access scope (fail closed)', () => {
  it('scopes linked professionals to their own professionalId', () => {
    expect(getScopedProfessionalId(linkedProfessional)).toBe('pr1');
    expect(withProfessionalScope(linkedProfessional)).toEqual({ professionalId: 'pr1' });
    expect(buildProfessionalPatientWhere(linkedProfessional)).toEqual({
      OR: [
        { appointments: { some: { professionalId: 'pr1' } } },
        { clinicalHistory: { some: { professionalId: 'pr1' } } },
      ],
    });
  });

  it('does not scope staff roles', () => {
    const secretary = { userId: 'u2', role: 'SECRETARIA' };
    expect(getScopedProfessionalId(secretary)).toBeNull();
    expect(withProfessionalScope(secretary)).toEqual({});
    expect(buildProfessionalPatientWhere(secretary)).toEqual({});
  });

  it('rejects an unlinked professional instead of returning an empty (unrestricted) filter', () => {
    for (const fn of [getScopedProfessionalId, assertScopedProfessionalId, withProfessionalScope, buildProfessionalPatientWhere]) {
      expect(() => fn(unlinkedProfessional)).toThrow(expect.objectContaining({ statusCode: 403 }));
    }
  });

  it('an unlinked professional cannot list or delete other professionals\' receipts', async () => {
    const prisma = {
      patientReceipt: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({ id: 'r1', number: 1 }),
        delete: jest.fn(),
      },
      auditLog: { create: jest.fn() },
    };
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.user = unlinkedProfessional; next(); });
    app.use('/api/receipts', createReceiptsRoutes(prisma));
    app.use(errorHandler);

    await request(app).get('/api/receipts').expect(403);
    await request(app).delete('/api/receipts/r1').expect(403);
    expect(prisma.patientReceipt.findMany).not.toHaveBeenCalled();
    expect(prisma.patientReceipt.delete).not.toHaveBeenCalled();
  });
});
