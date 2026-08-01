import { getApiUrl } from './apiBase';

const CSRF_STORAGE_KEY = 'csrfToken';
let csrfPromise = null;

export const getStoredCsrfToken = () => sessionStorage.getItem(CSRF_STORAGE_KEY);

export const setStoredCsrfToken = (token) => {
  if (token) {
    sessionStorage.setItem(CSRF_STORAGE_KEY, token);
  }
};

export const clearCsrfToken = () => {
  sessionStorage.removeItem(CSRF_STORAGE_KEY);
};

export const fetchCsrfToken = async () => {
  const response = await fetch(getApiUrl('/csrf-token'), {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('No se pudo obtener el token CSRF');
  }
  const data = await response.json();
  if (data?.token) {
    setStoredCsrfToken(data.token);
  }
  return data?.token || null;
};

export const ensureCsrfToken = async () => {
  const stored = getStoredCsrfToken();
  if (stored) return stored;

  if (!csrfPromise) {
    csrfPromise = fetchCsrfToken().finally(() => {
      csrfPromise = null;
    });
  }
  return csrfPromise;
};

export const initializeCsrf = async () => {
  try {
    await ensureCsrfToken();
  } catch {
    return;
  }
};

