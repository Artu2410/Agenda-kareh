import { ensureProfessionalLink, isProfessionalUser } from './roles.js';

export const getScopedProfessionalId = (user) => {
  if (!isProfessionalUser(user)) return null;
  return ensureProfessionalLink(user);
};

export const assertScopedProfessionalId = (user) => {
  const professionalId = getScopedProfessionalId(user);

  if (isProfessionalUser(user) && !professionalId) {
    const error = new Error('El usuario profesional no está vinculado a un profesional del staff');
    error.statusCode = 403;
    throw error;
  }

  return professionalId;
};

export const buildProfessionalPatientWhere = (user) => {
  const professionalId = getScopedProfessionalId(user);
  if (!professionalId) return {};

  return {
    OR: [
      { appointments: { some: { professionalId } } },
      { clinicalHistory: { some: { professionalId } } },
    ],
  };
};

export const withProfessionalScope = (user, key = 'professionalId') => {
  const professionalId = getScopedProfessionalId(user);
  if (!professionalId) return {};
  return { [key]: professionalId };
};
