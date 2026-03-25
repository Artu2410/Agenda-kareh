const SESSION_STORAGE_KEYS = [
  'userEmail',
  'userName',
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
  const email = String(user.email || '').trim();
  const name = String(user.name || '').trim();

  if (email) {
    localStorage.setItem('userEmail', email);
  }

  if (name) {
    localStorage.setItem('userName', name);
  }
};

export const getStoredUser = () => ({
  name: localStorage.getItem('userName') || localStorage.getItem('user_name') || '',
  email: localStorage.getItem('userEmail') || localStorage.getItem('user_email') || '',
});
