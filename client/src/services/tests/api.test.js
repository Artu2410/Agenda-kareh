import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { rest } from 'msw';
import { server } from '../../tests/msw/server';
import api, { getApiClientState, resetApiClientState } from '../api';
import { getApiUrl } from '../apiBase';
import * as authStore from '../../stores/auth';

const protectedUrl = getApiUrl('/protected');
const refreshUrl = getApiUrl('/auth/refresh');
const logoutUrl = getApiUrl('/auth/logout');

const mockWindowLocation = () => {
  const originalLocation = window.location;
  delete window.location;
  window.location = { href: '' };

  return () => {
    window.location = originalLocation;
  };
};

describe('Axios interceptor refresh flow', () => {
  beforeEach(() => {
    authStore.clearAuth();
    resetApiClientState();
  });

  it('debe refrescar token y reintentar request', async () => {
    authStore.setAccessToken('old-token');

    let protectedCalls = 0;
    server.use(
      rest.get(protectedUrl, (req, res, ctx) => {
        protectedCalls++;
        const auth = req.headers.get('authorization') || '';
        if (auth === 'Bearer new-token') return res(ctx.status(200), ctx.json({ data: 'ok' }));
        return res(ctx.status(401), ctx.json({ message: 'Unauthorized' }));
      }),
      rest.post(refreshUrl, (req, res, ctx) => res(ctx.status(200), ctx.json({ accessToken: 'new-token' })))
    );

    const response = await api.get('/protected');

    expect(response.status).toBe(200);
    expect(response.data.data).toBe('ok');
    expect(protectedCalls).toBe(2);
    expect(authStore.getAccessToken()).toBe('new-token');
    expect(getApiClientState()).toEqual({ isRefreshing: false, failedQueueLength: 0 });
  });

  it('debe ejecutar un solo refresh con múltiples requests simultáneos', async () => {
    authStore.setAccessToken('old-token');

    let refreshCalls = 0;
    server.use(
      rest.get(protectedUrl, (req, res, ctx) => {
        const auth = req.headers.get('authorization') || '';
        if (auth === 'Bearer new-token') return res(ctx.status(200), ctx.json({ data: 'ok' }));
        return res(ctx.status(401), ctx.json({ message: 'Unauthorized' }));
      }),
      rest.post(refreshUrl, (req, res, ctx) => {
        refreshCalls++;
        return res(ctx.delay(50), ctx.status(200), ctx.json({ accessToken: 'new-token' }));
      })
    );

    const promises = Array.from({ length: 5 }).map(() => api.get('/protected'));
    const results = await Promise.all(promises);

    results.forEach((r) => expect(r.status).toBe(200));
    expect(authStore.getAccessToken()).toBe('new-token');
    await waitFor(() => {
      expect(refreshCalls).toBe(1);
      expect(getApiClientState()).toEqual({ isRefreshing: false, failedQueueLength: 0 });
    });
  });

  it('debe limpiar auth, cola y redirect si refresh falla aunque logout falle', async () => {
    authStore.setAccessToken('old-token');
    const restoreLocation = mockWindowLocation();
    let refreshCalls = 0;
    let logoutCalls = 0;

    server.use(
      rest.get(protectedUrl, (req, res, ctx) => res(ctx.status(401), ctx.json({ message: 'Unauthorized' }))),
      rest.post(refreshUrl, (req, res, ctx) => {
        refreshCalls++;
        return res(ctx.delay(50), ctx.status(401), ctx.json({ message: 'Refresh failed' }));
      }),
      rest.post(logoutUrl, (req, res, ctx) => {
        logoutCalls++;
        return res(ctx.status(401), ctx.json({ message: 'Logout failed' }));
      })
    );

    try {
      const results = await Promise.allSettled(
        Array.from({ length: 4 }).map(() => api.get('/protected'))
      );

      results.forEach((result) => expect(result.status).toBe('rejected'));

      await waitFor(() => {
        expect(refreshCalls).toBe(1);
        expect(logoutCalls).toBe(1);
        expect(authStore.getAccessToken()).toBeNull();
        expect(window.location.href).toBe('/login');
        expect(getApiClientState()).toEqual({ isRefreshing: false, failedQueueLength: 0 });
      });
    } finally {
      restoreLocation();
    }
  });

  it('no debe entrar en loop infinito (max 1 retry)', async () => {
    authStore.setAccessToken('old-token');

    let protectedCalls = 0;
    let refreshCalls = 0;
    server.use(
      rest.get(protectedUrl, (req, res, ctx) => {
        protectedCalls++;
        return res(ctx.status(401), ctx.json({ message: 'Unauthorized' }));
      }),
      rest.post(refreshUrl, (req, res, ctx) => {
        refreshCalls++;
        return res(ctx.status(200), ctx.json({ accessToken: 'new-token' }));
      })
    );

    await expect(api.get('/protected')).rejects.toBeTruthy();

    expect(protectedCalls).toBe(2);
    expect(refreshCalls).toBe(1);
    expect(getApiClientState()).toEqual({ isRefreshing: false, failedQueueLength: 0 });
  });
});
