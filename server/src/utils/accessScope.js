import { ensureProfessionalLink, isProfessionalUser } from './roles.js';

// Falla cerrado: un usuario PROFESSIONAL sin profesional vinculado no recibe
// "sin filtro" (que equivaldría a ver todo), sino un 403.
export const getScopedProfessionalId = (user) => {
  if (!isProfessionalUser(user)) return null;

  const professionalId = ensureProfessionalLink(user);
  if (!professionalId) {
    const error = new Error('El usuario profesional no está vinculado a un profesional del staff');
    error.statusCode = 403;
    throw error;
  }

  return professionalId;
};

export const assertScopedProfessionalId = getScopedProfessionalId;

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
