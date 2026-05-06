export const ROLE_PRIORITY = {
  PROFESSIONAL: 1,
  ADMIN: 2,
  SUPER_USER: 3,
};

export const normalizeUserRole = (value = '') => String(value || '').trim().toUpperCase();

export const isSuperUser = (user) => normalizeUserRole(user?.role) === 'SUPER_USER';

export const isAdmin = (user) => ['SUPER_USER', 'ADMIN'].includes(normalizeUserRole(user?.role));

export const isProfessionalUser = (user) => normalizeUserRole(user?.role) === 'PROFESSIONAL';

export const canAssignRole = (currentUser, nextRole) => {
  const currentRole = normalizeUserRole(currentUser?.role);
  const targetRole = normalizeUserRole(nextRole);

  if (!ROLE_PRIORITY[targetRole]) return false;
  if (currentRole === 'SUPER_USER') return true;
  if (currentRole !== 'ADMIN') return false;

  return targetRole === 'PROFESSIONAL';
};

export const ensureProfessionalLink = (user) => {
  if (!isProfessionalUser(user)) return null;
  return user?.professionalId || null;
};
