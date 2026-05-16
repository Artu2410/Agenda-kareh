// Helper para parsear fechas evitando corrimientos por zona horaria (mediodía local)
import {
  appointmentBaseSelect,
  patientIdSelect,
  patientSelect,
  patientWithAppointmentCountSelect,
  professionalSelect,
} from '../prisma/selects.js';
import { buildProfessionalPatientWhere, assertScopedProfessionalId, withProfessionalScope } from '../utils/accessScope.js';
import { auditActions, safeWriteAuditLog } from '../utils/audit.js';

const parseDateAvoidTZ = (d) => {
  if (!d) return null;
  try {
    if (typeof d === 'string') {
      const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
      return new Date(d);
    }
    if (d instanceof Date) return d;
    return new Date(d);
  } catch (e) {
    return null;
  }
};

const UNKNOWN_BIRTHDATE = new Date(1900, 0, 1, 12, 0, 0);
const maskIdentifier = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  return normalized.length <= 4 ? normalized : `***${normalized.slice(-4)}`;
};

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

const getPatientScopeWhere = (user) => {
  if (String(user?.role || '').toUpperCase() === 'PROFESSIONAL') {
    assertScopedProfessionalId(user);
  }

  return buildProfessionalPatientWhere(user);
};

const buildPatientAccessWhere = (req, additionalWhere = {}) => (
  mergeWhereClauses(getPatientScopeWhere(req.user), additionalWhere)
);

const getDocumentHistoryForPatient = async (prisma, patientId, user) => {
  const appointments = await prisma.appointment.findMany({
    where: mergeWhereClauses(withProfessionalScope(user), {
      patientId,
      documentsChecklist: { not: null },
      status: { not: 'CANCELLED' },
    }),
    orderBy: [
      { date: 'desc' },
      { time: 'desc' },
    ],
    select: {
      id: true,
      date: true,
      documentsChecklist: true,
      obraSocial: {
        select: {
          id: true,
          nombreOs: true,
        },
      },
    },
    take: 20,
  });

  const documents = [];

  appointments.forEach((appointment) => {
    const checklist = appointment.documentsChecklist;
    const items = Array.isArray(checklist?.documents) ? checklist.documents : [];

    items
      .filter((item) => item?.presented && item?.fileUrl)
      .forEach((item) => {
        documents.push({
          appointmentId: appointment.id,
          appointmentDate: appointment.date,
          obraSocialId: appointment.obraSocial?.id || null,
          obraSocialName: appointment.obraSocial?.nombreOs || null,
          name: item.name,
          mandatory: Boolean(item.mandatory),
          fileUrl: item.fileUrl,
          fileName: item.fileName || null,
          presentedAt: item.presentedAt || appointment.date,
          validityDays: item.validityDays ?? null,
        });
      });
  });

  return documents;
};

const attachPatientDocumentHistory = async (prisma, patient, user) => {
  if (!patient?.id) return patient;

  return {
    ...patient,
    documentHistory: await getDocumentHistoryForPatient(prisma, patient.id, user),
  };
};

const resolvePatientInsurancePayload = async (prisma, payload = {}) => {
  const normalizedObraSocialId = payload.obraSocialId === '' ? null : payload.obraSocialId;
  const treatAsParticular = payload.treatAsParticular === undefined ? undefined : Boolean(payload.treatAsParticular);

  if (normalizedObraSocialId === undefined) {
    return {
      obraSocialId: undefined,
      healthInsurance: payload.healthInsurance,
      treatAsParticular,
    };
  }

  if (!normalizedObraSocialId) {
    return {
      obraSocialId: null,
      healthInsurance: payload.healthInsurance || null,
      treatAsParticular,
    };
  }

  const obraSocial = await prisma.obraSocial.findUnique({
    where: { id: normalizedObraSocialId },
    select: { id: true, nombreOs: true, isArchived: true },
  });

  if (!obraSocial || obraSocial.isArchived) {
    if (treatAsParticular) {
      return {
        obraSocialId: null,
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
    healthInsurance: obraSocial.nombreOs,
    treatAsParticular,
  };
};

export const searchPatientByDni = async (req, res, prisma) => {
  const { dni } = req.query;
  if (!dni) return res.status(400).json({ error: 'DNI es requerido' });

  try {
    const patient = await prisma.patient.findFirst({
      where: buildPatientAccessWhere(req, { dni: dni.toString() }),
      select: {
        ...patientSelect,
        appointments: {
          where: withProfessionalScope(req.user),
          orderBy: { date: 'desc' },
          take: 5,
          select: {
            ...appointmentBaseSelect,
            professional: {
              select: professionalSelect,
            },
          },
        },
      },
    });
    await safeWriteAuditLog(prisma, req, {
      action: auditActions.patientRead,
      resource: 'PATIENT',
      resourceId: patient?.id || null,
      details: {
        lookup: 'DNI',
        query: maskIdentifier(dni),
        found: Boolean(patient),
      },
    });
    if (!patient) return res.status(200).json(null);
    res.status(200).json(patient);
  } catch (error) {
    console.error('❌ Error en searchPatientByDni:', error);
    res.status(500).json({ error: 'Error al buscar paciente', message: error.message });
  }
};

export const getAllPatients = async (req, res, prisma) => {
  try {
    const patients = await prisma.patient.findMany({
      where: getPatientScopeWhere(req.user),
      select: patientWithAppointmentCountSelect,
      orderBy: { fullName: 'asc' }
    });
    await safeWriteAuditLog(prisma, req, {
      action: auditActions.patientListed,
      resource: 'PATIENT',
      details: {
        total: patients.length,
      },
    });
    res.status(200).json(patients);
  } catch (error) {
    console.error('❌ Error en getAllPatients:', error);
    res.status(500).json({ error: 'Error al obtener los pacientes', message: error.message });
  }
};

const buildDayRange = (inputDate) => {
  const parsed = parseDateAvoidTZ(inputDate) || new Date();
  const year = parsed.getFullYear();
  const month = parsed.getMonth();
  const day = parsed.getDate();

  return {
    selectedDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    start: new Date(year, month, day, 0, 0, 0, 0),
    end: new Date(year, month, day, 23, 59, 59, 999),
  };
};

const serializeClinicalHistoryPatient = (patient, dayAppointments = []) => ({
  ...patient,
  appointmentCount: dayAppointments.length,
  firstAppointmentTime: dayAppointments[0]?.time || null,
  dayAppointments,
});

export const getClinicalHistoryPatients = async (req, res, prisma) => {
  const search = String(req.query.search || '').trim();
  const { selectedDate, start, end } = buildDayRange(req.query.date);
  const scopedProfessionalWhere = withProfessionalScope(req.user);

  try {
    const appointments = await prisma.appointment.findMany({
      where: mergeWhereClauses(scopedProfessionalWhere, {
        date: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
      }),
      orderBy: [
        { time: 'asc' },
        { slotNumber: 'asc' },
      ],
      select: {
        id: true,
        patientId: true,
        time: true,
        slotNumber: true,
        status: true,
        professional: {
          select: {
            id: true,
            fullName: true,
          },
        },
        patient: {
          select: patientSelect,
        },
      },
    });

    const scheduledByPatient = new Map();

    for (const appointment of appointments) {
      const dayAppointment = {
        id: appointment.id,
        time: appointment.time,
        slotNumber: appointment.slotNumber,
        status: appointment.status,
        professionalId: appointment.professional?.id || null,
        professionalName: appointment.professional?.fullName || '',
      };

      const existing = scheduledByPatient.get(appointment.patientId);

      if (!existing) {
        scheduledByPatient.set(
          appointment.patientId,
          serializeClinicalHistoryPatient(appointment.patient, [dayAppointment]),
        );
        continue;
      }

      existing.dayAppointments.push(dayAppointment);
      existing.appointmentCount = existing.dayAppointments.length;
      existing.firstAppointmentTime = existing.dayAppointments[0]?.time || null;
    }

    const sortPatients = (a, b) => {
      const timeComparison = String(a.firstAppointmentTime || '').localeCompare(String(b.firstAppointmentTime || ''));
      if (timeComparison !== 0) return timeComparison;
      return String(a.fullName || '').localeCompare(String(b.fullName || ''), 'es', { sensitivity: 'base' });
    };

    const scheduledPatients = Array.from(scheduledByPatient.values()).sort(sortPatients);

    let searchResults = [];

    if (search) {
      const clinicalRecordNumber = Number.parseInt(search, 10);
      const orFilters = [
        {
          fullName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          dni: {
            contains: search,
          },
        },
      ];

      if (Number.isInteger(clinicalRecordNumber)) {
        orFilters.push({
          clinicalRecordNumber,
        });
      }

      const matchedPatients = await prisma.patient.findMany({
        where: mergeWhereClauses(getPatientScopeWhere(req.user), {
          OR: orFilters,
        }),
        orderBy: { fullName: 'asc' },
        take: 50,
        select: patientSelect,
      });

      searchResults = matchedPatients.map((patient) => {
        const scheduledPatient = scheduledByPatient.get(patient.id);
        if (scheduledPatient) {
          return {
            ...scheduledPatient,
            ...patient,
          };
        }
        return serializeClinicalHistoryPatient(patient, []);
      });
    }

    res.status(200).json({
      selectedDate,
      scheduledPatients,
      searchResults,
    });
    await safeWriteAuditLog(prisma, req, {
      action: auditActions.patientListed,
      resource: 'PATIENT',
      details: {
        selectedDate,
        scheduledCount: scheduledPatients.length,
        searchTerm: search ? '[provided]' : null,
        searchResults: searchResults.length,
      },
    });
  } catch (error) {
    console.error('❌ Error en getClinicalHistoryPatients:', error);
    res.status(500).json({
      error: 'Error al obtener pacientes para historias clínicas',
      message: error.message,
    });
  }
};

export const createPatient = async (req, res, prisma) => {
  const {
    fullName,
    dni,
    phone,
    email,
    address,
    birthDate,
    healthInsurance,
    treatAsParticular,
    affiliateNumber,
    emergencyPhone,
    medicalHistory,
    dniImageUrl,
    dniBackImageUrl,
    insuranceCardImageUrl,
    insuranceCardBackImageUrl,
    hasCancer,
    hasMarcapasos,
    usesEA,
    usesWheelchair,
    isRespiratory,
    isIU,
    medicalNotes,
  } = req.body;
  try {
    if (!fullName || !dni) return res.status(400).json({ message: 'Nombre y DNI son requeridos' });

    const existingPatient = await prisma.patient.findUnique({
      where: { dni },
      select: patientIdSelect,
    });
    if (existingPatient) return res.status(400).json({ message: 'El DNI ya existe' });

    const insuranceData = await resolvePatientInsurancePayload(prisma, req.body);

    // Calcular el número de HC secuencial
    const lastPatient = await prisma.patient.findFirst({
      orderBy: { clinicalRecordNumber: 'desc' },
      select: { clinicalRecordNumber: true }
    });
    const nextHC = (lastPatient?.clinicalRecordNumber || 0) + 1;

    // Calcular folio (2026=1, 2027=2, etc)
    const currentYear = new Date().getFullYear();
    const folio = Math.max(1, currentYear - 2025);

    const patient = await prisma.patient.create({
      data: {
        fullName, dni, phone, email, address,
        birthDate: normalizeBirthDateOrUnknown(birthDate),
        healthInsurance: insuranceData.healthInsurance,
        obraSocialId: insuranceData.obraSocialId,
        clinicalRecordNumber: nextHC,
        folio,
        treatAsParticular: insuranceData.treatAsParticular ?? !!treatAsParticular,
        affiliateNumber,
        emergencyPhone,
        medicalHistory,
        dniImageUrl,
        dniBackImageUrl,
        insuranceCardImageUrl,
        insuranceCardBackImageUrl,
        hasCancer: !!hasCancer,
        hasMarcapasos: !!hasMarcapasos,
        usesEA: !!usesEA,
        usesWheelchair: !!usesWheelchair,
        isRespiratory: !!isRespiratory,
        isIU: !!isIU,
        medicalNotes,
      },
      select: patientWithAppointmentCountSelect,
    });
    await safeWriteAuditLog(prisma, req, {
      action: auditActions.patientCreated,
      resource: 'PATIENT',
      resourceId: patient.id,
      newValues: patient,
      details: {
        dni: maskIdentifier(dni),
        fullName,
      },
    });
    res.status(201).json(patient);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear paciente', message: error.message });
  }
};

export const updatePatient = async (req, res, prisma) => {
  const { id } = req.params;
  // EXPANDIR PARA INCLUIR TODOS LOS CAMPOS SINCRONIZABLES
  const { 
    fullName, dni, phone, email, address, birthDate, healthInsurance,
    treatAsParticular, affiliateNumber, emergencyPhone, medicalHistory, hasMarcapasos, usesEA, hasCancer, medicalNotes,
    usesWheelchair, isRespiratory, isIU,
    dniImageUrl, dniBackImageUrl, insuranceCardImageUrl, insuranceCardBackImageUrl,
  } = req.body;

  try {
    const scopeWhere = buildPatientAccessWhere(req, { id });
    const existingPatient = await prisma.patient.findFirst({
      where: scopeWhere,
      select: {
        ...patientSelect,
      },
    });

    if (!existingPatient) {
      return res.status(404).json({ message: 'Paciente no encontrado' });
    }

    if (dni) {
      const existing = await prisma.patient.findUnique({
        where: { dni },
        select: patientIdSelect,
      });
      if (existing && existing.id !== id) return res.status(400).json({ message: 'DNI ya en uso' });
    }

    const insuranceData = await resolvePatientInsurancePayload(prisma, req.body);
    const patient = await prisma.patient.update({
      where: { id },
      data: {
        fullName, dni, phone, email, address,
        birthDate: birthDate ? normalizeBirthDateOrUnknown(birthDate) : undefined,
        healthInsurance: insuranceData.healthInsurance,
        obraSocialId: insuranceData.obraSocialId,
        treatAsParticular: insuranceData.treatAsParticular,
        affiliateNumber,
        emergencyPhone,
        medicalHistory,
        dniImageUrl,
        dniBackImageUrl,
        insuranceCardImageUrl,
        insuranceCardBackImageUrl,
        // AÑADIR CAMPOS MÉDICOS A LA ACTUALIZACIÓN
        hasMarcapasos,
        usesEA,
        hasCancer,
        usesWheelchair,
        isRespiratory,
        isIU,
        medicalNotes
      },
      select: patientWithAppointmentCountSelect,
    });
    await safeWriteAuditLog(prisma, req, {
      action: auditActions.patientUpdated,
      resource: 'PATIENT',
      resourceId: patient.id,
      oldValues: existingPatient,
      newValues: patient,
      details: {
        updatedFields: Object.keys(req.body || {}).sort(),
      },
    });
    res.status(200).json(patient);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: 'Error al actualizar', message: error.message });
  }
};

export const deletePatient = async (req, res, prisma) => {
  const { id } = req.params;
  try {
    const existingPatient = await prisma.patient.findFirst({
      where: buildPatientAccessWhere(req, { id }),
      select: patientSelect,
    });

    if (!existingPatient) {
      return res.status(404).json({ message: 'Paciente no encontrado' });
    }

    const appointmentCount = await prisma.appointment.count({ where: { patientId: id } });
    if (appointmentCount > 0) {
      return res.status(400).json({ message: `No se puede eliminar: tiene ${appointmentCount} cita(s)` });
    }
    await prisma.patient.delete({ where: { id } });
    await safeWriteAuditLog(prisma, req, {
      action: auditActions.patientDeleted,
      resource: 'PATIENT',
      resourceId: id,
      oldValues: existingPatient,
      details: {
        appointmentCount,
      },
    });
    res.status(200).json({ message: 'Eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar', message: error.message });
  }
};

export const getPatientById = async (req, res, prisma) => {
  const { id } = req.params;
  try {
    const patient = await prisma.patient.findFirst({
      where: buildPatientAccessWhere(req, { id }),
      select: {
        ...patientSelect,
        appointments: {
          where: withProfessionalScope(req.user),
          orderBy: { date: 'desc' },
          select: {
            ...appointmentBaseSelect,
            professional: {
              select: professionalSelect,
            },
          },
        },
      },
    });
    if (!patient) return res.status(404).json({ message: 'No encontrado' });
    const patientWithDocuments = await attachPatientDocumentHistory(prisma, patient, req.user);
    await safeWriteAuditLog(prisma, req, {
      action: auditActions.patientRead,
      resource: 'PATIENT',
      resourceId: patient.id,
      details: {
        lookup: 'ID',
      },
    });
    res.status(200).json(patientWithDocuments);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener', message: error.message });
  }
};

// --- FUNCIÓN ADICIONAL PARA HISTORIAL (REQUERIDA POR TUS RUTAS) ---
export const getPatientHistoryByDni = async (req, res, prisma) => {
  const { dni } = req.params;
  try {
    const patient = await prisma.patient.findFirst({
      where: buildPatientAccessWhere(req, { dni: dni.toString() }),
      select: {
        ...patientSelect,
        appointments: {
          where: withProfessionalScope(req.user),
          orderBy: { date: 'desc' },
          select: {
            ...appointmentBaseSelect,
            professional: {
              select: professionalSelect,
            },
          },
        },
      },
    });
    if (!patient) return res.status(404).json({ message: 'Historial no encontrado' });
    const patientWithDocuments = await attachPatientDocumentHistory(prisma, patient, req.user);
    await safeWriteAuditLog(prisma, req, {
      action: auditActions.patientRead,
      resource: 'PATIENT',
      resourceId: patient.id,
      details: {
        lookup: 'DNI_HISTORY',
        query: maskIdentifier(dni),
      },
    });
    res.status(200).json(patientWithDocuments);
  } catch (error) {
    console.error('❌ Error en getPatientHistoryByDni:', error);
    res.status(500).json({ error: 'Error al obtener historial', message: error.message });
  }
};

export const getFutureAppointments = async (req, res, prisma) => {
  const { patientId } = req.params;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const appointments = await prisma.appointment.findMany({
      where: mergeWhereClauses(withProfessionalScope(req.user), {
        patientId: patientId,
        date: {
          gte: today,
        },
      }),
      select: appointmentBaseSelect,
      orderBy: [
        { date: 'asc' },
        { time: 'asc' },
        { slotNumber: 'asc' },
      ],
    });
    await safeWriteAuditLog(prisma, req, {
      action: auditActions.appointmentRead,
      resource: 'APPOINTMENT',
      resourceId: patientId,
      details: {
        scope: 'FUTURE_BY_PATIENT',
        total: appointments.length,
      },
    });
    res.status(200).json(appointments);
  } catch (error) {
    console.error('❌ Error in getFutureAppointments:', error);
    res.status(500).json({ error: 'Error fetching future appointments', message: error.message });
  }
};

// Devuelve ciclos de sesiones completadas por anio para control de obra social
export const getSessionCycles = async (req, res, prisma) => {
  const { patientId } = req.params;
  try {
    const completedAppointments = await prisma.appointment.findMany({
      where: mergeWhereClauses(withProfessionalScope(req.user), { patientId, status: 'COMPLETED' }),
      orderBy: [{ date: 'asc' }],
      select: { id: true, date: true, diagnosis: true },
    });

    const byYear = {};
    for (const apt of completedAppointments) {
      const year = new Date(apt.date).getFullYear();
      if (!byYear[year]) byYear[year] = [];
      byYear[year].push(apt);
    }

    const result = Object.entries(byYear)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([year, apts]) => {
        const totalCompleted = apts.length;
        const completedCycles = Math.floor(totalCompleted / 10);
        const sessionsInCurrentCycle = totalCompleted % 10;
        return {
          year: Number(year),
          totalCompleted,
          completedCycles,
          sessionsInCurrentCycle,
          cycles: Array.from({ length: completedCycles }, (_, i) => ({
            cycleNumber: i + 1,
            from: apts[i * 10]?.date,
            to: apts[i * 10 + 9]?.date,
          })),
          currentCycleStart: completedCycles * 10 < totalCompleted
            ? apts[completedCycles * 10]?.date
            : null,
        };
      });

    await safeWriteAuditLog(prisma, req, {
      action: auditActions.appointmentRead,
      resource: 'APPOINTMENT',
      resourceId: patientId,
      details: {
        scope: 'SESSION_CYCLES_BY_PATIENT',
        years: result.length,
      },
    });
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in getSessionCycles:', error);
    res.status(500).json({ error: 'Error fetching session cycles', message: error.message });
  }
};

// Re-numerar todos los pacientes secuencialmente (Reparación)
export const renumberAllPatients = async (req, res, prisma) => {
  try {
    const patients = await prisma.patient.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true }
    });

    await prisma.$transaction(async (tx) => {
      // 1. Numeración temporal negativa para evitar colisiones unique
      for (let i = 0; i < patients.length; i++) {
        await tx.patient.update({
          where: { id: patients[i].id },
          data: { clinicalRecordNumber: -(i + 1) }
        });
      }

      // 2. Numeración final y folios
      for (let i = 0; i < patients.length; i++) {
        const year = new Date(patients[i].createdAt).getFullYear();
        const folio = Math.max(1, year - 2025);
        await tx.patient.update({
          where: { id: patients[i].id },
          data: { 
            clinicalRecordNumber: i + 1,
            folio: folio
          }
        });
      }
    });

    await safeWriteAuditLog(prisma, req, {
      action: auditActions.patientUpdated,
      resource: 'PATIENT',
      details: {
        operation: 'RENUMBER_ALL',
        total: patients.length,
      },
    });
    res.status(200).json({ message: `Re-numerados ${patients.length} pacientes correctamente` });
  } catch (error) {
    console.error('Error en renumberAllPatients:', error);
    res.status(500).json({ error: 'Error al re-numerar', message: error.message });
  }
};
