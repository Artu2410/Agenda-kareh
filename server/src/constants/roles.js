export const ROLES = Object.freeze({
  SUPER_USER: 'SUPER_USER',
  ADMIN: 'ADMIN',
  PROFESSIONAL: 'PROFESSIONAL',
  SECRETARIA: 'SECRETARIA',
  // Aliases legacy para no romper referencias viejas mientras se limpia el código.
  SUPER_ADMIN: 'SUPER_USER',
  KINESIOLOGO: 'PROFESSIONAL',
});

export default ROLES;
