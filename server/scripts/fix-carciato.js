import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  const patient = await prisma.patient.findFirst({
    where: { fullName: { contains: 'CARCIATO', mode: 'insensitive' } }
  });

  if (!patient) {
    console.log('Paciente CARCIATO no encontrada.');
    return;
  }

  console.log(`Paciente: ${patient.fullName} (${patient.id})`);

  // Buscar el turno del 20 de abril de 2026
  const targetDate = new Date('2026-04-20T12:00:00Z');
  const startDate = new Date('2026-04-20T00:00:00Z');
  const endDate = new Date('2026-04-20T23:59:59Z');

  const apt = await prisma.appointment.findFirst({
    where: {
      patientId: patient.id,
      date: {
        gte: startDate,
        lte: endDate
      },
      status: { not: 'CANCELLED' }
    }
  });

  if (!apt) {
    console.log('Turno del 20 de abril no encontrado.');
    return;
  }

  console.log(`Turno encontrado: ID ${apt.id}, actual sessionNumber: ${apt.sessionNumber}`);

  // Forzar isFirstSession a true
  await prisma.appointment.update({
    where: { id: apt.id },
    data: { isFirstSession: true }
  });

  console.log('Estado isFirstSession actualizado a TRUE.');

  // Ejecutar re-secuenciamiento para el paciente
  const appointments = await prisma.appointment.findMany({
    where: {
      patientId: patient.id,
      status: { not: 'CANCELLED' },
    },
    orderBy: [
      { date: 'asc' },
      { time: 'asc' },
      { slotNumber: 'asc' },
    ],
    select: { id: true, isFirstSession: true, date: true, sessionNumber: true },
  });

  let currentNumber = 1;
  for (const [index, a] of appointments.entries()) {
    let isFirst = a.isFirstSession;
    if (index === 0) isFirst = true;

    if (isFirst) {
      currentNumber = 1;
    }

    await prisma.appointment.update({
      where: { id: a.id },
      data: {
        sessionNumber: currentNumber,
        isFirstSession: isFirst,
      }
    });
    console.log(`Apt ${a.date.toISOString()} -> Sesion ${currentNumber}${isFirst ? ' (Ingreso)' : ''}`);
    currentNumber++;
  }

  console.log('RE-SECUENCIAMIENTO COMPLETADO.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
