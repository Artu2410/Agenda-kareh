#!/usr/bin/env node
/**
 * Lista los valores reales de los estados de turnos en la base, con su cantidad.
 * Correrlo ANTES de convertir status/authorizationStatus a enums de Prisma:
 * cualquier valor fuera de la lista esperada haría fallar la migración.
 *
 *   npm run check:status-values --workspace server
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const EXPECTED = {
  // Misma lista que appointmentStatusSchema (src/validations/appointmentSchemas.js).
  status: ['SCHEDULED', 'PENDING_AUTHORIZATION', 'AUTHORIZED', 'REJECTED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'],
  authorizationStatus: ['NOT_REQUIRED', 'PENDING', 'AUTHORIZED', 'REJECTED'],
};

const prisma = new PrismaClient();

const report = async (field) => {
  const rows = await prisma.appointment.groupBy({
    by: [field],
    _count: { _all: true },
    orderBy: { _count: { id: 'desc' } },
  });

  console.log(`\nAppointment.${field}`);
  let unexpected = 0;
  rows.forEach((row) => {
    const value = row[field];
    const ok = EXPECTED[field].includes(value);
    if (!ok) unexpected += row._count._all;
    console.log(`  ${ok ? 'OK ' : 'XX '} ${JSON.stringify(value).padEnd(26)} ${row._count._all}`);
  });
  return unexpected;
};

try {
  const unexpected = (await report('status')) + (await report('authorizationStatus'));
  console.log(unexpected === 0
    ? '\nTodos los valores son válidos: se puede migrar a enums.'
    : `\nHay ${unexpected} turnos con valores inesperados (XX): corregirlos antes de migrar.`);
  process.exitCode = unexpected === 0 ? 0 : 1;
} finally {
  await prisma.$disconnect();
}
