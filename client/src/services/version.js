import { getApiUrl } from './apiBase';

export const fetchRuntimeVersion = async () => {
  const response = await fetch(getApiUrl('/version'), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`No se pudo cargar la versión: ${response.status}`);
  }

  return response.json();
};
