import { safeWriteAuditLog, auditActions } from '../utils/audit.js';
import { canAssignRole, isAdminManagedRole, isSuperUser, normalizeUserRole } from '../utils/roles.js';
import { createInternalError } from '../errors/AppError.js';

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  professionalId: true,
  isActive: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  professional: {
    select: {
      id: true,
      fullName: true,
      specialty: true,
      licenseNumber: true,
      isActive: true,
    },
  },
};

const buildUserListWhere = (currentUser) => {
  if (isSuperUser(currentUser)) return {};

  return {
    role: {
      in: ['PROFESSIONAL', 'SECRETARIA'],
    },
  };
};

const validateUserPayload = (payload, currentUser, { allowExistingRole = false } = {}) => {
  const role = normalizeUserRole(payload?.role || (allowExistingRole ? payload?.currentRole : ''));

  if (payload?.role !== undefined && !canAssignRole(currentUser, role)) {
    const error = new Error('No tienes permiso para asignar ese rol');
    error.statusCode = 403;
    throw error;
  }

  if ((payload?.role !== undefined || role === 'PROFESSIONAL') && role === 'PROFESSIONAL' && !payload?.professionalId) {
    const error = new Error('Debes vincular un profesional para usuarios con rol PROFESSIONAL');
    error.statusCode = 400;
    throw error;
  }

  return role;
};

export const listUsers = async (req, res, prisma) => {
  try {
    const users = await prisma.user.findMany({
      where: buildUserListWhere(req.user),
      orderBy: [
        { role: 'desc' },
        { fullName: 'asc' },
      ],
      select: userSelect,
    });

    res.json(users);
  } catch (error) {
    throw createInternalError(error, 'Error al obtener usuarios');
  }
};

export const createUser = async (req, res, prisma) => {
  try {
    const role = validateUserPayload(req.body, req.user);

    const user = await prisma.user.create({
      data: {
        email: String(req.body.email || '').trim().toLowerCase(),
        fullName: String(req.body.fullName || '').trim(),
        role,
        professionalId: req.body.professionalId || null,
        isActive: req.body.isActive ?? true,
      },
      select: userSelect,
    });

    await safeWriteAuditLog(prisma, req, {
      action: auditActions.userCreated,
      resource: 'USER',
      resourceId: user.id,
      newValues: user,
    });

    res.status(201).json(user);
  } catch (error) {
    throw createInternalError(error, 'Error al crear usuario');
  }
};

export const updateUser = async (req, res, prisma) => {
  const { id } = req.params;

  try {
    const currentUserRecord = await prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!currentUserRecord) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (!isSuperUser(req.user) && !isAdminManagedRole(currentUserRecord.role)) {
      return res.status(403).json({ message: 'No autorizado para editar este usuario' });
    }

    validateUserPayload({
      ...req.body,
      currentRole: currentUserRecord.role,
      role: req.body.role === undefined ? currentUserRecord.role : req.body.role,
    }, req.user, { allowExistingRole: true });

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        email: req.body.email === undefined ? undefined : String(req.body.email || '').trim().toLowerCase(),
        fullName: req.body.fullName === undefined ? undefined : String(req.body.fullName || '').trim(),
        isActive: req.body.isActive,
        professionalId: req.body.professionalId === undefined ? undefined : (req.body.professionalId || null),
      },
      select: userSelect,
    });

    await safeWriteAuditLog(prisma, req, {
      action: auditActions.userUpdated,
      resource: 'USER',
      resourceId: updatedUser.id,
      oldValues: currentUserRecord,
      newValues: updatedUser,
    });

    res.json(updatedUser);
  } catch (error) {
    throw createInternalError(error, 'Error al actualizar usuario');
  }
};

export const updateUserRole = async (req, res, prisma) => {
  const { id } = req.params;

  try {
    if (id === req.user?.userId) {
      return res.status(400).json({ message: 'No puedes cambiar tu propio rol desde esta acción' });
    }

    const currentUserRecord = await prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!currentUserRecord) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (!isSuperUser(req.user) && !isAdminManagedRole(currentUserRecord.role)) {
      return res.status(403).json({ message: 'No autorizado para editar este usuario' });
    }

    const nextRole = validateUserPayload({
      role: req.body.role,
      professionalId: req.body.professionalId ?? currentUserRecord.professionalId,
    }, req.user);

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        role: nextRole,
        professionalId: req.body.professionalId === undefined ? undefined : (req.body.professionalId || null),
      },
      select: userSelect,
    });

    await safeWriteAuditLog(prisma, req, {
      action: auditActions.userRoleChanged,
      resource: 'USER',
      resourceId: updatedUser.id,
      oldValues: currentUserRecord,
      newValues: updatedUser,
    });

    res.json(updatedUser);
  } catch (error) {
    throw createInternalError(error, 'Error al actualizar rol');
  }
};

export const deleteUser = async (req, res, prisma) => {
  const { id } = req.params;

  try {
    if (id === req.user?.userId) {
      return res.status(400).json({ message: 'No puedes eliminar tu propia cuenta' });
    }

    const currentUserRecord = await prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!currentUserRecord) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (!isSuperUser(req.user) && !isAdminManagedRole(currentUserRecord.role)) {
      return res.status(403).json({ message: 'No autorizado para eliminar este usuario' });
    }

    await prisma.user.delete({ where: { id } });

    await safeWriteAuditLog(prisma, req, {
      action: auditActions.userDeleted,
      resource: 'USER',
      resourceId: id,
      oldValues: currentUserRecord,
    });

    res.json({ success: true });
  } catch (error) {
    throw createInternalError(error, 'Error al eliminar usuario');
  }
};
