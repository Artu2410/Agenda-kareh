import { createInternalError, createPublicError } from '../errors/AppError.js';
import { auditActions, safeWriteAuditLog } from '../utils/audit.js';
import { buildProfessionalPatientWhere, getScopedProfessionalId } from '../utils/accessScope.js';

/**
 * Comprobantes no fiscales: documento interno para el paciente, NO válido como
 * factura ante ARCA. Se completan solos con los datos del paciente; a mano solo
 * van la descripción y el monto.
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

export const listReceipts = async (req, res, prisma) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
    const scopedProfessionalId = getScopedProfessionalId(req.user);
    const where = {
      ...(req.query.patientId ? { patientId: String(req.query.patientId) } : {}),
      ...(scopedProfessionalId ? { professionalId: scopedProfessionalId } : {}),
    };

    const receipts = await prisma.patientReceipt.findMany({
      where,
      orderBy: { number: 'desc' },
      take: limit,
      select: receiptSelect,
    });

    res.json(receipts.map(serializeReceipt));
  } catch (error) {
    throw createInternalError(error, 'No se pudieron obtener los comprobantes');
  }
};

export const createReceipt = async (req, res, prisma) => {
  const { patientId, description, amount } = req.body;

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

    const receipt = await prisma.patientReceipt.create({
      data: {
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

    res.status(201).json(serializeReceipt(receipt));
  } catch (error) {
    throw createInternalError(error, 'No se pudo emitir el comprobante');
  }
};
