import { createInternalError, createPublicError } from '../errors/AppError.js';
import { auditActions, safeWriteAuditLog } from '../utils/audit.js';
import { buildProfessionalPatientWhere, getScopedProfessionalId } from '../utils/accessScope.js';

/**
 * Informes kinésicos guardados en la historia clínica. El cliente arma el
 * informe y lo manda completo en `data`; se guarda tal cual para poder
 * reimprimirlo idéntico más adelante.
 */

const reportListSelect = {
  id: true,
  patientId: true,
  professionalId: true,
  type: true,
  title: true,
  reportDate: true,
  createdAt: true,
  professional: { select: { fullName: true } },
};

const serializeReport = ({ professional, ...report }) => ({
  ...report,
  professionalName: professional?.fullName || null,
});

const findVisiblePatient = (prisma, user, patientId) => prisma.patient.findFirst({
  where: { id: patientId, ...buildProfessionalPatientWhere(user) },
  select: { id: true },
});

export const listReports = async (req, res, prisma) => {
  const patientId = String(req.query.patientId || '').trim();
  if (!patientId) {
    throw createPublicError(400, 'Paciente requerido');
  }

  try {
    const patient = await findVisiblePatient(prisma, req.user, patientId);
    if (!patient) {
      throw createPublicError(404, 'Paciente no encontrado');
    }

    // Incluye `data` para que la HC pueda reimprimir sin otra consulta
    // (abrir la ventana de impresión después de un await la bloquea el navegador).
    const reports = await prisma.patientReport.findMany({
      where: { patientId },
      orderBy: [{ reportDate: 'desc' }, { createdAt: 'desc' }],
      take: 200,
      select: { ...reportListSelect, data: true },
    });

    res.json(reports.map(serializeReport));
  } catch (error) {
    throw createInternalError(error, 'No se pudieron obtener los informes');
  }
};

export const getReport = async (req, res, prisma) => {
  try {
    const report = await prisma.patientReport.findUnique({
      where: { id: req.params.id },
      select: { ...reportListSelect, data: true },
    });

    // Si el paciente no es visible para el usuario, el informe tampoco existe para él.
    const patient = report ? await findVisiblePatient(prisma, req.user, report.patientId) : null;
    if (!report || !patient) {
      throw createPublicError(404, 'Informe no encontrado');
    }

    res.json(serializeReport(report));
  } catch (error) {
    throw createInternalError(error, 'No se pudo obtener el informe');
  }
};

export const createReport = async (req, res, prisma) => {
  const { patientId, type, title, reportDate, data } = req.body;

  try {
    const patient = await findVisiblePatient(prisma, req.user, patientId);
    if (!patient) {
      throw createPublicError(404, 'Paciente no encontrado');
    }

    const professionalId = getScopedProfessionalId(req.user) || req.body.professionalId || null;

    const report = await prisma.patientReport.create({
      data: {
        patientId,
        professionalId,
        type,
        title,
        reportDate,
        data,
        createdById: req.user?.userId || null,
      },
      select: reportListSelect,
    });

    await safeWriteAuditLog(prisma, req, {
      action: auditActions.reportCreated,
      resource: 'PATIENT_REPORT',
      resourceId: report.id,
      newValues: { patientId, type, reportDate: report.reportDate },
    });

    res.status(201).json(serializeReport(report));
  } catch (error) {
    throw createInternalError(error, 'No se pudo guardar el informe');
  }
};
