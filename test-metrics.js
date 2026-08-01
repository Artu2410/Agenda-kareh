import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const parseTimeToMinutes = (value) => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const getScheduleMinutes = (schedule = []) => (
  schedule.reduce((sum, item) => {
    const start = parseTimeToMinutes(item.startTime);
    const end = parseTimeToMinutes(item.endTime);
    if (start === null || end === null || end <= start) return sum;
    return sum + (end - start);
  }, 0)
);

async function run() {
  const professionals = await prisma.professional.findMany({
    where: { isActive: true, isArchived: false },
    include: { workSchedule: true }
  });

  const totalAvailableMinutes = professionals.reduce(
    (sum, prof) => sum + getScheduleMinutes(prof.workSchedule),
    0
  );

  const agendaConfig = await prisma.agendaConfig.findFirst();
  const sessionDurationMinutes = Math.max(1, Number(agendaConfig?.slotDuration || agendaConfig?.timerDurationMinutes || 30));
  const capacityPerSlot = Math.max(1, Number(agendaConfig?.capacityPerSlot || 1));

  const weeklyCapacity = sessionDurationMinutes > 0 
    ? (totalAvailableMinutes / sessionDurationMinutes) * capacityPerSlot 
    : 0;

  const monthlyCapacity = weeklyCapacity * 4.33;

  console.log('--- CAPACITY ---');
  console.log('Total Available Minutes (weekly):', totalAvailableMinutes);
  console.log('Session Duration (minutes):', sessionDurationMinutes);
  console.log('Capacity Per Slot:', capacityPerSlot);
  console.log('Weekly Capacity:', weeklyCapacity);
  console.log('Monthly Capacity:', monthlyCapacity);

  // Now let's calculate total appointments this month
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const appointments = await prisma.appointment.findMany({
    where: {
      date: { gte: start, lt: nextStart },
      status: { not: 'CANCELLED' }
    }
  });

  const appointmentCount = appointments.length;
  console.log('\n--- OCCUPANCY ---');
  console.log('Total Appointments (except cancelled):', appointmentCount);
  const occupancyRate = monthlyCapacity > 0 ? (appointmentCount / monthlyCapacity) * 100 : 0;
  console.log('Occupancy Rate:', occupancyRate.toFixed(2) + '%');

  // Let's test billing by coverage
  const cashflows = await prisma.cashFlow.findMany({
    where: {
      date: { gte: start, lt: nextStart },
      type: 'INCOME',
    },
    select: { amount: true, concept: true },
  });

  const invoices = await prisma.billingInvoice.findMany({
    where: {
      issueDate: { gte: start, lt: nextStart },
    },
    select: {
      payerName: true,
      totalAmount: true,
      patientId: true,
      obraSocial: { select: { nombreOs: true } },
    },
  });

  console.log('\n--- BILLING ---');
  console.log('Invoices count:', invoices.length);
  console.log('Cashflows count:', cashflows.length);

  // Replicating the logic but counting turns and patients properly
  // For each cashflow/invoice, how do we know the turns?
  // Facturación is NOT directly linked to agenda. 
  // We might have to link it by patientId and then count their turns?
  // Let's see what is possible.
  
  await prisma.$disconnect();
}

run().catch(console.error);
