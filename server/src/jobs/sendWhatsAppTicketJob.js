import { enqueueJob } from '../services/jobQueue.js';
import { sendWhatsAppTicketForAppointment } from '../services/whatsappTicket.js';
import logger from '../config/logger.js';

const jobLogger = logger.child({ job: 'sendWhatsAppTicket' });

export const enqueueSendWhatsAppTicket = async ({ prisma, appointmentId }) => {
  return enqueueJob(async () => {
    try {
      await sendWhatsAppTicketForAppointment({ prisma, appointmentId });
      jobLogger.info('WhatsApp ticket job completed', { appointmentId });
    } catch (error) {
      jobLogger.error('WhatsApp ticket job failed', {
        appointmentId,
        errorMessage: error.message,
      });
    }
  });
};
