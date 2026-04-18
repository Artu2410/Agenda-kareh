import { startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { uploadBufferToStorage } from '../services/storage.js';
import { buildTicketPdf } from '../services/ticketPdf.js';
import { uploadMedia, sendDocumentMessage, sendImageMessage } from '../services/whatsapp.js';
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
import { normalizePhone } from '../utils/phone.js';

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

// 1. OBTENER TURNOS DE LA SEMANA
export const getWeekAppointments = async (req, res, prisma) => {
  try {
    const { startDate, endDate, professionalId } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ message: "Fechas requeridas" });
    
    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T23:59:59Z');
    const where = { date: { gte: start, lte: end } };

    if (professionalId) {
      where.professionalId = professionalId;
    }
    
    const appointments = await prisma.appointment.findMany({
      where,
      select: appointmentSelect,
      orderBy: APPOINTMENT_ORDER
    });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: "Error al cargar agenda", error: error.message });
  }
};

// 2. CREAR CITA (CON LÓGICA DE INGRESO Y SLOTS)
export const createAppointment = async (req, res, prisma) => {
  const { patientData, patientId, professionalId, date, time, diagnosis, sessionCount, selectedDays, phone, birthDate } = req.body;

  // Fallback: si phone o birthDate no están al nivel raíz, buscar en patientData
  const phoneToUse = phone !== undefined ? phone : (patientData?.phone || null);
  const birthDateToUse = birthDate !== undefined ? birthDate : (patientData?.birthDate || null);
  
  if ((!patientData && !patientId) || !date || !time) return res.status(400).json({ message: "Datos faltantes" });

  try {
    // Obtener configuración de agenda
    const agendaConfig = await prisma.agendaConfig.findFirst();
    const capacityPerSlot = agendaConfig?.capacityPerSlot || 5;

    const result = await prisma.$transaction(async (tx) => {
      let patient;
      
      // Caso 1: Si viene patientData (crear nuevo paciente)
      if (patientData) {
        patient = await tx.patient.upsert({
          where: { dni: String(patientData.dni) },
            update: { 
            fullName: patientData.fullName, 
            healthInsurance: patientData.healthInsurance, 
            treatAsParticular: patientData.treatAsParticular ?? false,
            affiliateNumber: patientData.affiliateNumber || undefined,
            phone: phoneToUse || undefined,
            birthDate: birthDateToUse ? normalizeBirthDateOrUnknown(birthDateToUse) : undefined,
            hasMarcapasos: patientData.hasMarcapasos ?? false, 
            usesEA: patientData.usesEA ?? false,
            hasCancer: patientData.hasCancer ?? false
          },
          create: { 
            dni: String(patientData.dni), 
            fullName: patientData.fullName, 
            healthInsurance: patientData.healthInsurance || null, 
            treatAsParticular: patientData.treatAsParticular ?? false,
            affiliateNumber: patientData.affiliateNumber || null,
            phone: phoneToUse || null,
            birthDate: normalizeBirthDateOrUnknown(birthDateToUse),
            hasMarcapasos: patientData.hasMarcapasos ?? false, 
            usesEA: patientData.usesEA ?? false,
            hasCancer: patientData.hasCancer ?? false
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
      }

      let prof = null;

      if (professionalId) {
        prof = await tx.professional.findUnique({
          where: { id: professionalId },
          select: professionalSelect,
        });

        if (!prof) {
          throw new Error('Profesional no encontrado');
        }

        if (!prof.isActive) {
          throw new Error('El profesional seleccionado está inactivo');
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
                isFirstSession: (sessionsCreated === 0),
                sessionNumber: sessionsCreated + 1,
                patientId: patient.id,
                professionalId: prof.id,
                status: 'SCHEDULED'
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
      return appointmentsCreated;
    });
    res.status(201).json({ success: true, appointments: result });
  } catch (error) {
    res.status(500).json({ message: "Error al crear", error: error.message });
  }
};

// 3. ACTUALIZAR EVOLUCIÓN, PACIENTE E HISTORIA CLÍNICA (SINCRONIZACIÓN TOTAL)
export const updateEvolution = async (req, res, prisma) => {
  const { id } = req.params;
  const { diagnosis, status, patientData, evolution, isFirstSession } = req.body;

  if (!diagnosis && !status && !patientData && !evolution && isFirstSession === undefined) {
    return res.status(400).json({ message: "No hay datos para actualizar." });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const currentApt = await tx.appointment.findUnique({
        where: { id },
        select: { patientId: true, professionalId: true, diagnosis: true },
      });

      if (!currentApt) throw new Error("Cita no encontrada");

      await tx.appointment.update({
        where: { id },
        data: {
          ...(diagnosis !== undefined && { diagnosis: diagnosis.toUpperCase() }),
          ...(status !== undefined && { status }),
          ...(isFirstSession !== undefined && { isFirstSession }),
        },
        select: appointmentSelect,
      });

      // Siempre re-secuenciamos al actualizar una evolución para mantener la coherencia
      await resequencePatientAppointments(tx, currentApt.patientId);

      let evolutionForHistory = evolution || '';

      if (patientData) {
        // CORRECCIÓN: Aceptar todos los campos de paciente que vienen del modal
        await tx.patient.update({
          where: { id: currentApt.patientId },
          data: {
            fullName: patientData.fullName || undefined,
            healthInsurance: patientData.healthInsurance || undefined,
            treatAsParticular: patientData.treatAsParticular ?? undefined,
            affiliateNumber: patientData.affiliateNumber || undefined,
            phone: patientData.phone || undefined,
            birthDate: patientData.birthDate ? normalizeBirthDateOrUnknown(patientData.birthDate) : undefined,
            hasCancer: patientData.hasCancer ?? undefined,
            hasMarcapasos: patientData.hasMarcapasos ?? undefined,
            usesEA: patientData.usesEA ?? undefined,
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

      return tx.appointment.findUnique({
        where: { id },
        select: appointmentSelect,
      });
    });

    res.json({ success: true, appointment: result });
  } catch (error) {
    console.error("❌ Error en sincronización:", error);
    res.status(500).json({ message: "Error al guardar cambios", error: error.message });
  }
};

// 4. ACTUALIZAR CITA Y DATOS DEL PACIENTE
export const updateAppointment = async (req, res, prisma) => {
  const { id } = req.params;
  const { patientId, phone, birthDate, affiliateNumber, date, time } = req.body;

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
          date: true,
          time: true,
          slotNumber: true,
          professionalId: true,
        }
      });

      if (!currentAppointment) {
        const error = new Error("Turno no encontrado");
        error.statusCode = 404;
        throw error;
      }

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
      const nextDate = date ? parseDateAvoidTZ(date) : currentAppointment.date;
      const nextTime = time || currentAppointment.time;
      const hasScheduleChange =
        nextTime !== currentAppointment.time || nextDate.getTime() !== currentAppointment.date.getTime();

      if (date) updateData.date = nextDate;
      if (time) updateData.time = nextTime;

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

      return tx.appointment.findUnique({
        where: { id },
        select: appointmentSelect,
      });
    });

    res.json({ success: true, appointment: result });
  } catch (error) {
    console.error("Error al actualizar cita:", error);
    res.status(error.statusCode || 500).json({ message: error.message || "Error al actualizar", error: error.message });
  }
};

const APPOINTMENT_ORDER = [
  { date: 'asc' },
  { time: 'asc' },
  { slotNumber: 'asc' },
];

const resequencePatientAppointments = async (tx, patientId) => {
  console.log(`[Resequencing] Patient ${patientId}`);
  const appointments = await tx.appointment.findMany({
    where: {
      patientId,
      status: { not: 'CANCELLED' },
    },
    orderBy: APPOINTMENT_ORDER,
    select: { id: true, isFirstSession: true, date: true },
  });

  console.log(`[Resequencing] Found ${appointments.length} appointments`);

  let currentNumber = 1;
  for (const [index, appointment] of appointments.entries()) {
    let isFirst = appointment.isFirstSession;
    if (index === 0) isFirst = true; // La primera sesión histórica siempre es ingreso

    // Regla de negocio automática: Los ciclos son de 10 sesiones. Si llegamos a 11, es un nuevo ingreso.
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
    console.error('❌ ERROR WHATSAPP TICKET LINK:', error);
    console.error('Stack:', error.stack);
    console.error('Detail:', error.detail);

    let statusCode = 500;
    let userMessage = 'Error al enviar WhatsApp';
    let userDetail = error.detail || error.stack || error.message || String(error);

    if (error.statusCode) {
      statusCode = error.statusCode;
    }

    if (error.message?.includes('Template')) {
      userMessage = 'Error con el template de WhatsApp';
      userDetail = 'El template especificado no existe o no está aprobado en WhatsApp Business. Verifica el nombre del template.';
    } else if (error.message?.includes('access token')) {
      userMessage = 'Error de autenticación de WhatsApp';
      userDetail = 'El token de acceso de WhatsApp no es válido o ha expirado.';
    } else if (error.message?.includes('phone number')) {
      userMessage = 'Error con el número de teléfono de WhatsApp';
      userDetail = 'El ID del número de teléfono de WhatsApp no es válido.';
    }

    return res.status(statusCode).json({
      message: userMessage,
      detail: userDetail,
    });
  }
};

export const sendWhatsAppTicketDocument = async (req, res, prisma) => {
  const { id } = req.params;

  try {
    console.log('🔄 Iniciando envío de ticket como documento para appointment:', id);

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: appointmentSelect,
    });

    if (!appointment) {
      console.log('❌ Appointment no encontrado:', id);
      return res.status(404).json({ message: 'Turno no encontrado' });
    }

    const phone = normalizePhone(appointment.patient?.phone);
    if (!phone) {
      console.log('❌ Paciente sin teléfono válido:', appointment.patient?.phone);
      return res.status(400).json({ message: 'El paciente no tiene teléfono válido' });
    }

    console.log('📄 Generando PDF para paciente:', appointment.patient?.fullName);

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

    console.log('📤 Subiendo PDF a WhatsApp Cloud API...');

    const filename = `ticket-${appointment.id}.pdf`;
    const uploadResult = await uploadMedia({
      buffer: ticketPdf,
      filename,
      mimeType: 'application/pdf',
    });

    const mediaId = uploadResult?.id;
    if (!mediaId) {
      console.log('❌ No se obtuvo mediaId de WhatsApp:', uploadResult);
      throw new Error('No se obtuvo mediaId de WhatsApp');
    }

    console.log('📨 Enviando documento a WhatsApp:', phone);

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

    console.log('✅ Ticket enviado exitosamente como documento');
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ ERROR WHATSAPP TICKET DOCUMENT:', error);
    console.error('Stack:', error.stack);
    console.error('Detail:', error.detail);
    return res.status(500).json({
      message: 'Error al enviar WhatsApp',
      detail: error.detail || error.stack || error.message || String(error),
    });
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

      if (!deleteFuture) {
        await tx.appointment.delete({ where: { id } });
        await resequencePatientAppointments(tx, referenceAppointment.patientId);
        return { count: 1 };
      }

      const deleteResult = await tx.appointment.deleteMany({
        where: {
          patientId: referenceAppointment.patientId,
          OR: [
            { date: { gt: referenceAppointment.date } },
            {
              date: referenceAppointment.date,
              time: { gt: referenceAppointment.time }
            }
          ]
        }
      });

      await resequencePatientAppointments(tx, referenceAppointment.patientId);
      return { count: deleteResult.count };
    });

    res.status(200).json({ success: true, count: result.count });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: "Error al eliminar", error: error.message });
  }
};

// 5. CANCELAR FUTUROS
export const cancelFutureAppointments = async (req, res, prisma) => {
  try {
    const { patientId } = req.params;
    const { fromDate } = req.body;
    const result = await prisma.appointment.deleteMany({
      where: {
        patientId,
        date: { gt: new Date(fromDate) },
        status: { not: 'COMPLETED' }
      }
    });
    res.json({ success: true, count: result.count });
  } catch (error) {
    res.status(500).json({ message: "Error al cancelar" });
  }
};

// 6. OBTENER SESIONES PARA TICKET
export const getAppointmentBatch = async (req, res, prisma) => {
  const { id } = req.params;
  try {
    const ref = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, patientId: true, date: true },
    });
    if (!ref) return res.status(404).json({ message: "Turno no encontrado" });

    const batch = await prisma.appointment.findMany({
      where: {
        patientId: ref.patientId,
        date: { gte: ref.date },
        status: { not: 'CANCELLED' }
      },
      orderBy: APPOINTMENT_ORDER,
      take: 10,
      select: appointmentBaseSelect,
    });
    res.json(batch);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener sesiones para ticket" });
  }
};
// 7. ENVIAR TICKET COMO IMAGEN POR WHATSAPP (CAPTURADO CON HTML2CANVAS)
export const sendWhatsAppTicketImage = async (req, res, prisma) => {
  const { id } = req.params;

  try {
    console.log('🖼️ Iniciando envío de ticket como imagen para appointment:', id);

    // Validar que se subió archivo
    if (!req.file) {
      console.log('❌ Archivo de imagen no proporcionado');
      return res.status(400).json({ message: 'Imagen requerida' });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: appointmentSelect,
    });

    if (!appointment) {
      console.log('❌ Appointment no encontrado:', id);
      return res.status(404).json({ message: 'Turno no encontrado' });
    }

    const phone = normalizePhone(appointment.patient?.phone, true);
    if (!phone) {
      console.log('❌ Paciente sin teléfono válido:', appointment.patient?.phone);
      return res.status(400).json({ message: 'El paciente no tiene teléfono válido' });
    }

    console.log('📤 Subiendo imagen a WhatsApp Cloud API...');

    // Validar MIME type
    const validMimes = ['image/jpeg', 'image/png'];
    if (!validMimes.includes(req.file.mimetype)) {
      console.log('❌ Tipo de archivo inválido:', req.file.mimetype);
      return res.status(400).json({ message: 'Solo se permiten imágenes JPEG o PNG' });
    }

    // Subir imagen a S3 para almacenamiento (opcional, pero recomendado)
    const s3Key = `thermal-tickets/appointment-${appointment.id}-${Date.now()}.jpg`;
    try {
      await uploadBufferToStorage(req.file.buffer, s3Key);
      console.log('✅ Imagen almacenada en S3:', s3Key);
    } catch (s3Error) {
      console.warn('⚠️ Advertencia: No se pudo almacenar en S3:', s3Error.message);
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
      console.log('❌ No se obtuvo mediaId de WhatsApp:', uploadResult);
      throw new Error('No se obtuvo mediaId de WhatsApp');
    }

    console.log('📨 Enviando imagen a WhatsApp:', phone);

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

    console.log('✅ Ticket enviado exitosamente como imagen');
    return res.status(200).json({ success: true, message: 'Imagen enviada por WhatsApp' });
  } catch (error) {
    console.error('❌ ERROR WHATSAPP TICKET IMAGE:', error);
    console.error('Stack:', error.stack);
    console.error('Detail:', error.detail);

    let statusCode = 500;
    let userMessage = 'Error al enviar WhatsApp';
    let userDetail = error.detail || error.stack || error.message || String(error);

    if (error.statusCode) {
      statusCode = error.statusCode;
    }

    if (error.message?.includes('phone number')) {
      userMessage = 'Error con el número de teléfono de WhatsApp';
      userDetail = 'El número de teléfono no es válido.';
    } else if (error.message?.includes('token')) {
      userMessage = 'Error de autenticación de WhatsApp';
      userDetail = 'El token de acceso no es válido o ha expirado.';
    }

    return res.status(statusCode).json({
      message: userMessage,
      detail: userDetail,
    });
  }
};
