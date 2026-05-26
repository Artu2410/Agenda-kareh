/**
 * Tests para SessionManager
 */

// Mock logger ANTES de importar SessionManager
jest.mock('../src/config/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import SessionManager from '../src/utils/sessionManager.js';
import jwt from 'jsonwebtoken';

// Mock Prisma
const createMockPrisma = () => ({
  authSession: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
});

describe('SessionManager', () => {
  let sessionManager;
  let mockPrisma;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-very-long-string-at-least-32-characters-long-for-jwt';
    mockPrisma = createMockPrisma();
    sessionManager = new SessionManager(mockPrisma);
    jest.clearAllMocks();
  });

  describe('generateAccessToken', () => {
    it('should generate valid JWT access token', () => {
      const { token } = sessionManager.generateAccessToken('user-123', 'ADMIN');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.userId).toBe('user-123');
      expect(decoded.role).toBe('ADMIN');
      expect(decoded.type).toBe('access');
      expect(decoded.jti).toBeDefined();
    });

    it('should include expiration time', () => {
      const { token } = sessionManager.generateAccessToken('user-123', 'ADMIN', '15m');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate valid JWT refresh token', () => {
      const { token } = sessionManager.generateRefreshToken('user-123');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.userId).toBe('user-123');
      expect(decoded.type).toBe('refresh');
      expect(decoded.jti).toBeDefined();
    });
  });

  describe('createSession', () => {
    it('should create new session in database', async () => {
      const sessionId = 'session-123';
      mockPrisma.authSession.create.mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        refreshTokenHash: 'hashed-token',
      });

      const { refreshToken, sessionId: returnedSessionId } = await sessionManager.createSession(
        'user-123',
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(refreshToken).toBeDefined();
      expect(returnedSessionId).toBe(sessionId);
      expect(mockPrisma.authSession.create).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            action: 'SESSION_CREATED',
          }),
        })
      );
    });

    it('should store hashed refresh token', async () => {
      mockPrisma.authSession.create.mockResolvedValue({
        id: 'session-123',
      });

      await sessionManager.createSession('user-123', '192.168.1.1', 'Mozilla/5.0');

      const createCall = mockPrisma.authSession.create.mock.calls[0][0];
      expect(createCall.data.refreshTokenHash).toBeTruthy();
      expect(createCall.data.refreshTokenHash).not.toContain('refresh-token');
    });
  });

  describe('rotateTokens', () => {
    it('should generate new tokens', async () => {
      const oldSessionId = 'session-123';
      mockPrisma.authSession.findFirst.mockResolvedValue({
        id: oldSessionId,
        userId: 'user-123',
        refreshTokenHash: 'old-hash',
      });

      mockPrisma.authSession.update.mockResolvedValue({
        id: oldSessionId,
      });

      const result = await sessionManager.rotateTokens('user-123', 'old-hash');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(mockPrisma.authSession.update).toHaveBeenCalled();
    });

    it('should throw error for invalid session', async () => {
      mockPrisma.authSession.findFirst.mockResolvedValue(null);

      await expect(sessionManager.rotateTokens('user-123', 'invalid-hash')).rejects.toThrow(
        'Sesión inválida o revocada'
      );
    });

    it('should log token rotation audit event', async () => {
      mockPrisma.authSession.findFirst.mockResolvedValue({
        id: 'session-123',
        userId: 'user-123',
        refreshTokenHash: 'old-hash',
        accessTokenJti: 'old-jti',
      });

      mockPrisma.authSession.update.mockResolvedValue({
        id: 'session-123',
      });

      await sessionManager.rotateTokens('user-123', 'old-hash');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            action: 'TOKEN_ROTATED',
          }),
        })
      );
    });
  });

  describe('revokeSession', () => {
    it('should revoke session', async () => {
      mockPrisma.authSession.update.mockResolvedValue({
        id: 'session-123',
        revokedAt: new Date(),
      });

      await sessionManager.revokeSession('user-123', 'session-123');

      expect(mockPrisma.authSession.update).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
        }),
      });
    });

    it('should log session revocation', async () => {
      mockPrisma.authSession.update.mockResolvedValue({
        id: 'session-123',
        revokedAt: new Date(),
      });

      await sessionManager.revokeSession('user-123', 'session-123');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'SESSION_REVOKED',
          }),
        })
      );
    });
  });

  describe('revokeAllSessions', () => {
    it('should revoke all user sessions', async () => {
      mockPrisma.authSession.updateMany.mockResolvedValue({
        count: 3,
      });

      const result = await sessionManager.revokeAllSessions('user-123', 'Security breach');

      expect(mockPrisma.authSession.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          revokedAt: null,
        },
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
        }),
      });

      expect(result.count).toBe(3);
    });

    it('should log all sessions revocation', async () => {
      mockPrisma.authSession.updateMany.mockResolvedValue({
        count: 3,
      });

      await sessionManager.revokeAllSessions('user-123');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ALL_SESSIONS_REVOKED',
          }),
        })
      );
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions only', async () => {
      const now = new Date();
      const activeSessions = [
        {
          id: 'session-1',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          createdAt: now,
          lastUsedAt: now,
          expiresAt: new Date(now.getTime() + 1000000),
        },
      ];

      mockPrisma.authSession.findMany.mockResolvedValue(activeSessions);

      const result = await sessionManager.getActiveSessions('user-123');

      expect(result).toEqual(activeSessions);
      expect(mockPrisma.authSession.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          revokedAt: null,
          expiresAt: {
            gt: expect.any(Date),
          },
        },
        select: expect.any(Object),
      });
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should delete expired sessions', async () => {
      mockPrisma.authSession.deleteMany.mockResolvedValue({
        count: 5,
      });

      const result = await sessionManager.cleanupExpiredSessions();

      expect(mockPrisma.authSession.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });

      expect(result.count).toBe(5);
    });
  });
});
