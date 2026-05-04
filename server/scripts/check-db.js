#!/usr/bin/env node

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\nVerificación de base de datos Kareh\n');

  await prisma.$connect();

  const [patients, appointments, users] = await Promise.all([
    prisma.patient.count(),
    prisma.appointment.count(),
    prisma.user.count().catch(() => 0),
  ]);

  const tables = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name ASC
  `;

  console.log(`Tablas públicas: ${tables.length}`);
  console.log(`Pacientes: ${patients}`);
  console.log(`Citas: ${appointments}`);
  console.log(`Usuarios: ${users}`);
  console.log('\nBase de datos accesible.\n');
}

main()
  .catch((error) => {
    console.error('\nError verificando la base de datos:\n');
    console.error(error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
