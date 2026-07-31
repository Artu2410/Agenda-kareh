ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "whatsappTicketSentAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "whatsappReminderSentAt" TIMESTAMP(3);
