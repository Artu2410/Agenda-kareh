import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const shouldApply = process.argv.includes('--apply');

const normalizeInsuranceName = (value) => String(value || '').trim().toUpperCase();

const shouldSkipInsurance = (name) => ['PAMI', 'OSDE'].some((excluded) => normalizeInsuranceName(name).includes(excluded));

const parseHonorarioSnapshot = (details) => {
  if (!details || typeof details !== 'object') return 0;
  return Number(details.honorario || 0);
};

const main = async () => {
  const appointments = await prisma.appointment.findMany({
    where: {
      obraSocialId: { not: null },
      status: { not: 'CANCELLED' },
    },
    select: {
      id: true,
      coinsuranceDetails: true,
      obraSocial: {
        select: {
          nombreOs: true,
          honorarioEstimado: true,
          isActive: true,
          isArchived: true,
        },
      },
    },
  });

  const candidates = appointments.filter((appointment) => {
    const insurance = appointment.obraSocial;
    if (!insurance || insurance.isArchived || insurance.isActive === false) return false;
    if (shouldSkipInsurance(insurance.nombreOs)) return false;
    if (Number(insurance.honorarioEstimado || 0) <= 0) return false;
    return parseHonorarioSnapshot(appointment.coinsuranceDetails) <= 0;
  });

  console.log(`appointments_scanned=${appointments.length}`);
  console.log(`appointments_to_backfill=${candidates.length}`);

  if (!shouldApply || candidates.length === 0) {
    console.log(shouldApply ? 'nothing_to_update=true' : 'dry_run=true');
    return;
  }

  let updated = 0;

  for (const appointment of candidates) {
    const nextDetails =
      appointment.coinsuranceDetails && typeof appointment.coinsuranceDetails === 'object'
        ? { ...appointment.coinsuranceDetails }
        : {};

    nextDetails.honorario = Number(appointment.obraSocial.honorarioEstimado || 0);

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        coinsuranceDetails: nextDetails,
      },
      select: { id: true },
    });

    updated += 1;
  }

  console.log(`appointments_updated=${updated}`);
};

main()
  .catch((error) => {
    console.error('backfill_failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
