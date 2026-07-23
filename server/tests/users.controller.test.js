import { updateUserRole } from '../src/controllers/users.controller.js';

const createResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('users controller role guard', () => {
  it('prevents admins from changing admin-managed roles outside their scope', async () => {
    const req = {
      params: { id: 'target-user-id' },
      body: { role: 'PROFESSIONAL' },
      user: {
        userId: 'admin-user-id',
        role: 'ADMIN',
      },
    };

    const res = createResponse();
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'target-user-id',
          email: 'super@example.com',
          fullName: 'Super User',
          role: 'SUPER_USER',
          professionalId: null,
          isActive: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          professional: null,
        }),
        update: jest.fn(),
      },
    };

    await updateUserRole(req, res, prisma);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'No autorizado para editar este usuario' });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
