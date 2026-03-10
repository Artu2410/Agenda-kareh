import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function checkDatabase() {
  console.log('🔍 Verificando conectividad con la base de datos...\n');
  
  try {
    // Test de conexión
    console.log('1️⃣  Conectando a PostgreSQL...');
    await prisma.$connect();
    console.log('✅ Conexión exitosa a PostgreSQL\n');

    // Test de tablas
    console.log('2️⃣  Verificando tablas...');
    const tables = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log(`✅ Encontradas ${tables.length} tablas:`);
    tables.forEach(t => console.log(`   - ${t.table_name}`));
    console.log();

    // Test de pacientes
    console.log('3️⃣  Contando pacientes...');
    const patientCount = await prisma.patient.count();
    console.log(`✅ Total de pacientes: ${patientCount}\n`);

    // Test de citas
    console.log('4️⃣  Contando citas...');
    const appointmentCount = await prisma.appointment.count();
    console.log(`✅ Total de citas: ${appointmentCount}\n`);

    // Test de consulta de rango de fechas
    console.log('5️⃣  Probando consulta de rango de fechas...');
    const startDate = new Date('2026-01-14');
    const endDate = new Date('2026-01-20');
    const weekAppointments = await prisma.appointment.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: { patient: true },
    });
    console.log(`✅ Citas en la semana: ${weekAppointments.length}\n`);

    console.log('🎉 ¡Todo está funcionando correctamente!');
    console.log('\n📝 URL de API: http://localhost:5000/api');
    console.log('💚 Health check: http://localhost:5000/api/health');
    console.log('📅 Appointments week: http://localhost:5000/api/appointments/week?startDate=2026-01-14&endDate=2026-01-20');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'P1000') {
      console.error('\n⚠️  No se puede conectar a PostgreSQL. Verifica:');
      console.error('   1. ¿PostgreSQL está corriendo?');
      console.error('   2. ¿La URL en .env es correcta?');
      console.error('   3. ¿Las credenciales son válidas?');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
