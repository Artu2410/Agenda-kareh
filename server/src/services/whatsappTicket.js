import { uploadBufferToStorage } from './storage.js';
import { buildTicketPdf } from './ticketPdf.js';
import { sendTemplateMessage } from './whatsapp.js';
import { appointmentSelect, appointmentWithProfessionalSelect } from '../prisma/selects.js';
import { normalizePhone } from '../utils/phone.js';

const UNKNOWN_BIRTHDATE = new Date(1900, 0, 1, 12, 0, 0);

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

  return [{ type: 'body', parameters: bodyParams }];
};

export const sendWhatsAppTicketForAppointment = async ({ prisma, appointmentId }) => {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const ticketTemplate = process.env.WHATSAPP_TICKET_TEMPLATE;

  if (!accessToken) throw new Error('WHATSAPP_ACCESS_TOKEN no está configurado');
  if (!phoneNumberId) throw new Error('WHATSAPP_PHONE_NUMBER_ID no está configurado');
  if (!ticketTemplate) throw new Error('WHATSAPP_TICKET_TEMPLATE no está configurado');

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: appointmentSelect,
  });

  if (!appointment) {
    const err = new Error('Turno no encontrado');
    err.statusCode = 404;
    throw err;
  }

  const phone = normalizePhone(appointment.patient?.phone);
  if (!phone) {
    const err = new Error('El paciente no tiene teléfono válido');
    err.statusCode = 400;
    throw err;
  }

  const batch = await prisma.appointment.findMany({
    where: {
      patientId: appointment.patientId,
      date: { gte: appointment.date },
      status: { not: 'CANCELLED' },
    },
    orderBy: [
      { date: 'asc' },
      { time: 'asc' },
      { slotNumber: 'asc' },
    ],
    take: 10,
    select: appointmentWithProfessionalSelect,
  });

  const ticketPdf = await buildTicketPdf({
    patient: appointment.patient,
    professional: appointment.professional,
    appointments: batch,
    diagnosis: appointment.diagnosis,
  });

  const ticketKey = `tickets/${appointment.id}-${Date.now()}.pdf`;
  const ticketUrl = await uploadBufferToStorage({
    buffer: ticketPdf,
    key: ticketKey,
    contentType: 'application/pdf',
  });

  const firstAppt = batch[0] || appointment;
  const components = buildTicketTemplateComponents({
    patientName: appointment.patient?.fullName,
    firstDate: formatAppointmentDate(firstAppt.date),
    firstTime: firstAppt.time,
    professionalName: appointment.professional?.fullName || appointment.professional?.fullName,
    ticketUrl,
  });

  await sendTemplateMessage({
    to: phone,
    name: ticketTemplate,
    components,
  });

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { whatsappTicketSentAt: new Date() },
    select: { id: true },
  });

  return { success: true };
};
