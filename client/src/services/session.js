const SESSION_STORAGE_KEYS = [
  'userId',
  'userEmail',
  'userName',
  'userRole',
  'user_email',
  'user_name',
  'auth_fallback',
  'auth_fallback_token',
  'csrfToken',
];

export const clearClientSession = () => {
  SESSION_STORAGE_KEYS.forEach((key) => {
    localStorage.removeItem(key);
  });
};

export const storeAuthenticatedUser = (user = {}) => {
  const id = String(user.id || '').trim();
  const email = String(user.email || '').trim();
  const name = String(user.name || '').trim();
  const role = String(user.role || '').trim();

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
};

export const getStoredUser = () => ({
  id: localStorage.getItem('userId') || '',
  name: localStorage.getItem('userName') || localStorage.getItem('user_name') || '',
  email: localStorage.getItem('userEmail') || localStorage.getItem('user_email') || '',
  role: localStorage.getItem('userRole') || '',
});
