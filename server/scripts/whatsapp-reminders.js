import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { addHours, addMinutes } from 'date-fns';
import { sendWhatsAppReminder } from '../src/controllers/AppointmentController.js';

dotenv.config();

const prisma = new PrismaClient();

const WINDOW_MINUTES = Number(process.env.WHATSAPP_REMINDER_WINDOW_MINUTES || 60);

const buildAppointmentDateTime = (dateValue, timeValue) => {
  if (!dateValue || !timeValue) return null;
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const [hour, minute] = timeValue.split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
};

const run = async () => {
  const now = new Date();
  const windowStart = addHours(now, 24);
  const windowEnd = addMinutes(windowStart, WINDOW_MINUTES);

  const dayStart = new Date(windowStart);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(windowEnd);
  dayEnd.setHours(23, 59, 59, 999);

  const appointments = await prisma.appointment.findMany({
    where: {
      status: 'SCHEDULED',
      whatsappReminderSentAt: null,
      date: { gte: dayStart, lte: dayEnd },
    },
    include: { patient: true, professional: true },
  });

  let sent = 0;
  let skipped = 0;

  for (const appointment of appointments) {
    const appointmentDateTime = buildAppointmentDateTime(appointment.date, appointment.time);
    if (!appointmentDateTime) {
      skipped += 1;
      continue;
    }

    if (appointmentDateTime < windowStart || appointmentDateTime > windowEnd) {
      continue;
    }

    try {
      const result = await sendWhatsAppReminder(appointment, prisma);
      if (result?.skipped) {
        skipped += 1;
      } else {
        sent += 1;
      }
    } catch (error) {
      console.error('ERROR REMINDER:', appointment.id, error.message);
    }
  }

  console.log(`✅ WhatsApp reminders: enviados=${sent}, omitidos=${skipped}`);
};

run()
  .catch((error) => {
    console.error('❌ Error en cron WhatsApp:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
