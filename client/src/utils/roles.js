export const normalizeRole = (value = '') => String(value || '').trim().toUpperCase();

export const ROLE_LABELS = Object.freeze({
  SUPER_USER: 'SUPER_USER',
  ADMIN: 'ADMIN',
  PROFESSIONAL: 'PROFESSIONAL',
  SECRETARIA: 'SECRETARIA',
});

export const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const isSuperUser = (role) => normalizeRole(role) === 'SUPER_USER';

export const isAdmin = (role) => ['SUPER_USER', 'ADMIN'].includes(normalizeRole(role));

export const isProfessional = (role) => normalizeRole(role) === 'PROFESSIONAL';

export const isSecretary = (role) => normalizeRole(role) === 'SECRETARIA';

export const formatRoleLabel = (role) => ROLE_LABELS[normalizeRole(role)] || normalizeRole(role) || 'SIN_ROL';

export const hasAnyRole = (role, allowedRoles = []) => {
  const normalizedRole = normalizeRole(role);
  return allowedRoles.map(normalizeRole).includes(normalizedRole);
};

export const getAssignableRoleOptions = ({ canManageAdminRoles = false } = {}) => (
  ROLE_OPTIONS.filter((option) => {
    if (option.value === 'SUPER_USER') return canManageAdminRoles;
    if (option.value === 'ADMIN') return canManageAdminRoles;
    return true;
  })
);
