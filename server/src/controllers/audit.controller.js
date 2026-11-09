import { createInternalError } from '../errors/AppError.js';

const auditLogSelect = {
  id: true,
  userId: true,
  action: true,
  entityType: true,
  entityId: true,
  oldValues: true,
  newValues: true,
  details: true,
  ipAddress: true,
  userAgent: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
    },
  },
};

export const listAuditLogs = async (req, res, prisma) => {
  try {
    const {
      action,
      entityType,
      userId,
      dateFrom,
      dateTo,
      limit = 200,
    } = req.query;

    const where = {};

    if (action) where.action = String(action).trim().toUpperCase();
    if (entityType) where.entityType = String(entityType).trim().toUpperCase();
    if (userId) where.userId = String(userId).trim();

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(Number.parseInt(limit, 10) || 100, 1), 500),
      select: auditLogSelect,
    });

    res.json(logs);
  } catch (error) {
    throw createInternalError(error, 'Error al obtener auditoría');
  }
};

const MIN_RETENTION_DAYS = 365;
const DEFAULT_RETENTION_DAYS = 3650; // 10 años, como la historia clínica (Ley 26.529)

export const getAuditRetentionDays = () => Math.max(
  Number.parseInt(process.env.AUDIT_RETENTION_DAYS, 10) || DEFAULT_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
);

/** Borra registros de auditoría más viejos que la retención configurada. */
export const purgeExpiredAuditLogs = async (prisma, now = Date.now()) => {
  const cutoffDate = new Date(now - getAuditRetentionDays() * 24 * 60 * 60 * 1000);
  const result = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoffDate } } });
  return { deletedCount: result.count, cutoffDate };
};

export const cleanupAuditLogs = async (req, res, prisma) => {
  try {
    const olderThanDays = Math.max(Number.parseInt(req.body?.olderThanDays, 10) || 365, 365);
    const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));

    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    res.json({
      success: true,
      deletedCount: result.count,
      cutoffDate,
    });
  } catch (error) {
    throw createInternalError(error, 'Error al limpiar auditoría');
  }
};
