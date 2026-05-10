// ---------------------------------------------------------
// Obras Sociales Controller (COKIBA)
// ---------------------------------------------------------
import { getCokibaSyncStatus, runCokibaSync } from '../services/cokibaSync.js';
import { auditActions, safeWriteAuditLog } from '../utils/audit.js';

let activeCokibaSync = null;

const parseBoolean = (value, fallbackValue = undefined) => {
  if (value === undefined || value === null || value === '') return fallbackValue;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'si', 'sí', 'yes'].includes(String(value).trim().toLowerCase());
};

const parseRequiredDocuments = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

// 1. LISTAR TODAS LAS OBRAS SOCIALES
export const getObrasSociales = async (req, res, prisma) => {
  const { estado, search, zona, activeOnly, includeInactive, requiresAuthorization } = req.query;
  const where = {};

  if (estado) {
    where.estado = estado;
  }

  if (search) {
    where.nombreOs = { contains: search, mode: 'insensitive' };
  }

  if (zona === 'san-miguel') {
    where.atendibleSanMiguel = true;
  }

  if (activeOnly === '1') {
    where.isActive = true;
  } else if (includeInactive !== '1') {
    const parsedIsActive = parseBoolean(req.query.isActive);
    if (parsedIsActive !== undefined) {
      where.isActive = parsedIsActive;
    }
  }

  const parsedRequiresAuthorization = parseBoolean(requiresAuthorization);
  if (parsedRequiresAuthorization !== undefined) {
    where.requiresAuthorization = parsedRequiresAuthorization;
  }

  try {
    const obrasSociales = await prisma.obraSocial.findMany({
      where,
      orderBy: { nombreOs: 'asc' },
    });

    res.status(200).json(obrasSociales);
  } catch (error) {
    console.error('❌ Error fetching obras sociales:', error);
    res.status(500).json({
      error: 'Error al obtener obras sociales',
      message: error.message,
    });
  }
};

// 2. ESTADO DE SINCRONIZACIÓN COKIBA
export const getObrasSocialesStatus = async (req, res, prisma) => {
  try {
    const status = await getCokibaSyncStatus(prisma);

    res.status(200).json({
      ...status,
      syncing: Boolean(activeCokibaSync),
    });
  } catch (error) {
    console.error('❌ Error fetching COKIBA status:', error);
    res.status(500).json({
      error: 'Error al obtener el estado de sincronización',
      message: error.message,
    });
  }
};

// 3. EJECUTAR SINCRONIZACIÓN COKIBA
export const syncObrasSociales = async (req, res, prisma) => {
  if (activeCokibaSync) {
    return res.status(409).json({
      error: 'Ya hay una sincronización COKIBA en curso',
    });
  }

  try {
    activeCokibaSync = runCokibaSync({ prisma });
    const result = await activeCokibaSync;

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('❌ Error syncing obras sociales:', error);
    const status =
      /credenciales|placeholder/i.test(String(error.message || '')) ? 400 : 500;

    res.status(status).json({
      error: 'No se pudo sincronizar con COKIBA',
      message: error.message,
    });
  } finally {
    activeCokibaSync = null;
  }
};

// 4. OBTENER UNA OBRA SOCIAL POR ID
export const getObraSocial = async (req, res, prisma) => {
  const { id } = req.params;

  try {
    const obraSocial = await prisma.obraSocial.findUnique({
      where: { id },
    });

    if (!obraSocial) {
      return res.status(404).json({ error: 'Obra social no encontrada' });
    }

    res.status(200).json(obraSocial);
  } catch (error) {
    console.error('❌ Error fetching obra social:', error);
    res.status(500).json({
      error: 'Error al obtener obra social',
      message: error.message,
    });
  }
};

// 5. CREAR OBRA SOCIAL MANUALMENTE
export const createObraSocial = async (req, res, prisma) => {
  const {
    codigoCokiba,
    nombreOs,
    coseguroValor,
    honorarioEstimado,
    percentageCoinsurance,
    fixedCopay,
    plazoPago,
    estado,
    isActive,
    requiresAuthorization,
    atendibleSanMiguel,
    requiredDocuments,
    cokibaDetails,
    rawCategoria,
    detectedStatus,
    detectedIsActive,
    statusManualOverride,
  } = req.body;

  if (!nombreOs) {
    return res.status(400).json({ error: 'El nombre de la obra social es obligatorio' });
  }

  try {
    const obraSocial = await prisma.obraSocial.create({
      data: {
        codigoCokiba: codigoCokiba || nombreOs.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10) + '_' + Date.now().toString(36),
        nombreOs,
        coseguroValor: parseFloat(coseguroValor) || 0,
        honorarioEstimado: parseFloat(honorarioEstimado) || 0,
        percentageCoinsurance: parseFloat(percentageCoinsurance) || 0,
        fixedCopay: parseFloat(fixedCopay) || 0,
        plazoPago: parseInt(plazoPago) || 60,
        estado: estado || 'Activa',
        isActive: parseBoolean(isActive, true),
        detectedStatus: detectedStatus || estado || 'Activa',
        detectedIsActive: parseBoolean(detectedIsActive, parseBoolean(isActive, true)),
        statusManualOverride: parseBoolean(statusManualOverride, true),
        requiresAuthorization: parseBoolean(requiresAuthorization, false),
        atendibleSanMiguel: atendibleSanMiguel || false,
        requiredDocuments: parseRequiredDocuments(requiredDocuments),
        cokibaDetails: cokibaDetails && typeof cokibaDetails === 'object' ? cokibaDetails : null,
        rawCategoria: rawCategoria || 'Básica',
        ultimaSync: new Date(),
      },
    });

    await safeWriteAuditLog(prisma, req, {
      action: auditActions.obraSocialCreated,
      resource: 'OBRA_SOCIAL',
      resourceId: obraSocial.id,
      newValues: obraSocial,
    });

    res.status(201).json(obraSocial);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe una obra social con ese código COKIBA' });
    }
    console.error('❌ Error creating obra social:', error);
    res.status(500).json({
      error: 'Error al crear obra social',
      message: error.message,
    });
  }
};

// 6. ACTUALIZAR OBRA SOCIAL
export const updateObraSocial = async (req, res, prisma) => {
  const { id } = req.params;
  const {
    nombreOs,
    coseguroValor,
    honorarioEstimado,
    percentageCoinsurance,
    fixedCopay,
    plazoPago,
    estado,
    isActive,
    requiresAuthorization,
    atendibleSanMiguel,
    requiredDocuments,
    cokibaDetails,
    rawCategoria,
    detectedStatus,
    detectedIsActive,
    statusManualOverride,
  } = req.body;

  const data = {};
  if (nombreOs !== undefined) data.nombreOs = nombreOs;
  if (coseguroValor !== undefined) data.coseguroValor = parseFloat(coseguroValor);
  if (honorarioEstimado !== undefined) data.honorarioEstimado = parseFloat(honorarioEstimado);
  if (percentageCoinsurance !== undefined) data.percentageCoinsurance = parseFloat(percentageCoinsurance) || 0;
  if (fixedCopay !== undefined) data.fixedCopay = parseFloat(fixedCopay) || 0;
  if (plazoPago !== undefined) data.plazoPago = parseInt(plazoPago);
  if (estado !== undefined) data.estado = estado;
  if (isActive !== undefined) data.isActive = parseBoolean(isActive, true);
  if (detectedStatus !== undefined) data.detectedStatus = detectedStatus;
  if (detectedIsActive !== undefined) data.detectedIsActive = parseBoolean(detectedIsActive, true);
  if (requiresAuthorization !== undefined) data.requiresAuthorization = parseBoolean(requiresAuthorization, false);
  if (atendibleSanMiguel !== undefined) data.atendibleSanMiguel = atendibleSanMiguel;
  if (requiredDocuments !== undefined) data.requiredDocuments = parseRequiredDocuments(requiredDocuments);
  if (cokibaDetails !== undefined) data.cokibaDetails = cokibaDetails && typeof cokibaDetails === 'object' ? cokibaDetails : null;
  if (rawCategoria !== undefined) data.rawCategoria = rawCategoria;
  if (statusManualOverride !== undefined) data.statusManualOverride = parseBoolean(statusManualOverride, false);

  try {
    const current = await prisma.obraSocial.findUnique({
      where: { id },
    });

    if (!current) {
      return res.status(404).json({ error: 'Obra social no encontrada' });
    }

    if (statusManualOverride !== undefined && parseBoolean(statusManualOverride, false) === false) {
      data.estado = current.detectedStatus || current.estado;
      data.isActive =
        current.detectedIsActive === null || current.detectedIsActive === undefined
          ? current.isActive
          : current.detectedIsActive;
    } else if (
      statusManualOverride === undefined &&
      (estado !== undefined || isActive !== undefined)
    ) {
      data.statusManualOverride = true;
    }

    const updated = await prisma.obraSocial.update({
      where: { id },
      data,
    });

    await safeWriteAuditLog(prisma, req, {
      action: auditActions.obraSocialUpdated,
      resource: 'OBRA_SOCIAL',
      resourceId: updated.id,
      oldValues: current,
      newValues: updated,
    });

    res.status(200).json(updated);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Obra social no encontrada' });
    }
    console.error('❌ Error updating obra social:', error);
    res.status(500).json({
      error: 'Error al actualizar obra social',
      message: error.message,
    });
  }
};

// 7. ELIMINAR OBRA SOCIAL
export const deleteObraSocial = async (req, res, prisma) => {
  const { id } = req.params;

  try {
    const current = await prisma.obraSocial.findUnique({
      where: { id },
    });

    if (!current) {
      return res.status(404).json({ error: 'Obra social no encontrada' });
    }

    await prisma.obraSocial.delete({
      where: { id },
    });

    await safeWriteAuditLog(prisma, req, {
      action: auditActions.obraSocialDeleted,
      resource: 'OBRA_SOCIAL',
      resourceId: id,
      oldValues: current,
    });

    res.status(200).json({ message: 'Obra social eliminada con éxito' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Obra social no encontrada' });
    }
    console.error('❌ Error deleting obra social:', error);
    res.status(500).json({
      error: 'Error al eliminar obra social',
      message: error.message,
    });
  }
};

// 8. ESTADÍSTICAS RÁPIDAS
export const getObrasSocialesStats = async (req, res, prisma) => {
  try {
    const [total, activas, sanMiguel, requierenAutorizacion] = await Promise.all([
      prisma.obraSocial.count(),
      prisma.obraSocial.count({ where: { isActive: true } }),
      prisma.obraSocial.count({ where: { atendibleSanMiguel: true } }),
      prisma.obraSocial.count({ where: { requiresAuthorization: true } }),
    ]);

    res.status(200).json({ total, activas, sanMiguel, requierenAutorizacion });
  } catch (error) {
    console.error('❌ Error fetching OS stats:', error);
    res.status(500).json({
      error: 'Error al obtener estadísticas',
      message: error.message,
    });
  }
};

export const getCoinsuranceReport = async (req, res, prisma) => {
  try {
    const month = String(req.query.month || '').trim();
    const [year, monthNumber] = month ? month.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
    const start = new Date(year, (monthNumber || 1) - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, monthNumber || 1, 1, 0, 0, 0, 0);

    const appointments = await prisma.appointment.findMany({
      where: {
        date: { gte: start, lt: end },
        obraSocialId: { not: null },
        status: { not: 'CANCELLED' },
      },
      select: {
        patientChargeAmount: true,
        obraSocialId: true,
        obraSocial: {
          select: {
            nombreOs: true,
          },
        },
      },
    });

    const byInsurance = new Map();

    appointments.forEach((appointment) => {
      const key = appointment.obraSocialId || 'sin-obra-social';
      const current = byInsurance.get(key) || {
        obraSocialId: appointment.obraSocialId,
        obraSocialName: appointment.obraSocial?.nombreOs || 'Sin obra social',
        totalAmount: 0,
        appointmentCount: 0,
      };

      current.totalAmount += Number(appointment.patientChargeAmount || 0);
      current.appointmentCount += 1;
      byInsurance.set(key, current);
    });

    const rows = [...byInsurance.values()]
      .map((row) => ({
        ...row,
        totalAmount: Number(row.totalAmount.toFixed(2)),
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    res.status(200).json({
      month: `${year}-${String(monthNumber || 1).padStart(2, '0')}`,
      totalAmount: Number(rows.reduce((sum, row) => sum + row.totalAmount, 0).toFixed(2)),
      rows,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al obtener el reporte de coseguros',
      message: error.message,
    });
  }
};
