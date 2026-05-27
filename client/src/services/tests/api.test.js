import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { delay, http, HttpResponse } from 'msw';
import { server } from '../../tests/msw/server';
import api, { getApiClientState, resetApiClientState, verifyOTP } from '../api';
import { getApiUrl } from '../apiBase';
import * as authStore from '../../stores/auth';

const protectedUrl = getApiUrl('/protected');
const refreshUrl = getApiUrl('/auth/refresh');
const logoutUrl = getApiUrl('/auth/logout');
const verifyOtpUrl = getApiUrl('/auth/verify-otp');

describe('Axios interceptor refresh flow', () => {
  beforeEach(() => {
    authStore.clearAuth();
    resetApiClientState();
  });

  it('debe refrescar token y reintentar request', async () => {
    authStore.setAccessToken('old-token');

    let protectedCalls = 0;
    let refreshCompleted = false;
    server.use(
      http.get(protectedUrl, ({ request }) => {
        protectedCalls++;
        const auth = request.headers.get('authorization') || '';
        if (refreshCompleted && !auth) return HttpResponse.json({ data: 'ok' }, { status: 200 });
        return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
      }),
      http.post(refreshUrl, () => {
        refreshCompleted = true;
        return HttpResponse.json({ success: true }, { status: 200 });
      })
    );

    const response = await api.get('/protected');

    expect(response.status).toBe(200);
    expect(response.data.data).toBe('ok');
    expect(protectedCalls).toBe(2);
    expect(authStore.getAccessToken()).toBeNull();
    expect(getApiClientState()).toEqual({ isRefreshing: false, failedQueueLength: 0 });
  });

  it('debe ejecutar un solo refresh con múltiples requests simultáneos', async () => {
    authStore.setAccessToken('old-token');

    let refreshCalls = 0;
    let refreshCompleted = false;
    server.use(
      http.get(protectedUrl, ({ request }) => {
        const auth = request.headers.get('authorization') || '';
        if (refreshCompleted && !auth) return HttpResponse.json({ data: 'ok' }, { status: 200 });
        return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
      }),
      http.post(refreshUrl, async () => {
        refreshCalls++;
        refreshCompleted = true;
        await delay(50);
        return HttpResponse.json({ success: true }, { status: 200 });
      })
    );

    const promises = Array.from({ length: 5 }).map(() => api.get('/protected'));
    const results = await Promise.all(promises);

    results.forEach((r) => expect(r.status).toBe(200));
    expect(authStore.getAccessToken()).toBeNull();
    await waitFor(() => {
      expect(refreshCalls).toBe(1);
      expect(getApiClientState()).toEqual({ isRefreshing: false, failedQueueLength: 0 });
    });
  });

  it('debe limpiar auth, cola y redirect si refresh falla aunque logout falle', async () => {
    authStore.setAccessToken('old-token');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      server.use(
        http.get(protectedUrl, () => HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })),
        http.post(refreshUrl, async () => {
          await delay(50);
          return HttpResponse.json({ message: 'Refresh failed' }, { status: 401 });
        }),
        http.post(logoutUrl, () => HttpResponse.json({ message: 'Logout failed' }, { status: 401 }))
      );

      const results = await Promise.allSettled(
        Array.from({ length: 4 }).map(() => api.get('/protected'))
      );

      results.forEach((result) => expect(result.status).toBe('rejected'));

      await waitFor(() => {
        expect(authStore.getAccessToken()).toBeNull();
        expect(getApiClientState()).toEqual({ isRefreshing: false, failedQueueLength: 0 });
      });
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('no debe entrar en loop infinito (max 1 retry)', async () => {
    authStore.setAccessToken('old-token');

    let protectedCalls = 0;
    let refreshCalls = 0;
    server.use(
      http.get(protectedUrl, () => {
        protectedCalls++;
        return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
      }),
      http.post(refreshUrl, () => {
        refreshCalls++;
        return HttpResponse.json({ success: true }, { status: 200 });
      })
    );

    await expect(api.get('/protected')).rejects.toBeTruthy();

    expect(protectedCalls).toBe(2);
    expect(refreshCalls).toBe(1);
    expect(getApiClientState()).toEqual({ isRefreshing: false, failedQueueLength: 0 });
  });

  it('debe seguir soportando refresh con accessToken explícito si el backend aún lo envía', async () => {
    authStore.setAccessToken('old-token');

    let refreshCompleted = false;
    server.use(
      http.get(protectedUrl, ({ request }) => {
        const auth = request.headers.get('authorization') || '';
        if (refreshCompleted && auth === 'Bearer new-token') {
          return HttpResponse.json({ data: 'ok' }, { status: 200 });
        }
        return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
      }),
      http.post(refreshUrl, () => {
        refreshCompleted = true;
        return HttpResponse.json({ accessToken: 'new-token' }, { status: 200 });
      })
    );

    const response = await api.get('/protected');

    expect(response.status).toBe(200);
    expect(authStore.getAccessToken()).toBe('new-token');
    expect(getApiClientState()).toEqual({ isRefreshing: false, failedQueueLength: 0 });
  });

  it('no debe intentar refresh al fallar verifyOTP en login', async () => {
    let refreshCalls = 0;
    server.use(
      http.post(verifyOtpUrl, () => HttpResponse.json({ message: 'Código incorrecto' }, { status: 401 })),
      http.post(refreshUrl, () => {
        refreshCalls++;
        return HttpResponse.json({ success: true }, { status: 200 });
      })
    );

    await expect(verifyOTP('admin@kareh.com', '123456')).rejects.toMatchObject({
      friendlyMessage: 'Código incorrecto',
    });

    expect(refreshCalls).toBe(0);
    expect(getApiClientState()).toEqual({ isRefreshing: false, failedQueueLength: 0 });
  });
});
