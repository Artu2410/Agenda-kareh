import { normalizeRole } from '../utils/roles';

const SESSION_STORAGE_KEYS = [
  'userId',
  'userEmail',
  'userName',
  'userRole',
  'userProfessionalId',
  'user_email',
  'user_name',
];

const LEGACY_SESSION_STORAGE_KEYS = [
  // Compatibilidad de limpieza para instalaciones que todavía tengan residuos
  // del flujo legado de auth fallback en localStorage.
  'auth_fallback',
  'auth_fallback_token',
  'csrfToken',
];

export const clearClientSession = () => {
  [...SESSION_STORAGE_KEYS, ...LEGACY_SESSION_STORAGE_KEYS].forEach((key) => {
    localStorage.removeItem(key);
  });

  sessionStorage.removeItem('csrfToken');
};

export const storeAuthenticatedUser = (user = {}) => {
  const id = String(user.id || '').trim();
  const email = String(user.email || '').trim();
  const name = String(user.name || '').trim();
  const role = normalizeRole(user.role);
  const professionalId = String(user.professionalId || '').trim();

  if (id) {
    localStorage.setItem('userId', id);
  }

  if (email) {
    localStorage.setItem('userEmail', email);
  }

  if (name) {
    localStorage.setItem('userName', name);
  }

  if (role) {
    localStorage.setItem('userRole', role);
  }

  if (professionalId) {
    localStorage.setItem('userProfessionalId', professionalId);
  }
};

export const getStoredUser = () => ({
  id: localStorage.getItem('userId') || '',
  name: localStorage.getItem('userName') || localStorage.getItem('user_name') || '',
  email: localStorage.getItem('userEmail') || localStorage.getItem('user_email') || '',
  role: normalizeRole(localStorage.getItem('userRole') || ''),
  professionalId: localStorage.getItem('userProfessionalId') || '',
});
