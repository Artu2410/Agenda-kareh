import { startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { uploadBufferToStorage } from '../services/storage.js';
import { buildTicketPdf } from '../services/ticketPdf.js';
import { uploadMedia, sendDocumentMessage, sendImageMessage, sendTemplateMessage } from '../services/whatsapp.js';
import { sendWhatsAppTicketForAppointment } from '../services/whatsappTicket.js';
import { enqueueSendWhatsAppTicket } from '../jobs/sendWhatsAppTicketJob.js';
import {
  appointmentBaseSelect,
  appointmentSelect,
  appointmentWithProfessionalSelect,
  patientIdSelect,
  patientSelect,
  professionalSelect,
} from '../prisma/selects.js';
import { sendNotificationToEmails } from '../services/pushNotifications.js';
import { withProfessionalScope, assertScopedProfessionalId } from '../utils/accessScope.js';
import { calculatePatientCharge, buildDocumentChecklist, isInactiveInsurance } from '../utils/insurance.js';
import { buildStoredFinancialSnapshot } from '../utils/appointmentFinancialSnapshot.js';
import { normalizePhone } from '../utils/phone.js';
import { auditActions, safeWriteAuditLog } from '../utils/audit.js';
import logger from '../config/logger.js';
import { createInternalError, createPublicError } from '../errors/AppError.js';

// Helper para evitar corrimientos de fecha por zona horaria.
// Si la fecha viene en formato 'YYYY-MM-DD' la dejamos a mediodía local (12:00)
// para prevenir que al serializar/interpretar en UTC aparezca el día anterior.
const parseDateAvoidTZ = (d) => {
  if (!d) return null;
  try {
    if (typeof d === 'string') {
      // Fecha sólo (YYYY-MM-DD)
      const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const da = Number(m[3]);
        return new Date(y, mo - 1, da, 12, 0, 0);
      }
      // Si viene en formato ISO pero a medianoche UTC (p.e. "YYYY-MM-DDT00:00:00Z"),
      // lo tratamos también como fecha-only para evitar corrimientos por zona horaria.
      const isoMidnight = d.match(/^(\d{4})-(\d{2})-(\d{2})T00:00:00(?:\.000)?(?:Z|\+00:00)$/);
      if (isoMidnight) {
        const y = Number(isoMidnight[1]);
        const mo = Number(isoMidnight[2]);
        const da = Number(isoMidnight[3]);
        return new Date(y, mo - 1, da, 12, 0, 0);
      }
      // En otros casos, usar Date normal
      return new Date(d);
    }
    if (d instanceof Date) return d;
    return new Date(d);
  } catch (e) {
    return null;
  }
};

const UNKNOWN_BIRTHDATE = new Date(1900, 0, 1, 12, 0, 0);

const normalizeBirthDateOrUnknown = (d) => {
  if (!d) return UNKNOWN_BIRTHDATE;
  const parsed = parseDateAvoidTZ(d);
  return parsed || UNKNOWN_BIRTHDATE;
};

const mergeWhereClauses = (...clauses) => {
  const filtered = clauses.filter((clause) => clause && Object.keys(clause).length > 0);

  if (filtered.length === 0) return {};
  if (filtered.length === 1) return filtered[0];

  return { AND: filtered };
};

const ensureAppointmentScope = (req, professionalId) => {
  if (String(req.user?.role || '').toUpperCase() !== 'PROFESSIONAL') {
    return professionalId;
  }

  const scopedProfessionalId = assertScopedProfessionalId(req.user);
  if (professionalId && professionalId !== scopedProfessionalId) {
    const error = new Error('No puedes operar turnos de otro profesional');
    error.statusCode = 403;
    throw error;
  }

  return scopedProfessionalId;
};

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const resolvePatientInsurancePayload = async (tx, payload = {}) => {
  const normalizedObraSocialId = payload.obraSocialId === '' ? null : payload.obraSocialId;
  const treatAsParticular = payload.treatAsParticular === undefined ? false : Boolean(payload.treatAsParticular);

  if (!normalizedObraSocialId) {
    return {
      obraSocialId: null,
      healthInsurance: payload.healthInsurance || null,
      treatAsParticular,
    };
  }

  const obraSocial = await tx.obraSocial.findUnique({
    where: { id: normalizedObraSocialId },
    select: {
      id: true,
      nombreOs: true,
      isArchived: true,
      isActive: true,
      requiresAuthorization: true,
      requiredDocuments: true,
      coseguroValor: true,
      honorarioEstimado: true,
      percentageCoinsurance: true,
      fixedCopay: true,
    },
  });

  if (!obraSocial || obraSocial.isArchived) {
    if (treatAsParticular) {
      return {
        obraSocialId: null,
        obraSocial: null,
        healthInsurance: payload.healthInsurance || 'PARTICULAR',
        treatAsParticular: true,
      };
    }
    const error = new Error('La obra social seleccionada no existe');
    error.statusCode = 400;
    throw error;
  }

  return {
    obraSocialId: obraSocial.id,
    obraSocial,
    healthInsurance: obraSocial.nombreOs,
    treatAsParticular,
  };
};

const normalizeInsuranceValue = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return value;

  const trimmedValue = value.trim();
  return trimmedValue === '' ? null : trimmedValue;
};

const hasInsurancePayloadChanged = (currentPatient = {}, payload = {}) => {
  const currentObraSocialId = normalizeInsuranceValue(currentPatient.obraSocialId);
  const nextObraSocialId = normalizeInsuranceValue(payload.obraSocialId);
  const currentHealthInsurance = normalizeInsuranceValue(currentPatient.healthInsurance);
  const nextHealthInsurance = normalizeInsuranceValue(payload.healthInsurance);
  const currentTreatAsParticular = Boolean(currentPatient.treatAsParticular);
  const nextTreatAsParticular = payload.treatAsParticular === undefined
    ? currentTreatAsParticular
    : Boolean(payload.treatAsParticular);

  const obraSocialChanged = nextObraSocialId !== null && nextObraSocialId !== currentObraSocialId;
  const healthInsuranceChanged = nextHealthInsurance !== null && nextHealthInsurance !== currentHealthInsurance;
  const treatAsParticularChanged = nextTreatAsParticular !== currentTreatAsParticular;

  return obraSocialChanged || healthInsuranceChanged || treatAsParticularChanged;
};

const getAppointmentInsuranceContext = async (tx, patient, payload = {}) => {
  const treatAsParticular = Boolean(payload.treatAsParticular ?? patient?.treatAsParticular);
  const requestedObraSocialId = payload.obraSocialId === undefined ? patient?.obraSocialId : payload.obraSocialId;
  const explicitAuthorizationStatus = String(payload.authorizationStatus || '').trim().toUpperCase();

  if (treatAsParticular || !requestedObraSocialId) {
    return {
      obraSocial: null,
      obraSocialId: null,
      charge: calculatePatientCharge(null),
      status: payload.status || 'SCHEDULED',
      authorizationStatus: 'NOT_REQUIRED',
      documentsChecklist: { documents: [], additionalInfo: '' },
    };
  }

  const obraSocial = await tx.obraSocial.findUnique({
    where: { id: requestedObraSocialId },
  });

  if (!obraSocial || obraSocial.isArchived) {
    const error = new Error('La obra social seleccionada no existe');
    error.statusCode = 400;
    throw error;
  }

  if (isInactiveInsurance(obraSocial)) {
    const error = new Error('La obra social asignada al paciente está inactiva. Contacta al administrador.');
    error.statusCode = 409;
    throw error;
  }

  const documentsChecklist = buildDocumentChecklist({
    obraSocial,
    existingChecklist: payload.documentsChecklist,
  });

  return {
    obraSocial,
    obraSocialId: obraSocial.id,
    charge: calculatePatientCharge(obraSocial),
    status: obraSocial.requiresAuthorization
      ? (
        payload.status
        || (explicitAuthorizationStatus === 'AUTHORIZED'
          ? 'AUTHORIZED'
          : explicitAuthorizationStatus === 'REJECTED'
            ? 'REJECTED'
            : 'PENDING_AUTHORIZATION')
      )
      : (payload.status || 'SCHEDULED'),
    authorizationStatus: obraSocial.requiresAuthorization
      ? (['AUTHORIZED', 'REJECTED', 'PENDING'].includes(explicitAuthorizationStatus) ? explicitAuthorizationStatus : 'PENDING')
      : 'NOT_REQUIRED',
    documentsChecklist,
  };
};

const cloneChecklist = (checklist) => JSON.parse(JSON.stringify(checklist || { documents: [], additionalInfo: '' }));

const prepareReusedDocuments = async (tx, patientId, checklist = null) => {
  if (!patientId || !Array.isArray(checklist?.documents) || checklist.documents.length === 0) {
    return checklist;
  }

  const appointments = await tx.appointment.findMany({
    where: {
      patientId,
      documentsChecklist: { not: null },
      status: { not: 'CANCELLED' },
    },
    orderBy: [
      { date: 'desc' },
      { time: 'desc' },
    ],
    select: {
      id: true,
      date: true,
      documentsChecklist: true,
    },
    take: 20,
  });

  const latestByName = new Map();

  appointments.forEach((appointment) => {
    const documents = Array.isArray(appointment.documentsChecklist?.documents)
      ? appointment.documentsChecklist.documents
      : [];

    documents
      .filter((document) => document?.presented && document?.fileUrl && !latestByName.has(document.name))
      .forEach((document) => {
        latestByName.set(document.name, {
          appointmentId: appointment.id,
          appointmentDate: appointment.date,
          fileUrl: document.fileUrl,
          fileName: document.fileName || null,
          presentedAt: document.presentedAt || appointment.date,
        });
      });
  });

  const nextChecklist = cloneChecklist(checklist);

  nextChecklist.documents = nextChecklist.documents.map((document) => {
    const previous = latestByName.get(document.name);
    if (!previous) return document;

    return {
      ...document,
      presented: Boolean(document.presented || previous.fileUrl),
      fileUrl: document.fileUrl || previous.fileUrl,
      fileName: document.fileName || previous.fileName,
      presentedAt: document.presentedAt || previous.presentedAt,
      reusedFromAppointmentId: previous.appointmentId,
    };
  });

  return nextChecklist;
};

const buildAppointmentWritePayload = async (tx, patient, payload = {}, options = {}) => {
  const { currentAppointment = null, preserveCurrentInsurance = false } = options;

  if (preserveCurrentInsurance && currentAppointment) {
    return {
      obraSocialId: currentAppointment.obraSocialId ?? null,
      status: payload.status || currentAppointment.status || 'SCHEDULED',
      authorizationStatus: payload.authorizationStatus || currentAppointment.authorizationStatus || 'NOT_REQUIRED',
      authorizationNumber: payload.authorizationNumber || null,
      authorizationFileUrl: payload.authorizationFileUrl || null,
      documentsChecklist: payload.documentsChecklist ?? currentAppointment.documentsChecklist ?? { documents: [], additionalInfo: '' },
      coinsuranceAmount: currentAppointment.coinsuranceAmount === undefined ? null : currentAppointment.coinsuranceAmount,
      patientChargeAmount: currentAppointment.patientChargeAmount === undefined ? null : currentAppointment.patientChargeAmount,
      coinsuranceDetails: currentAppointment.coinsuranceDetails ?? null,
      paidInAdvance: payload.paidInAdvance ?? currentAppointment.paidInAdvance,
      sessionToken: payload.sessionToken || null,
    };
  }

  const insuranceContext = await getAppointmentInsuranceContext(tx, patient, payload);
  const hydratedChecklist = await prepareReusedDocuments(tx, patient.id, insuranceContext.documentsChecklist);
  const financialSnapshot = buildStoredFinancialSnapshot({
    currentAppointment: preserveCurrentInsurance ? currentAppointment : null,
    nextObraSocialId: insuranceContext.obraSocialId,
    nextCharge: insuranceContext.charge,
  });

  return {
    obraSocialId: insuranceContext.obraSocialId,
    status: insuranceContext.status,
    authorizationStatus: insuranceContext.authorizationStatus,
    authorizationNumber: payload.authorizationNumber || null,
    authorizationFileUrl: payload.authorizationFileUrl || null,
    documentsChecklist: hydratedChecklist,
    coinsuranceAmount: financialSnapshot.coinsuranceAmount,
    patientChargeAmount: financialSnapshot.patientChargeAmount,
    coinsuranceDetails: financialSnapshot.coinsuranceDetails,
    paidInAdvance: Boolean(payload.paidInAdvance),
    sessionToken: payload.sessionToken || null,
  };
};

const notifyProfessionalAuthorizationUpdate = async (prisma, appointment, authorizationStatus) => {
  if (!appointment?.professionalId) return;

  const professionalUser = await prisma.user.findFirst({
    where: {
      professionalId: appointment.professionalId,
      isActive: true,
    },
    select: {
      email: true,
      fullName: true,
    },
  });

  if (!professionalUser?.email) return;

  const patientName = appointment.patient?.fullName || 'Paciente';
  const statusLabel = authorizationStatus === 'AUTHORIZED' ? 'autorizado' : 'rechazado';

  await sendNotificationToEmails(prisma, [professionalUser.email], {
    title: `Turno ${statusLabel}`,
    body: `${patientName}: ${statusLabel} por administración.`,
    url: '/autorizaciones',
    kind: 'appointment-authorization',
  });
};

// 1. OBTENER TURNOS DE LA SEMANA
export const getWeekAppointments = async (req, res, prisma) => {
  try {
    const { startDate, endDate, professionalId } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ message: "Fechas requeridas" });
    
    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T23:59:59Z');
    const scopedProfessionalId = ensureAppointmentScope(req, professionalId || null);
    const where = mergeWhereClauses(
      { date: { gte: start, lte: end } },
      scopedProfessionalId ? { professionalId: scopedProfessionalId } : {},
    );
    
    const appointments = await prisma.appointment.findMany({
      where,
      select: appointmentSelect,
      orderBy: APPOINTMENT_ORDER
    });
    res.json(appointments);
  } catch (error) {
    throw createInternalError(error, 'Error al cargar agenda');
  }
};

// 2. CREAR CITA (CON LÓGICA DE INGRESO Y SLOTS)
export const createAppointment = async (req, res, prisma) => {
  const {
    patientData,
    patientId,
    professionalId,
    date,
    time,
    diagnosis,
    sessionCount,
    selectedDays,
    phone,
    birthDate,
    status,
    documentsChecklist,
    authorizationNumber,
    authorizationFileUrl,
    paidInAdvance,
    sessionToken,
  } = req.body;

  // Fallback: si phone o birthDate no están al nivel raíz, buscar en patientData
  const phoneToUse = phone !== undefined ? phone : (patientData?.phone || null);
  const birthDateToUse = birthDate !== undefined ? birthDate : (patientData?.birthDate || null);
  
  // Logging temporal para depuración de creación de turnos
  logger.info('Appointment creation request received', {
    userId: req.user?.userId || null,
    professionalId: professionalId || null,
    date: date || null,
    time: time || null,
    hasPatientData: Boolean(patientData),
    hasPatientId: Boolean(patientId),
    sessionCount: sessionCount || null,
  });
  console.log('Appointment creation request received');
  console.log('Full appointment request body:', req.body);

  if ((!patientData && !patientId) || !date || !time) return res.status(400).json({ message: "Datos faltantes" });

  try {
    // Obtener configuración de agenda
    const agendaConfig = await prisma.agendaConfig.findFirst();
    const capacityPerSlot = agendaConfig?.capacityPerSlot || 5;

    const result = await prisma.$transaction(async (tx) => {
      let patient;
      const scopedProfessionalId = ensureAppointmentScope(req, professionalId || null);
      
      // Caso 1: Si viene patientData (crear nuevo paciente)
      if (patientData) {
        const insuranceData = await resolvePatientInsurancePayload(tx, patientData);
        patient = await tx.patient.upsert({
          where: { dni: String(patientData.dni) },
            update: { 
            fullName: patientData.fullName, 
            healthInsurance: insuranceData.healthInsurance,
            obraSocialId: insuranceData.obraSocialId,
            treatAsParticular: insuranceData.treatAsParticular,
            affiliateNumber: patientData.affiliateNumber || undefined,
            phone: phoneToUse || undefined,
            birthDate: birthDateToUse ? normalizeBirthDateOrUnknown(birthDateToUse) : undefined,
            hasMarcapasos: patientData.hasMarcapasos ?? false, 
            usesEA: patientData.usesEA ?? false,
            hasCancer: patientData.hasCancer ?? false,
            usesWheelchair: patientData.usesWheelchair ?? false,
            isRespiratory: patientData.isRespiratory ?? false,
            isIU: patientData.isIU ?? false,
          },
          create: { 
            dni: String(patientData.dni), 
            fullName: patientData.fullName, 
            healthInsurance: insuranceData.healthInsurance,
            obraSocialId: insuranceData.obraSocialId,
            treatAsParticular: insuranceData.treatAsParticular,
            affiliateNumber: patientData.affiliateNumber || null,
            phone: phoneToUse || null,
            birthDate: normalizeBirthDateOrUnknown(birthDateToUse),
            hasMarcapasos: patientData.hasMarcapasos ?? false, 
            usesEA: patientData.usesEA ?? false,
            hasCancer: patientData.hasCancer ?? false,
            usesWheelchair: patientData.usesWheelchair ?? false,
            isRespiratory: patientData.isRespiratory ?? false,
            isIU: patientData.isIU ?? false,
          },
          select: patientSelect,
        });
      } 
      // Caso 2: Si viene patientId (actualizar paciente existente)
      else if (patientId) {
        await tx.patient.update({
          where: { id: patientId },
          data: {
            phone: phoneToUse || undefined,
            birthDate: birthDateToUse ? normalizeBirthDateOrUnknown(birthDateToUse) : undefined
          },
          select: patientIdSelect,
        });
        patient = await tx.patient.findUnique({
          where: { id: patientId },
          select: patientSelect,
        });

        if (!patient) {
          throw createHttpError('Paciente no encontrado', 404);
        }
      }

      let prof = null;

      if (scopedProfessionalId) {
        prof = await tx.professional.findUnique({
          where: { id: scopedProfessionalId },
          select: professionalSelect,
        });

        if (!prof) {
          throw createHttpError('Profesional no encontrado', 404);
        }

        if (!prof.isActive) {
          throw createHttpError('El profesional seleccionado está inactivo', 409);
        }
      }

      if (!prof) {
        prof = await tx.professional.findFirst({
          where: { isActive: true },
          orderBy: { fullName: 'asc' },
          select: professionalSelect,
        });
      }

      if (!prof) {
        prof = await tx.professional.create({
          data: { fullName: 'Kinesiólogo Principal', licenseNumber: 'MN-1', specialty: 'Kinesiología' },
          select: professionalSelect,
        });
      }

      const baseAppointmentPayload = await buildAppointmentWritePayload(tx, patient, {
        ...patientData,
        ...(req.body || {}),
        status,
        documentsChecklist,
        authorizationNumber,
        authorizationFileUrl,
        paidInAdvance,
        sessionToken,
      });

      const appointmentsCreated = [];
      const numSessions = Math.max(1, parseInt(sessionCount) || 1);
      const [year, month, day] = date.split('-').map(Number);
      let currentDate = new Date(year, month - 1, day, 12, 0, 0);
      const daysToUse = (selectedDays && selectedDays.length > 0) ? selectedDays : [currentDate.getDay()];
      
      let sessionsCreated = 0;
      let loopSafety = 0;
      while (sessionsCreated < numSessions && loopSafety < 150) {
        loopSafety++;
        if (daysToUse.includes(currentDate.getDay())) {
          const occupied = await tx.appointment.findMany({
            where: { 
              date: new Date(currentDate.setHours(12,0,0,0)), 
              time, 
              professionalId: prof.id,
              status: { not: 'CANCELLED' } 
            },
            select: { slotNumber: true }
          });
          const occupiedNumbers = occupied.map(s => s.slotNumber);
          let nextSlot = Array.from({ length: capacityPerSlot }, (_, i) => i + 1).find(n => !occupiedNumbers.includes(n));

          if (nextSlot) {
            const newApt = await tx.appointment.create({
              data: {
                date: new Date(currentDate),
                time,
                slotNumber: nextSlot,
                diagnosis: diagnosis ? diagnosis.toUpperCase() : null,
                isFirstSession: false, // Dejamos que resequencePatientAppointments decida basándose en la historia
                sessionNumber: 0, // Idem
                patientId: patient.id,
                professionalId: prof.id,
                ...baseAppointmentPayload,
                sessionToken: baseAppointmentPayload.sessionToken,
                paidInAdvance: Boolean(baseAppointmentPayload.paidInAdvance && sessionsCreated === 0),
              },
              select: appointmentSelect,
            });
            appointmentsCreated.push(newApt);
            sessionsCreated++;
          }
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      await resequencePatientAppointments(tx, patient.id);
      return {
        patient,
        professional: prof,
        appointments: appointmentsCreated,
      };
    });

    await Promise.all(
      result.appointments.map((appointment) => safeWriteAuditLog(prisma, req, {
        action: auditActions.appointmentCreated,
        resource: 'APPOINTMENT',
        resourceId: appointment.id,
        newValues: {
          id: appointment.id,
          patientId: appointment.patientId,
          professionalId: appointment.professionalId,
          date: appointment.date,
          time: appointment.time,
          status: appointment.status,
          authorizationStatus: appointment.authorizationStatus,
          obraSocialId: appointment.obraSocialId,
          patientChargeAmount: appointment.patientChargeAmount,
          paidInAdvance: appointment.paidInAdvance,
        },
      })),
    );

    res.status(201).json({ success: true, appointments: result.appointments });
  } catch (error) {
    console.error('Appointment creation failed');
    console.error(error);
    logger.error('Appointment creation failed', {
      errorMessage: error.message,
      errorCode: error.code || null,
      errorName: error.name || null,
      errorMeta: error.meta || null,
      errorStack: error.stack || null,
      statusCode: error.statusCode || null,
      userId: req.user?.userId || null,
      professionalId: professionalId || null,
      hasPatientData: Boolean(patientData),
      hasPatientId: Boolean(patientId),
      date: date || null,
      time: time || null,
    });
    const appError = createInternalError(error, 'Error al crear el turno');
    return res.status(appError.statusCode || 500).json({
      success: false,
      message: appError.publicMessage || 'Error al crear el turno',
      error: error.message,
      code: error.code || null,
      meta: error.meta || null,
    });
  }
};

// 3. ACTUALIZAR EVOLUCIÓN, PACIENTE E HISTORIA CLÍNICA (SINCRONIZACIÓN TOTAL)
export const updateEvolution = async (req, res, prisma) => {
  const { id } = req.params;
  const {
    diagnosis,
    status,
    patientData,
    evolution,
    isFirstSession,
    documentsChecklist,
    authorizationNumber,
    authorizationFileUrl,
    paidInAdvance,
    sessionToken,
  } = req.body;

  if (!diagnosis && !status && !patientData && !evolution && isFirstSession === undefined && paidInAdvance === undefined) {
    return res.status(400).json({ message: "No hay datos para actualizar." });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const currentApt = await tx.appointment.findUnique({
        where: { id },
        select: {
          ...appointmentBaseSelect,
          patient: {
            select: patientSelect,
          },
        },
      });

      if (!currentApt) throw new Error("Cita no encontrada");
      ensureAppointmentScope(req, currentApt.professionalId);

      const insuranceHasChanged = patientData
        ? hasInsurancePayloadChanged(currentApt.patient, patientData)
        : false;

      const nextPatientInsurance = patientData
        ? (
          insuranceHasChanged
            ? await resolvePatientInsurancePayload(tx, patientData)
            : {
                obraSocialId: currentApt.patient.obraSocialId ?? null,
                healthInsurance: currentApt.patient.healthInsurance ?? null,
                treatAsParticular: Boolean(currentApt.patient.treatAsParticular),
              }
        )
        : null;

      const appointmentWritePayload = await buildAppointmentWritePayload(tx, currentApt.patient, {
        ...currentApt.patient,
        ...patientData,
        status,
        authorizationStatus: req.body.authorizationStatus || currentApt.authorizationStatus,
        documentsChecklist,
        authorizationNumber,
        authorizationFileUrl,
        paidInAdvance: paidInAdvance ?? currentApt.paidInAdvance,
        sessionToken: sessionToken ?? currentApt.sessionToken,
      }, {
        currentAppointment: currentApt,
        preserveCurrentInsurance: !insuranceHasChanged,
      });

      const updatedAppointment = await tx.appointment.update({
        where: { id },
        data: {
          ...(diagnosis !== undefined && { diagnosis: diagnosis.toUpperCase() }),
          ...(isFirstSession !== undefined && { isFirstSession }),
          ...(status !== undefined && { status: appointmentWritePayload.status }),
          authorizationStatus: appointmentWritePayload.authorizationStatus,
          authorizationNumber: appointmentWritePayload.authorizationNumber,
          authorizationFileUrl: appointmentWritePayload.authorizationFileUrl,
          documentsChecklist: appointmentWritePayload.documentsChecklist,
          obraSocialId: appointmentWritePayload.obraSocialId,
          coinsuranceAmount: appointmentWritePayload.coinsuranceAmount,
          patientChargeAmount: appointmentWritePayload.patientChargeAmount,
          coinsuranceDetails: appointmentWritePayload.coinsuranceDetails,
          paidInAdvance: appointmentWritePayload.paidInAdvance,
          sessionToken: appointmentWritePayload.sessionToken,
        },
        select: appointmentSelect,
      });

      const shouldResequence = isFirstSession !== undefined && isFirstSession !== currentApt.isFirstSession;
      if (shouldResequence) {
        await resequencePatientAppointments(tx, currentApt.patientId);
      }

      let evolutionForHistory = evolution || '';

      if (patientData) {
        // CORRECCIÓN: Aceptar todos los campos de paciente que vienen del modal
        await tx.patient.update({
          where: { id: currentApt.patientId },
          data: {
            fullName: patientData.fullName || undefined,
            healthInsurance: nextPatientInsurance?.healthInsurance,
            obraSocialId: nextPatientInsurance?.obraSocialId,
            treatAsParticular: nextPatientInsurance?.treatAsParticular,
            affiliateNumber: patientData.affiliateNumber || undefined,
            phone: patientData.phone || undefined,
            birthDate: patientData.birthDate ? normalizeBirthDateOrUnknown(patientData.birthDate) : undefined,
            hasCancer: patientData.hasCancer ?? undefined,
            hasMarcapasos: patientData.hasMarcapasos ?? undefined,
            usesEA: patientData.usesEA ?? undefined,
            usesWheelchair: patientData.usesWheelchair ?? undefined,
            isRespiratory: patientData.isRespiratory ?? undefined,
            isIU: patientData.isIU ?? undefined,
          },
          select: patientIdSelect,
        });

        // Los datos del paciente se sincronizan en la BD pero no se duplican en la evolución
        // La info ya es visible en el panel INFORMACIÓN BASE y ALERTAS MÉDICAS
      }
      
      if (evolutionForHistory.trim() !== '') {
        await tx.clinicalHistory.create({
          data: {
            patientId: currentApt.patientId,
            professionalId: currentApt.professionalId,
            diagnosis: diagnosis || currentApt.diagnosis || "EVOLUCIÓN",
            evolution: evolutionForHistory,
            date: new Date(),
          },
        });
      } else if (diagnosis && diagnosis.toUpperCase() !== (currentApt.diagnosis || '')) {
        // Si no hay evolución pero el diagnóstico cambió, guardamos el nuevo diagnóstico como evolución en la historia
        await tx.clinicalHistory.create({
          data: {
            patientId: currentApt.patientId,
            professionalId: currentApt.professionalId,
            diagnosis: diagnosis.toUpperCase(),
            evolution: "Actualización de diagnóstico/motivo desde la agenda.",
            date: new Date(),
          },
        });
      }

      return {
        previousAppointment: currentApt,
        appointment: updatedAppointment,
      };
    });

    await safeWriteAuditLog(prisma, req, {
      action: auditActions.appointmentUpdated,
      resource: 'APPOINTMENT',
      resourceId: id,
      oldValues: result.previousAppointment,
      newValues: result.appointment,
    });

    res.json({ success: true, appointment: result.appointment });
  } catch (error) {
    throw createInternalError(error, 'Error al guardar cambios');
  }
};

// 4. ACTUALIZAR CITA Y DATOS DEL PACIENTE
export const updateAppointment = async (req, res, prisma) => {
  const { id } = req.params;
  const {
    patientId,
    phone,
    birthDate,
    affiliateNumber,
    date,
    time,
    documentsChecklist,
    authorizationNumber,
    authorizationFileUrl,
    paidInAdvance,
    sessionToken,
  } = req.body;

  if (!patientId) {
    return res.status(400).json({ message: "patientId requerido" });
  }

  try {
    // Obtener configuración de agenda
    const agendaConfig = await prisma.agendaConfig.findFirst();
    const capacityPerSlot = agendaConfig?.capacityPerSlot || 5;

    const result = await prisma.$transaction(async (tx) => {
      const currentAppointment = await tx.appointment.findUnique({
        where: { id },
        select: {
          ...appointmentBaseSelect,
          date: true,
          time: true,
          slotNumber: true,
          professionalId: true,
          patient: {
            select: patientSelect,
          },
        }
      });

      if (!currentAppointment) {
        const error = new Error("Turno no encontrado");
        error.statusCode = 404;
        throw error;
      }
      ensureAppointmentScope(req, currentAppointment.professionalId);

      const nextDate = date ? parseDateAvoidTZ(date) : currentAppointment.date;
      const nextTime = time || currentAppointment.time;
      const hasScheduleChange =
        nextTime !== currentAppointment.time || nextDate.getTime() !== currentAppointment.date.getTime();

      const appointmentWritePayload = await buildAppointmentWritePayload(tx, currentAppointment.patient, {
        ...currentAppointment.patient,
        ...req.body,
        authorizationStatus: req.body.authorizationStatus || currentAppointment.authorizationStatus,
        documentsChecklist,
        authorizationNumber,
        authorizationFileUrl,
        paidInAdvance: paidInAdvance ?? currentAppointment.paidInAdvance,
        sessionToken: sessionToken ?? currentAppointment.sessionToken,
      }, {
        currentAppointment: currentAppointment,
        preserveCurrentInsurance: !hasScheduleChange,
      });

      // Actualizar datos del paciente
      if (phone || birthDate || affiliateNumber) {
        await tx.patient.update({
          where: { id: patientId },
          data: {
            phone: phone || undefined,
            birthDate: birthDate ? normalizeBirthDateOrUnknown(birthDate) : undefined,
            affiliateNumber: affiliateNumber || undefined
          },
          select: patientIdSelect,
        });
      }

      // Actualizar cita
      const updateData = {};

      if (date) updateData.date = nextDate;
      if (time) updateData.time = nextTime;
      updateData.authorizationNumber = appointmentWritePayload.authorizationNumber;
      updateData.authorizationFileUrl = appointmentWritePayload.authorizationFileUrl;
      updateData.documentsChecklist = appointmentWritePayload.documentsChecklist;
      updateData.obraSocialId = appointmentWritePayload.obraSocialId;
      updateData.status = appointmentWritePayload.status;
      updateData.authorizationStatus = appointmentWritePayload.authorizationStatus;
      updateData.coinsuranceAmount = appointmentWritePayload.coinsuranceAmount;
      updateData.patientChargeAmount = appointmentWritePayload.patientChargeAmount;
      updateData.coinsuranceDetails = appointmentWritePayload.coinsuranceDetails;
      updateData.paidInAdvance = appointmentWritePayload.paidInAdvance;
      updateData.sessionToken = appointmentWritePayload.sessionToken;

      if (hasScheduleChange) {
        const occupiedSlots = await tx.appointment.findMany({
          where: {
            id: { not: id },
            professionalId: currentAppointment.professionalId,
            date: nextDate,
            time: nextTime,
            status: { not: 'CANCELLED' }
          },
          select: { slotNumber: true }
        });

        const occupiedNumbers = occupiedSlots.map((slot) => slot.slotNumber);
        const nextSlotNumber = Array.from({ length: capacityPerSlot }, (_, i) => i + 1).find((slot) => !occupiedNumbers.includes(slot));

        if (!nextSlotNumber) {
          const error = new Error("No hay cupos disponibles para ese día y horario.");
          error.statusCode = 409;
          throw error;
        }

        updateData.slotNumber = nextSlotNumber;
      }

      await tx.appointment.update({
        where: { id },
        data: updateData,
        select: { id: true }
      });

      if (hasScheduleChange) {
        await resequencePatientAppointments(tx, patientId);
      }

      return {
        previousAppointment: currentAppointment,
        appointment: await tx.appointment.findUnique({
          where: { id },
          select: appointmentSelect,
        }),
      };
    });

    await safeWriteAuditLog(prisma, req, {
      action: auditActions.appointmentUpdated,
      resource: 'APPOINTMENT',
      resourceId: id,
      oldValues: result.previousAppointment,
      newValues: result.appointment,
    });

    res.json({ success: true, appointment: result.appointment });
  } catch (error) {
    throw createInternalError(error, 'Error al actualizar el turno');
  }
};

const APPOINTMENT_ORDER = [
  { date: 'asc' },
  { time: 'asc' },
  { slotNumber: 'asc' },
];

const resequencePatientAppointments = async (tx, patientId) => {
  logger.debug('Resequencing patient appointments', { patientId });
  const appointments = await tx.appointment.findMany({
    where: {
      patientId,
      status: { not: 'CANCELLED' },
    },
    orderBy: APPOINTMENT_ORDER,
    select: { id: true, isFirstSession: true, date: true },
  });

  logger.debug('Resequencing appointments fetched', { patientId, count: appointments.length });

  let currentNumber = 1;
  for (const [index, appointment] of appointments.entries()) {
    let isFirst = appointment.isFirstSession;
    if (index === 0) isFirst = true; // La primera sesión histórica siempre es ingreso

    // Regla de negocio automática: Los ciclos son de 10 sesiones. 
    // Si la cuenta superó 10, forzamos un nuevo inicio de ciclo (Ingreso).
    if (currentNumber > 10) {
      isFirst = true;
    }

    if (isFirst) {
      currentNumber = 1;
    }

    await tx.appointment.update({
      where: { id: appointment.id },
      data: {
        sessionNumber: currentNumber,
        isFirstSession: isFirst,
      },
      select: { id: true },
    });
    
    // Incrementar para la siguiente sesión del loop
    currentNumber++;
  }
};

const formatAppointmentDate = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-AR');
};

const buildTicketTemplateComponents = ({ patientName, firstDate, firstTime, professionalName, ticketUrl }) => {
  const bodyParams = [
    { type: 'text', text: patientName || 'Paciente' },
    { type: 'text', text: `${firstDate} ${firstTime}`.trim() },
    { type: 'text', text: professionalName || 'Kareh' },
    { type: 'text', text: ticketUrl || '' },
  ];

  const components = [{ type: 'body', parameters: bodyParams }];
  return components;
};

const buildReminderTemplateComponents = ({ patientName, dateLabel, timeLabel, professionalName }) => ([
  {
    type: 'body',
    parameters: [
      { type: 'text', text: patientName || 'Paciente' },
      { type: 'text', text: `${dateLabel} ${timeLabel}`.trim() },
      { type: 'text', text: professionalName || 'Kareh' },
    ],
  },
]);

export const sendWhatsAppTicket = async (req, res, prisma) => {
  const { id } = req.params;
  const queueRequest = req.query.queue === 'true' || process.env.WHATSAPP_TICKET_QUEUE === 'true';

  try {
    if (queueRequest) {
      await enqueueSendWhatsAppTicket({ prisma, appointmentId: id });
      return res.status(202).json({
        success: true,
        queued: true,
        message: 'El envío se está procesando en segundo plano.',
      });
    }

    await sendWhatsAppTicketForAppointment({ prisma, appointmentId: id });
    return res.status(200).json({ success: true });
  } catch (error) {
    let statusCode = 500;
    let userMessage = 'Error al enviar WhatsApp';

    if (error.statusCode) {
      statusCode = error.statusCode;
    }

    if (error.message?.includes('Template')) {
      userMessage = 'Error con el template de WhatsApp';
    } else if (error.message?.includes('access token')) {
      userMessage = 'Error de autenticación de WhatsApp';
    } else if (error.message?.includes('phone number')) {
      userMessage = 'Error con el número de teléfono de WhatsApp';
    }
    throw createPublicError(statusCode, userMessage, error);
  }
};

export const sendWhatsAppTicketDocument = async (req, res, prisma) => {
  const { id } = req.params;

  try {
    logger.info('Iniciando envío de ticket por documento', { appointmentId: id });

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: appointmentSelect,
    });

    if (!appointment) {
      logger.warn('Appointment no encontrado para ticket documento', { appointmentId: id });
      return res.status(404).json({ message: 'Turno no encontrado' });
    }

    const phone = normalizePhone(appointment.patient?.phone);
    if (!phone) {
      logger.warn('Paciente sin teléfono válido para ticket documento', {
        appointmentId: id,
        phone: appointment.patient?.phone || null,
      });
      return res.status(400).json({ message: 'El paciente no tiene teléfono válido' });
    }
    logger.info('Generando PDF de ticket', {
      appointmentId: id,
      patientName: appointment.patient?.fullName || null,
    });

    const batch = await prisma.appointment.findMany({
      where: {
        patientId: appointment.patientId,
        date: { gte: appointment.date },
        status: { not: 'CANCELLED' },
      },
      orderBy: APPOINTMENT_ORDER,
      take: 10,
      select: appointmentWithProfessionalSelect,
    });

    const ticketPdf = await buildTicketPdf({
      patient: appointment.patient,
      professional: appointment.professional,
      appointments: batch,
      diagnosis: appointment.diagnosis,
    });

    logger.info('Subiendo PDF de ticket a WhatsApp', { appointmentId: id });

    const filename = `ticket-${appointment.id}.pdf`;
    const uploadResult = await uploadMedia({
      buffer: ticketPdf,
      filename,
      mimeType: 'application/pdf',
    });

    const mediaId = uploadResult?.id;
    if (!mediaId) {
      logger.error('No se obtuvo mediaId de WhatsApp para ticket documento', {
        appointmentId: id,
        uploadResult,
      });
      throw new Error('No se obtuvo mediaId de WhatsApp');
    }

    logger.info('Enviando ticket documento a WhatsApp', { appointmentId: id, phone });

    await sendDocumentMessage({
      to: phone,
      mediaId,
      filename,
    });

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { whatsappTicketSentAt: new Date() },
      select: { id: true },
    });

    logger.info('Ticket documento enviado por WhatsApp', { appointmentId: id });
    return res.status(200).json({ success: true });
  } catch (error) {
    throw createInternalError(error, 'Error al enviar WhatsApp');
  }
};

export const sendWhatsAppReminder = async (appointment, prisma) => {
  const templateName = process.env.WHATSAPP_REMINDER_TEMPLATE;
  if (!templateName) {
    throw new Error('Template de recordatorio no configurado');
  }

  const phone = normalizePhone(appointment.patient?.phone);
  if (!phone) {
    return { skipped: true, reason: 'no_phone' };
  }

  const components = buildReminderTemplateComponents({
    patientName: appointment.patient?.fullName,
    dateLabel: formatAppointmentDate(appointment.date),
    timeLabel: appointment.time,
    professionalName: appointment.professional?.fullName,
  });

  await sendTemplateMessage({
    to: phone,
    name: templateName,
    components,
  });

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { whatsappReminderSentAt: new Date() },
    select: { id: true },
  });

  return { skipped: false };
};

// 5. ELIMINAR CITA
export const deleteAppointment = async (req, res, prisma) => {
  try {
    const { id } = req.params;
    const deleteFuture = req.query.deleteFuture === 'true';

    const result = await prisma.$transaction(async (tx) => {
      const referenceAppointment = await tx.appointment.findUnique({
        where: { id },
        select: {
          ...appointmentBaseSelect,
          patientId: true,
          date: true,
          time: true,
        }
      });

      if (!referenceAppointment) {
        const error = new Error("Turno no encontrado");
        error.statusCode = 404;
        throw error;
      }
      ensureAppointmentScope(req, referenceAppointment.professionalId);

      if (!deleteFuture) {
        await tx.appointment.delete({ where: { id } });
        await resequencePatientAppointments(tx, referenceAppointment.patientId);
        return { count: 1, deletedAppointments: [referenceAppointment] };
      }

      const appointmentsToDelete = await tx.appointment.findMany({
        where: {
          professionalId: referenceAppointment.professionalId,
          patientId: referenceAppointment.patientId,
          OR: [
            { date: { gt: referenceAppointment.date } },
            {
              date: referenceAppointment.date,
              time: { gt: referenceAppointment.time }
            }
          ]
        },
        select: appointmentBaseSelect,
      });

      const deleteResult = await tx.appointment.deleteMany({
        where: {
          id: { in: appointmentsToDelete.map((appointment) => appointment.id) },
        },
      });

      await resequencePatientAppointments(tx, referenceAppointment.patientId);
      return { count: deleteResult.count, deletedAppointments: appointmentsToDelete };
    });

    await Promise.all(
      result.deletedAppointments.map((appointment) => safeWriteAuditLog(prisma, req, {
        action: auditActions.appointmentDeleted,
        resource: 'APPOINTMENT',
        resourceId: appointment.id,
        oldValues: appointment,
      })),
    );

    res.status(200).json({ success: true, count: result.count });
  } catch (error) {
    throw createInternalError(error, 'Error al eliminar el turno');
  }
};

// 5. CANCELAR FUTUROS
export const cancelFutureAppointments = async (req, res, prisma) => {
  try {
    const { patientId } = req.params;
    const { fromDate } = req.body;
    const result = await prisma.appointment.deleteMany({
      where: mergeWhereClauses(withProfessionalScope(req.user), {
        patientId,
        date: { gt: new Date(fromDate) },
        status: { not: 'COMPLETED' }
      }),
    });
    res.json({ success: true, count: result.count });
  } catch (error) {
    throw createInternalError(error, 'Error al cancelar turnos futuros');
  }
};

// 6. OBTENER SESIONES PARA TICKET
export const getAppointmentBatch = async (req, res, prisma) => {
  const { id } = req.params;
  try {
    const ref = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, patientId: true, date: true, professionalId: true },
    });
    if (!ref) return res.status(404).json({ message: "Turno no encontrado" });
    ensureAppointmentScope(req, ref.professionalId);

    const batch = await prisma.appointment.findMany({
      where: mergeWhereClauses(withProfessionalScope(req.user), {
        patientId: ref.patientId,
        date: { gte: ref.date },
        status: { not: 'CANCELLED' }
      }),
      orderBy: APPOINTMENT_ORDER,
      take: 10,
      select: appointmentBaseSelect,
    });
    res.json(batch);
  } catch (error) {
    throw createInternalError(error, 'Error al obtener sesiones para ticket');
  }
};

export const getAppointmentAuthorizations = async (req, res, prisma) => {
  try {
    const { status = 'PENDING', dateFrom, dateTo, search = '' } = req.query;
    const where = {
      authorizationStatus: status === 'ALL' ? { in: ['PENDING', 'AUTHORIZED', 'REJECTED'] } : String(status).toUpperCase(),
    };

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = parseDateAvoidTZ(dateFrom);
      if (dateTo) where.date.lte = parseDateAvoidTZ(dateTo);
    }

    if (String(search).trim()) {
      where.OR = [
        { patient: { is: { fullName: { contains: String(search).trim(), mode: 'insensitive' } } } },
        { patient: { is: { dni: { contains: String(search).trim() } } } },
        { obraSocial: { is: { nombreOs: { contains: String(search).trim(), mode: 'insensitive' } } } },
      ];
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: [
        { date: 'asc' },
        { time: 'asc' },
      ],
      select: appointmentSelect,
      take: 200,
    });

    res.json(appointments);
  } catch (error) {
    throw createInternalError(error, 'Error al obtener autorizaciones');
  }
};

export const reviewAppointmentAuthorization = async (req, res, prisma) => {
  const { id } = req.params;
  const { decision, authorizationNumber, authorizationFileUrl } = req.body;
  const normalizedDecision = String(decision || '').trim().toUpperCase();

  if (!['AUTHORIZED', 'REJECTED'].includes(normalizedDecision)) {
    return res.status(400).json({ message: 'Decisión inválida' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const currentAppointment = await tx.appointment.findUnique({
        where: { id },
        select: appointmentSelect,
      });

      if (!currentAppointment) {
        const error = new Error('Turno no encontrado');
        error.statusCode = 404;
        throw error;
      }

      const updatedAppointment = await tx.appointment.update({
        where: { id },
        data: {
          authorizationStatus: normalizedDecision,
          authorizationNumber: authorizationNumber || currentAppointment.authorizationNumber || null,
          authorizationFileUrl: authorizationFileUrl || currentAppointment.authorizationFileUrl || null,
          authorizationReviewedAt: new Date(),
          authorizationReviewedById: req.user?.userId || null,
          status: normalizedDecision === 'AUTHORIZED' ? 'AUTHORIZED' : 'REJECTED',
        },
        select: appointmentSelect,
      });

      return {
        previousAppointment: currentAppointment,
        appointment: updatedAppointment,
      };
    });

    await safeWriteAuditLog(prisma, req, {
      action: normalizedDecision === 'AUTHORIZED'
        ? auditActions.obraSocialAuthorized
        : auditActions.obraSocialAuthorizationRejected,
      resource: 'APPOINTMENT',
      resourceId: id,
      oldValues: result.previousAppointment,
      newValues: result.appointment,
    });

    await notifyProfessionalAuthorizationUpdate(prisma, result.appointment, normalizedDecision);

    res.json({ success: true, appointment: result.appointment });
  } catch (error) {
    throw createInternalError(error, 'Error al revisar autorización');
  }
};
// 7. ENVIAR TICKET COMO IMAGEN POR WHATSAPP (CAPTURADO CON HTML2CANVAS)
export const sendWhatsAppTicketImage = async (req, res, prisma) => {
  const { id } = req.params;

  try {
    logger.info('Iniciando envío de ticket por imagen', { appointmentId: id });

    // Validar que se subió archivo
    if (!req.file) {
      logger.warn('Archivo de imagen no proporcionado para ticket', { appointmentId: id });
      return res.status(400).json({ message: 'Imagen requerida' });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: appointmentSelect,
    });

    if (!appointment) {
      logger.warn('Appointment no encontrado para ticket imagen', { appointmentId: id });
      return res.status(404).json({ message: 'Turno no encontrado' });
    }

    const phone = normalizePhone(appointment.patient?.phone, true);
    if (!phone) {
      logger.warn('Paciente sin teléfono válido para ticket imagen', {
        appointmentId: id,
        phone: appointment.patient?.phone || null,
      });
      return res.status(400).json({ message: 'El paciente no tiene teléfono válido' });
    }
    logger.info('Subiendo ticket imagen a WhatsApp', { appointmentId: id });

    // Validar MIME type
    const validMimes = ['image/jpeg', 'image/png'];
    if (!validMimes.includes(req.file.mimetype)) {
      logger.warn('Tipo de archivo inválido para ticket imagen', {
        appointmentId: id,
        mimetype: req.file.mimetype,
      });
      return res.status(400).json({ message: 'Solo se permiten imágenes JPEG o PNG' });
    }

    // Subir imagen a S3 para almacenamiento (opcional, pero recomendado)
    const s3Key = `thermal-tickets/appointment-${appointment.id}-${Date.now()}.jpg`;
    try {
      await uploadBufferToStorage(req.file.buffer, s3Key);
      logger.info('Imagen de ticket almacenada', { appointmentId: id, storageKey: s3Key });
    } catch (s3Error) {
      logger.warn('No se pudo almacenar ticket imagen', {
        appointmentId: id,
        message: s3Error.message,
      });
      // Continuamos sin fallar, ya que lo importante es enviar por WhatsApp
    }

    // Subir imagen a WhatsApp
    const filename = `ticket-${appointment.id}.jpg`;
    const uploadResult = await uploadMedia({
      buffer: req.file.buffer,
      filename,
      mimeType: req.file.mimetype,
    });

    const mediaId = uploadResult?.id;
    if (!mediaId) {
      logger.error('No se obtuvo mediaId de WhatsApp para ticket imagen', {
        appointmentId: id,
        uploadResult,
      });
      throw new Error('No se obtuvo mediaId de WhatsApp');
    }

    logger.info('Enviando ticket imagen a WhatsApp', { appointmentId: id, phone });

    // Enviar imagen
    const caption = `🏥 Ticket - ${appointment.patient?.fullName || 'Paciente'}`;
    await sendImageMessage({
      to: phone,
      mediaId,
      caption,
    });

    // Actualizar timestamp
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { whatsappTicketSentAt: new Date() },
      select: { id: true },
    });

    logger.info('Ticket imagen enviado por WhatsApp', { appointmentId: id });
    return res.status(200).json({ success: true, message: 'Imagen enviada por WhatsApp' });
  } catch (error) {
    let statusCode = 500;
    let userMessage = 'Error al enviar WhatsApp';

    if (error.statusCode) {
      statusCode = error.statusCode;
    }

    if (error.message?.includes('phone number')) {
      userMessage = 'Error con el número de teléfono de WhatsApp';
    } else if (error.message?.includes('token')) {
      userMessage = 'Error de autenticación de WhatsApp';
    }
    throw createPublicError(statusCode, userMessage, error);
  }
};
