export const ROLE_PRIORITY = {
  PROFESSIONAL: 1,
  SECRETARIA: 2,
  ADMIN: 3,
  SUPER_USER: 4,
};

const ADMIN_MANAGED_ROLES = ['PROFESSIONAL', 'SECRETARIA'];

export const normalizeUserRole = (value = '') => String(value || '').trim().toUpperCase();

export const isSuperUser = (user) => normalizeUserRole(user?.role) === 'SUPER_USER';

export const isAdmin = (user) => ['SUPER_USER', 'ADMIN'].includes(normalizeUserRole(user?.role));

export const isProfessionalUser = (user) => normalizeUserRole(user?.role) === 'PROFESSIONAL';

export const isSecretaryUser = (user) => normalizeUserRole(user?.role) === 'SECRETARIA';

export const isAdminManagedRole = (role) => ADMIN_MANAGED_ROLES.includes(normalizeUserRole(role));

export const canAssignRole = (currentUser, nextRole) => {
  const currentRole = normalizeUserRole(currentUser?.role);
  const targetRole = normalizeUserRole(nextRole);

  if (!ROLE_PRIORITY[targetRole]) return false;
  if (currentRole === 'SUPER_USER') return true;
  if (currentRole !== 'ADMIN') return false;

  return isAdminManagedRole(targetRole);
};

export const ensureProfessionalLink = (user) => {
  if (!isProfessionalUser(user)) return null;
  return user?.professionalId || null;
};
