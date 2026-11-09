import jwt from 'jsonwebtoken';
import { authMiddleware } from '../src/middlewares/authMiddleware.js';

const SECRET = '12345678901234567890123456789012';

const buildToken = () => jwt.sign(
  { sub: 'user-1', sid: 'session-1', type: 'access' },
  SECRET,
  { jwtid: 'jti-1', expiresIn: '15m' },
);

const buildPrisma = (sessionOverrides = {}) => ({
  authSession: {
    findUnique: jest.fn().mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      accessTokenJti: 'jti-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      lastUsedAt: new Date(),
      user: { id: 'user-1', email: 'a@kareh.com', role: 'ADMIN', isActive: true },
      ...sessionOverrides,
    }),
    update: jest.fn().mockResolvedValue({}),
  },
});

const run = async (prisma) => {
  const req = { headers: { authorization: `Bearer ${buildToken()}` }, cookies: {}, prisma, originalUrl: '/api/x' };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  const next = jest.fn();
  await authMiddleware(req, res, next);
  return { req, res, next };
};

describe('authMiddleware', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
  });

  it('validates the session with a single query and skips recent lastUsedAt updates', async () => {
    const prisma = buildPrisma();
    const { next, req } = await run(prisma);

    expect(next).toHaveBeenCalled();
    expect(req.user.userId).toBe('user-1');
    expect(prisma.authSession.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.authSession.update).not.toHaveBeenCalled();
  });

  it('refreshes lastUsedAt when it is older than five minutes', async () => {
    const prisma = buildPrisma({ lastUsedAt: new Date(Date.now() - 10 * 60_000) });
    const { next } = await run(prisma);

    expect(next).toHaveBeenCalled();
    expect(prisma.authSession.update).toHaveBeenCalledTimes(1);
  });

  it('rejects revoked sessions', async () => {
    const prisma = buildPrisma({ revokedAt: new Date() });
    const { next, res } = await run(prisma);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
