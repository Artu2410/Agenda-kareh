import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.patient.findFirst({
    where: { fullName: { contains: 'CARCIATO', mode: 'insensitive' } }
  });
  if (!p) {
    console.log("No found");
    return;
  }
  const as = await prisma.appointment.findMany({
    where: { patientId: p.id, status: { not: 'CANCELLED' } },
    orderBy: [{ date: 'asc' }, { time: 'asc' }]
  });
  console.log('TOTAL:', as.length);
  as.slice(-15).forEach(x => console.log(x.date.toISOString().split('T')[0], 'isFirst:', x.isFirstSession, 'sess:', x.sessionNumber));
}

main().catch(console.error).finally(() => prisma.$disconnect());
