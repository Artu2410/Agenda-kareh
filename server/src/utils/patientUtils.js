import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const findOrCreatePatient = async ({ dni, fullName, phone, email, birthDate, healthInsurance, address, hasCancer, hasPacemaker, usesEA }) => {
  let patient = await prisma.patient.findUnique({
    where: { dni },
  });

  if (patient) {
    // Update patient data if they exist
    // Normalize birthDate to avoid timezone shifts (set to local noon if date-only)
    const normalizeBirth = (d) => {
      if (!d) return null;
      try {
        if (typeof d === 'string') {
          const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
          return new Date(d);
        }
        if (d instanceof Date) return d;
        return new Date(d);
      } catch (e) { return null; }
    };

    patient = await prisma.patient.update({
      where: { id: patient.id },
      data: {
        fullName: fullName || patient.fullName,
        phone: phone || patient.phone,
        email: email || patient.email,
        birthDate: birthDate ? normalizeBirth(birthDate) : patient.birthDate,
        healthInsurance: healthInsurance || patient.healthInsurance,
        address: address || patient.address,
        hasCancer: hasCancer ?? patient.hasCancer,
        hasPacemaker: hasPacemaker ?? patient.hasPacemaker,
        usesEA: usesEA ?? patient.usesEA,
      },
    });
  } else {
    // Create new patient
    const normalizeBirth2 = (d) => {
      if (!d) return null;
      try {
        if (typeof d === 'string') {
          const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
          return new Date(d);
        }
        if (d instanceof Date) return d;
        return new Date(d);
      } catch (e) { return new Date(); }
    };

    patient = await prisma.patient.create({
      data: {
        dni,
        fullName,
        phone,
        email,
        birthDate: birthDate ? normalizeBirth2(birthDate) : new Date(), // Default to current date if not provided
        healthInsurance,
        address,
        hasCancer,
        hasPacemaker,
        usesEA,
      },
    });
  }
  return patient;
};
