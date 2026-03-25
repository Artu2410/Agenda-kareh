import { enqueueJob } from '../services/jobQueue.js';
import { sendWhatsAppTicketForAppointment } from '../services/whatsappTicket.js';

export const enqueueSendWhatsAppTicket = async ({ prisma, appointmentId }) => {
  return enqueueJob(async () => {
    try {
      await sendWhatsAppTicketForAppointment({ prisma, appointmentId });
      console.log('✅ WhatsApp ticket job completed for appointment', appointmentId);
    } catch (error) {
      console.error('❌ WhatsApp ticket job failed for appointment', appointmentId, error);
    }
  });
};
