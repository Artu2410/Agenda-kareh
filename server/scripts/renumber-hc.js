import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function renumberPatients() {
  console.log('🚀 Iniciando re-numeración de Historias Clínicas...');

  try {
    // 1. Obtener todos los pacientes ordenados por fecha de creación (el orden real de llegada)
    const patients = await prisma.patient.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true, fullName: true, clinicalRecordNumber: true }
    });

    console.log(`📋 Encontrados ${patients.length} pacientes.`);

    // 2. Usar una transacción para evitar inconsistencias
    await prisma.$transaction(async (tx) => {
      // Primero movemos todos a un rango temporal negativo para evitar conflictos de "unique"
      console.log('🔄 Paso 1: Asignando numeración temporal...');
      for (let i = 0; i < patients.length; i++) {
        await tx.patient.update({
          where: { id: patients[i].id },
          data: { clinicalRecordNumber: -(i + 1) }
        });
      }

      // Ahora asignamos el número final y el folio correcto
      console.log('✅ Paso 2: Asignando números finales y folios...');
      for (let i = 0; i < patients.length; i++) {
        const patient = patients[i];
        const newHC = i + 1;
        const year = new Date(patient.createdAt).getFullYear();
        const folio = Math.max(1, year - 2025);

        await tx.patient.update({
          where: { id: patient.id },
          data: { 
            clinicalRecordNumber: newHC,
            folio: folio
          }
        });
        
        console.log(`   - [${newHC}] ${patient.fullName} (Año: ${year} -> Folio: ${folio})`);
      }
    });

    console.log('\n✨ ¡Proceso completado con éxito!');
    console.log('Todos los pacientes han sido re-numerados desde 0001 en adelante.');
    
  } catch (error) {
    console.error('❌ Error durante la re-numeración:', error);
  } finally {
    await prisma.$disconnect();
  }
}

renumberPatients();
