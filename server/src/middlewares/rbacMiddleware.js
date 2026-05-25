import { ROLE_PERMISSIONS } from '../constants/permissions.js';

// Middleware: checkRole(...allowedRoles)
export const checkRole = (...allowedRoles) => (req, res, next) => {
  const user = req.user;
  if (!user || !user.userId) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  const currentRole = String(user.role || '').toUpperCase();
  const allowed = allowedRoles.map((r) => String(r || '').toUpperCase());

  if (allowed.length > 0 && !allowed.includes(currentRole)) {
    return res.status(403).json({ message: 'Rol no autorizado para esta acción' });
  }

  return next();
};

// Middleware: hasPermission(permission)
export const hasPermission = (permission) => (req, res, next) => {
  const user = req.user;
  if (!user || !user.userId) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  const role = String(user.role || '').toUpperCase();
  const permissions = ROLE_PERMISSIONS[role] || [];
  if (!permissions.includes(permission)) {
    return res.status(403).json({ message: 'Permiso denegado' });
  }

  return next();
};

export default { checkRole, hasPermission };
