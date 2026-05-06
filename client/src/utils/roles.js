export const normalizeRole = (value = '') => String(value || '').trim().toUpperCase();

export const isSuperUser = (role) => normalizeRole(role) === 'SUPER_USER';

export const isAdmin = (role) => ['SUPER_USER', 'ADMIN'].includes(normalizeRole(role));

export const isProfessional = (role) => normalizeRole(role) === 'PROFESSIONAL';

export const hasAnyRole = (role, allowedRoles = []) => {
  const normalizedRole = normalizeRole(role);
  return allowedRoles.map(normalizeRole).includes(normalizedRole);
};
