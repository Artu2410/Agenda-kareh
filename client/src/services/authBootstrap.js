import api from './api';
import { initializeCsrf } from './csrf';
import * as authStore from '../stores/auth';
import { getStoredUser, storeAuthenticatedUser } from './session';

const getVerifiedUser = (response) => {
  if (!response?.data?.valid) return null;
  return response.data.user || null;
};

const persistVerifiedUser = (user) => {
  if (!user) return null;

  storeAuthenticatedUser(user);
  return user;
};

export const bootstrapAuthSession = async () => {
  await initializeCsrf();

  try {
    const verifyResponse = await api.get('/auth/verify', { skipAuthRefresh: true });
    const verifiedUser = getVerifiedUser(verifyResponse);

    if (verifiedUser) {
      return {
        isAuthenticated: true,
        user: persistVerifiedUser(verifiedUser),
      };
    }
  } catch {
    // Si no hay access token válido, intentamos una sola rotación con refresh cookie.
  }

  try {
    const refreshResponse = await api.post('/auth/refresh', null, { skipAuthRefresh: true });
    const newAccessToken = refreshResponse?.data?.accessToken || null;

    authStore.setAccessToken(newAccessToken);

    const verifyResponse = await api.get('/auth/verify', { skipAuthRefresh: true });
    const verifiedUser = getVerifiedUser(verifyResponse);

    if (verifiedUser) {
      return {
        isAuthenticated: true,
        user: persistVerifiedUser(verifiedUser),
      };
    }
  } catch {
    // Caemos al estado no autenticado si la sesión no se puede restaurar.
  }

  authStore.clearAuth();

  return {
    isAuthenticated: false,
    user: getStoredUser(),
  };
};
