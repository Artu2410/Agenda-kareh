import { createInternalError, createPublicError } from '../errors/AppError.js';
import { auditActions, safeWriteAuditLog } from '../utils/audit.js';
import { buildProfessionalPatientWhere, getScopedProfessionalId } from '../utils/accessScope.js';

/**
 * Comprobantes no fiscales: documento interno para el paciente, NO válido como
 * factura ante ARCA. Se completan solos con los datos del paciente; a mano van
 * la descripción, el monto y (opcional) la fecha de emisión.
 */

const receiptSelect = {
  id: true,
  number: true,
  issueDate: true,
  patientId: true,
  professionalId: true,
  description: true,
  amount: true,
  patientName: true,
  patientDni: true,
  coverage: true,
  affiliateNumber: true,
  diagnosis: true,
  professionalName: true,
  professionalLicense: true,
  createdAt: true,
};

const formatLicense = (professional) => {
  if (!professional) return null;
  const parts = [];
  if (professional.licenseNumber) parts.push(`MN ${professional.licenseNumber}`);
  if (professional.licenseNumberMP) parts.push(`MP ${professional.licenseNumberMP}`);
  return parts.join(' / ') || null;
};

const resolveCoverage = (patient) => {
  if (patient.treatAsParticular) return 'Particular';
  return patient.obraSocial?.nombreOs || patient.healthInsurance || 'Particular';
};

export const serializeReceipt = (receipt) => ({
  ...receipt,
  amount: receipt.amount === null || receipt.amount === undefined ? 0 : Number(receipt.amount),
  displayNumber: `0001-${String(receipt.number).padStart(8, '0')}`,
});

// Fecha elegida a mano: a mediodía UTC, así se imprime el mismo día en cualquier zona horaria.
// Sin fecha elegida: el momento exacto en que el servidor emite el comprobante.
const toIssueDate = (value) => (value ? new Date(`${value}T12:00:00Z`) : new Date());

const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires';
const toArgentinaDay = (date) => new Date(date).toLocaleDateString('en-CA', { timeZone: ARGENTINA_TIME_ZONE });

const getLatestReceiptNumber = async (prisma) => {
  const latest = await prisma.patientReceipt.findFirst({ orderBy: { number: 'desc' }, select: { number: true } });
  return latest?.number ?? null;
};

/**
 * Solo se puede eliminar el último comprobante emitido, y solo el mismo día en que
 * se emitió (hora de Argentina). Los números los asigna la secuencia de la base y
 * nunca se reutilizan: si se elimina uno, queda el hueco justificado en la auditoría.
 */
export const isReceiptDeletable = (receipt, latestNumber, now = new Date()) => (
  Boolean(receipt)
  && latestNumber !== null
  && receipt.number === latestNumber
  && Boolean(receipt.createdAt)
  && toArgentinaDay(receipt.createdAt) === toArgentinaDay(now)
);

export const listReceipts = async (req, res, prisma) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
    const scopedProfessionalId = getScopedProfessionalId(req.user);
    const where = {
      ...(req.query.patientId ? { patientId: String(req.query.patientId) } : {}),
      ...(scopedProfessionalId ? { professionalId: scopedProfessionalId } : {}),
    };

    const [receipts, latestNumber] = await Promise.all([
      prisma.patientReceipt.findMany({
        where,
        orderBy: { number: 'desc' },
        take: limit,
        select: receiptSelect,
      }),
      getLatestReceiptNumber(prisma),
    ]);

    res.json(receipts.map((receipt) => ({
      ...serializeReceipt(receipt),
      canDelete: isReceiptDeletable(receipt, latestNumber),
    })));
  } catch (error) {
    throw createInternalError(error, 'No se pudieron obtener los comprobantes');
  }
};

export const createReceipt = async (req, res, prisma) => {
  const { patientId, description, amount, issueDate } = req.body;

  try {
    const scopedProfessionalId = getScopedProfessionalId(req.user);
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, ...buildProfessionalPatientWhere(req.user) },
      select: {
        id: true,
        fullName: true,
        dni: true,
        healthInsurance: true,
        treatAsParticular: true,
        affiliateNumber: true,
        obraSocial: { select: { nombreOs: true } },
        appointments: {
          where: { status: { not: 'CANCELLED' } },
          orderBy: { date: 'desc' },
          take: 20,
          select: { diagnosis: true, professionalId: true },
        },
      },
    });

    if (!patient) {
      throw createPublicError(404, 'Paciente no encontrado');
    }

    // Profesional: el elegido, el propio si es PROFESSIONAL, o el del último turno.
    const lastAppointment = patient.appointments[0];
    const professionalId = scopedProfessionalId
      || req.body.professionalId
      || lastAppointment?.professionalId
      || null;
    const professional = professionalId
      ? await prisma.professional.findUnique({
        where: { id: professionalId },
        select: { id: true, fullName: true, licenseNumber: true, licenseNumberMP: true },
      })
      : null;

    const diagnosis = patient.appointments.find((appointment) => appointment.diagnosis?.trim())?.diagnosis?.trim() || null;

    // El número lo asigna la secuencia de la base (estrictamente creciente).
    const receipt = await prisma.patientReceipt.create({
      data: {
        issueDate: toIssueDate(issueDate),
        patientId: patient.id,
        professionalId: professional?.id || null,
        description,
        amount,
        patientName: patient.fullName,
        patientDni: patient.dni,
        coverage: resolveCoverage(patient),
        affiliateNumber: patient.treatAsParticular ? null : (patient.affiliateNumber || null),
        diagnosis,
        professionalName: professional?.fullName || null,
        professionalLicense: formatLicense(professional),
        createdById: req.user?.userId || null,
      },
      select: receiptSelect,
    });

    await safeWriteAuditLog(prisma, req, {
      action: auditActions.receiptCreated,
      resource: 'PATIENT_RECEIPT',
      resourceId: receipt.id,
      newValues: { number: receipt.number, patientId: receipt.patientId, amount: String(receipt.amount) },
    });

    res.status(201).json({ ...serializeReceipt(receipt), canDelete: true });
  } catch (error) {
    throw createInternalError(error, 'No se pudo emitir el comprobante');
  }
};

export const deleteReceipt = async (req, res, prisma) => {
  try {
    const scopedProfessionalId = getScopedProfessionalId(req.user);
    const receipt = await prisma.patientReceipt.findFirst({
      where: { id: req.params.id, ...(scopedProfessionalId ? { professionalId: scopedProfessionalId } : {}) },
      select: receiptSelect,
    });
    if (!receipt) {
      throw createPublicError(404, 'Comprobante no encontrado');
    }

    if (!isReceiptDeletable(receipt, await getLatestReceiptNumber(prisma))) {
      throw createPublicError(409, 'Solo se puede eliminar el último comprobante emitido y en el mismo día. Los anteriores quedan registrados.');
    }

    await prisma.patientReceipt.delete({ where: { id: receipt.id } });

    await safeWriteAuditLog(prisma, req, {
      action: auditActions.receiptDeleted,
      resource: 'PATIENT_RECEIPT',
      resourceId: receipt.id,
      oldValues: {
        number: receipt.number,
        patientId: receipt.patientId,
        issueDate: receipt.issueDate,
        description: receipt.description,
        amount: String(receipt.amount),
      },
    });

    res.status(204).end();
  } catch (error) {
    throw createInternalError(error, 'No se pudo eliminar el comprobante');
  }
};
