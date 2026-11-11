import { createInternalError, createPublicError } from '../errors/AppError.js';
import { auditActions, safeWriteAuditLog } from '../utils/audit.js';
import { buildProfessionalPatientWhere } from '../utils/accessScope.js';

/**
 * Marca (o desmarca) que el paciente ya se pasó al libro de actas físico,
 * para no copiarlo dos veces.
 */
export const setActaBookStatus = async (req, res, prisma) => {
  const { id } = req.params;
  const { recorded, folio } = req.body;

  try {
    const patient = await prisma.patient.findFirst({
      where: { id, ...buildProfessionalPatientWhere(req.user) },
      select: { id: true, actaBookRecordedAt: true, actaBookFolio: true },
    });
    if (!patient) {
      throw createPublicError(404, 'Paciente no encontrado');
    }

    const data = recorded
      ? {
        // Si ya estaba marcado se conserva la fecha original; solo se corrige el folio.
        actaBookRecordedAt: patient.actaBookRecordedAt || new Date(),
        actaBookFolio: folio || null,
      }
      : { actaBookRecordedAt: null, actaBookFolio: null };

    const updated = await prisma.patient.update({
      where: { id },
      data,
      select: { id: true, actaBookRecordedAt: true, actaBookFolio: true },
    });

    await safeWriteAuditLog(prisma, req, {
      action: auditActions.patientActaBookUpdated,
      resource: 'PATIENT',
      resourceId: id,
      oldValues: { actaBookRecordedAt: patient.actaBookRecordedAt, actaBookFolio: patient.actaBookFolio },
      newValues: { actaBookRecordedAt: updated.actaBookRecordedAt, actaBookFolio: updated.actaBookFolio },
    });

    res.json(updated);
  } catch (error) {
    throw createInternalError(error, 'No se pudo actualizar el libro de actas');
  }
};
