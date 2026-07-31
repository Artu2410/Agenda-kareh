jest.mock('../src/services/whatsapp.js', () => ({
  __esModule: true,
  uploadMedia: jest.fn(),
  sendDocumentMessage: jest.fn(),
  sendImageMessage: jest.fn(),
  sendTemplateMessage: jest.fn(),
  sendTextMessage: jest.fn(),
}));

jest.mock('../src/services/whatsappTicket.js', () => ({
  __esModule: true,
  sendWhatsAppTicketForAppointment: jest.fn(),
}));

jest.mock('../src/jobs/sendWhatsAppTicketJob.js', () => ({
  __esModule: true,
  enqueueSendWhatsAppTicket: jest.fn(),
  sendWhatsAppTicketJob: jest.fn(),
  default: jest.fn(),
}));

jest.mock('../src/services/storage.js', () => ({
  __esModule: true,
  uploadBufferToStorage: jest.fn(),
}));

jest.mock('../src/services/ticketPdf.js', () => ({
  __esModule: true,
  buildTicketPdf: jest.fn(),
}));

jest.mock('../src/services/pushNotifications.js', () => ({
  __esModule: true,
  sendNotificationToEmails: jest.fn(),
}));

jest.mock('../src/config/logger.js', () => {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(),
  };
  logger.child.mockReturnValue(logger);
  return { __esModule: true, default: logger };
});

import {
  sendWhatsAppReminder,
  sendWhatsAppTicket,
  sendWhatsAppTicketDocument,
  sendWhatsAppTicketImage,
} from '../src/controllers/AppointmentController.js';
import { enqueueSendWhatsAppTicket } from '../src/jobs/sendWhatsAppTicketJob.js';
import { sendWhatsAppTicketForAppointment } from '../src/services/whatsappTicket.js';
import { buildTicketPdf } from '../src/services/ticketPdf.js';
import {
  sendDocumentMessage,
  sendImageMessage,
  sendTemplateMessage,
  uploadMedia,
} from '../src/services/whatsapp.js';
import { uploadBufferToStorage } from '../src/services/storage.js';

const createResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const buildAppointment = (overrides = {}) => ({
  id: 'apt-1',
  patientId: 'pat-1',
  professionalId: 'prof-1',
  date: new Date('2026-05-30T12:00:00.000Z'),
  time: '10:00',
  diagnosis: 'CONTROL',
  patient: {
    id: 'pat-1',
    fullName: 'Juan Pérez',
    phone: '1125609610',
    birthDate: new Date('1990-01-01T12:00:00.000Z'),
  },
  professional: {
    id: 'prof-1',
    fullName: 'Lic. Ana',
  },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.WHATSAPP_REMINDER_TEMPLATE;
  delete process.env.WHATSAPP_TICKET_QUEUE;
});

describe('WhatsApp reminders and tickets', () => {
  it('sends a reminder template and updates the appointment timestamp', async () => {
    process.env.WHATSAPP_REMINDER_TEMPLATE = 'reminder-template';
    const appointment = buildAppointment();
    const prisma = {
      appointment: {
        update: jest.fn().mockResolvedValue({ id: appointment.id }),
      },
    };

    const result = await sendWhatsAppReminder(appointment, prisma);

    expect(sendTemplateMessage).toHaveBeenCalledWith(expect.objectContaining({
      to: '5491125609610',
      name: 'reminder-template',
      components: expect.any(Array),
    }));
    expect(prisma.appointment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: appointment.id },
      data: expect.objectContaining({
        whatsappReminderSentAt: expect.any(Date),
      }),
    }));
    expect(result).toEqual({ skipped: false });
  });

  it('skips reminder sending when the patient has no phone', async () => {
    process.env.WHATSAPP_REMINDER_TEMPLATE = 'reminder-template';
    const appointment = buildAppointment({
      patient: {
        ...buildAppointment().patient,
        phone: null,
      },
    });
    const prisma = {
      appointment: {
        update: jest.fn(),
      },
    };

    const result = await sendWhatsAppReminder(appointment, prisma);

    expect(result).toEqual({ skipped: true, reason: 'no_phone' });
    expect(sendTemplateMessage).not.toHaveBeenCalled();
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });

  it('queues WhatsApp ticket sending when requested', async () => {
    const req = {
      params: { id: 'apt-1' },
      query: { queue: 'true' },
    };
    const res = createResponse();
    const prisma = {};

    await sendWhatsAppTicket(req, res, prisma);

    expect(enqueueSendWhatsAppTicket).toHaveBeenCalledWith({ prisma, appointmentId: 'apt-1' });
    expect(sendWhatsAppTicketForAppointment).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      queued: true,
    }));
  });

  it('sends WhatsApp ticket immediately when queue is disabled', async () => {
    const req = {
      params: { id: 'apt-1' },
      query: {},
    };
    const res = createResponse();
    const prisma = {};
    sendWhatsAppTicketForAppointment.mockResolvedValue({ success: true });

    await sendWhatsAppTicket(req, res, prisma);

    expect(sendWhatsAppTicketForAppointment).toHaveBeenCalledWith({ prisma, appointmentId: 'apt-1' });
    expect(enqueueSendWhatsAppTicket).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('sends a PDF ticket by WhatsApp and persists the send timestamp', async () => {
    const appointment = buildAppointment({
      patient: {
        ...buildAppointment().patient,
        phone: '1125609610',
      },
    });
    const batch = [appointment];
    const prisma = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue(appointment),
        findMany: jest.fn().mockResolvedValue(batch),
        update: jest.fn().mockResolvedValue({ id: appointment.id }),
      },
    };
    buildTicketPdf.mockResolvedValue(Buffer.from('pdf'));
    uploadMedia.mockResolvedValue({ id: 'media-1' });
    sendDocumentMessage.mockResolvedValue({ success: true });
    const req = { params: { id: appointment.id } };
    const res = createResponse();

    await sendWhatsAppTicketDocument(req, res, prisma);

    expect(buildTicketPdf).toHaveBeenCalledWith(expect.objectContaining({
      patient: appointment.patient,
      professional: appointment.professional,
      appointments: batch,
    }));
    expect(uploadMedia).toHaveBeenCalledWith(expect.objectContaining({
      filename: `ticket-${appointment.id}.pdf`,
      mimeType: 'application/pdf',
      buffer: expect.any(Buffer),
    }));
    expect(sendDocumentMessage).toHaveBeenCalledWith({
      to: '5491125609610',
      mediaId: 'media-1',
      filename: `ticket-${appointment.id}.pdf`,
    });
    expect(prisma.appointment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: appointment.id },
      data: expect.objectContaining({
        whatsappTicketSentAt: expect.any(Date),
      }),
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('rejects ticket image uploads with invalid mime types', async () => {
    const appointment = buildAppointment();
    const prisma = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue(appointment),
        update: jest.fn(),
      },
    };
    const req = {
      params: { id: appointment.id },
      file: {
        buffer: Buffer.from('image'),
        mimetype: 'application/pdf',
      },
    };
    const res = createResponse();

    await sendWhatsAppTicketImage(req, res, prisma);

    expect(uploadBufferToStorage).not.toHaveBeenCalled();
    expect(uploadMedia).not.toHaveBeenCalled();
    expect(sendImageMessage).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Solo se permiten imágenes JPEG o PNG' });
  });

  it('sends a ticket image through WhatsApp and stores the upload', async () => {
    const appointment = buildAppointment({
      patient: {
        ...buildAppointment().patient,
        phone: '1125609610',
      },
    });
    const prisma = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue(appointment),
        update: jest.fn().mockResolvedValue({ id: appointment.id }),
      },
    };
    uploadBufferToStorage.mockResolvedValue('s3://ticket.jpg');
    uploadMedia.mockResolvedValue({ id: 'media-2' });
    sendImageMessage.mockResolvedValue({ success: true });
    const req = {
      params: { id: appointment.id },
      file: {
        buffer: Buffer.from('image'),
        mimetype: 'image/jpeg',
      },
    };
    const res = createResponse();

    await sendWhatsAppTicketImage(req, res, prisma);

    expect(uploadBufferToStorage).toHaveBeenCalledWith(
      req.file.buffer,
      expect.stringMatching(/^thermal-tickets\/appointment-apt-1-\d+\.jpg$/),
    );
    expect(uploadMedia).toHaveBeenCalledWith(expect.objectContaining({
      filename: `ticket-${appointment.id}.jpg`,
      mimeType: 'image/jpeg',
      buffer: req.file.buffer,
    }));
    expect(sendImageMessage).toHaveBeenCalledWith({
      to: '5491125609610',
      mediaId: 'media-2',
      caption: '🏥 Ticket - Juan Pérez',
    });
    expect(prisma.appointment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: appointment.id },
      data: expect.objectContaining({
        whatsappTicketSentAt: expect.any(Date),
      }),
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Imagen enviada por WhatsApp',
    });
  });
});
