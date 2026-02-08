import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function cleanupDuplicates() {
  try {
    console.log('🔍 Buscando citas duplicadas...\n');

    // Obtener todas las citas agrupadas por (date, time, slotNumber)
    const duplicates = await prisma.$queryRaw`
      SELECT date, time, "slotNumber", COUNT(*) as count
      FROM "Appointment"
      WHERE status != 'CANCELLED'
      GROUP BY date, time, "slotNumber"
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length === 0) {
      console.log('✅ No hay citas duplicadas');
    } else {
      console.log(`⚠️ Encontradas ${duplicates.length} combinaciones con duplicados:\n`);
      duplicates.forEach(d => {
        console.log(`  - ${d.date} a las ${d.time} (slotNumber ${d.slotNumber}): ${d.count} citas`);
      });

      // Limpiar: mantener solo 1 por combinación
      console.log('\n🧹 Limpiando duplicados...');
      
      for (const dup of duplicates) {
        const dupsToDelete = await prisma.appointment.findMany({
          where: {
            date: dup.date,
            time: dup.time,
            slotNumber: dup.slotNumber,
            status: { not: 'CANCELLED' }
          },
          orderBy: { id: 'asc' },
          skip: 1 // Mantener el primero, eliminar los demás
        });

        if (dupsToDelete.length > 0) {
          await prisma.appointment.deleteMany({
            where: {
              id: { in: dupsToDelete.map(d => d.id) }
            }
          });
          console.log(`  ✅ Eliminadas ${dupsToDelete.length} citas duplicadas`);
        }
      }
    }

    // Verificar integridad de slotNumbers
    console.log('\n📊 Verificando slotNumbers por horario...');
    const allAppointments = await prisma.appointment.findMany({
      where: { status: { not: 'CANCELLED' } },
      orderBy: [{ date: 'asc' }, { time: 'asc' }, { slotNumber: 'asc' }]
    });

    let currentDatetime = null;
    let maxSlot = 0;
    let issues = 0;

    for (const appt of allAppointments) {
      const datetime = `${appt.date}T${appt.time}`;
      
      if (datetime !== currentDatetime) {
        currentDatetime = datetime;
        maxSlot = 0;
      }

      if (appt.slotNumber !== maxSlot + 1) {
        console.log(`  ⚠️ ${datetime}: slotNumber incorrecto (esperado ${maxSlot + 1}, tiene ${appt.slotNumber})`);
        issues++;
      }
      maxSlot = appt.slotNumber;
    }

    if (issues === 0) {
      console.log('  ✅ Todos los slotNumbers son correctos');
    }

    console.log('\n✅ Limpieza completada');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanupDuplicates();
