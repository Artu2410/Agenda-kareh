import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { runWhatsappReminders } from '../src/services/whatsappReminders.js';

dotenv.config();

const prisma = new PrismaClient();

const run = async () => {
  const result = await runWhatsappReminders(prisma);
  console.log(`✅ WhatsApp reminders: enviados=${result.sent}, omitidos=${result.skipped}`);
};

run()
  .catch((error) => {
    console.error('❌ Error en cron WhatsApp:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
