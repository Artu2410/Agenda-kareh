import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rest } from 'msw';
import { server } from '../../tests/msw/server';
import api from '../api';
import * as authStore from '../../stores/auth';

describe('Axios interceptor refresh flow', () => {
  beforeEach(() => {
    authStore.clearAuth();
    // ensure no leftover defaults
    api.defaults.headers.common.Authorization = undefined;
  });

  it('debe refrescar token y reintentar request', async () => {
    // initial token
    authStore.setAccessToken('old-token');

    // Protected: first call 401, then 200 when token updated
    let protectedCalls = 0;
    server.use(
      rest.get('/api/protected', (req, res, ctx) => {
        protectedCalls++;
        const auth = req.headers.get('authorization') || '';
        if (auth === 'Bearer new-token') return res(ctx.status(200), ctx.json({ data: 'ok' }));
        return res(ctx.status(401), ctx.json({ message: 'Unauthorized' }));
      }),
      rest.post('/api/auth/refresh', (req, res, ctx) => {
        return res(ctx.status(200), ctx.json({ accessToken: 'new-token' }));
      })
    );

    const response = await api.get('/api/protected');
    expect(response.status).toBe(200);
    expect(response.data.data).toBe('ok');
    expect(protectedCalls).toBeGreaterThanOrEqual(2); // initial + retry
    expect(authStore.getAccessToken()).toBe('new-token');
  });

  it('debe ejecutar un solo refresh con múltiples requests simultáneos', async () => {
    authStore.setAccessToken('old-token');

    let refreshCalls = 0;
    server.use(
      rest.get('/api/protected', (req, res, ctx) => {
        const auth = req.headers.get('authorization') || '';
        if (auth === 'Bearer new-token') return res(ctx.status(200), ctx.json({ data: 'ok' }));
        return res(ctx.status(401), ctx.json({ message: 'Unauthorized' }));
      }),
      rest.post('/api/auth/refresh', (req, res, ctx) => {
        refreshCalls++;
        return res(ctx.delay(50), ctx.status(200), ctx.json({ accessToken: 'new-token' }));
      })
    );

    // fire 5 simultaneous requests
    const promises = Array.from({ length: 5 }).map(() => api.get('/api/protected'));
    const results = await Promise.all(promises);
    results.forEach((r) => expect(r.status).toBe(200));
    expect(refreshCalls).toBe(1);
    expect(authStore.getAccessToken()).toBe('new-token');
  });

  it('debe hacer logout si refresh falla', async () => {
    authStore.setAccessToken('old-token');

    server.use(
      rest.get('/api/protected', (req, res, ctx) => res(ctx.status(401), ctx.json({ message: 'Unauthorized' }))),
      rest.post('/api/auth/refresh', (req, res, ctx) => res(ctx.status(401), ctx.json({ message: 'Refresh failed' })))
    );

    // spy on window.location
    const originalLocation = window.location.href;
    delete window.location;
    window.location = { href: '' };

    await expect(api.get('/api/protected')).rejects.toBeTruthy();
    expect(authStore.getAccessToken()).toBeNull();
    expect(window.location.href).toBe('/login');

    // restore
    window.location.href = originalLocation;
  });

  it('no debe entrar en loop infinito (max 1 retry)', async () => {
    authStore.setAccessToken('old-token');

    let protectedCalls = 0;
    let refreshCalls = 0;
    server.use(
      rest.get('/api/protected', (req, res, ctx) => {
        protectedCalls++;
        // always 401 even after refresh
        return res(ctx.status(401), ctx.json({ message: 'Unauthorized' }));
      }),
      rest.post('/api/auth/refresh', (req, res, ctx) => {
        refreshCalls++;
        return res(ctx.status(200), ctx.json({ accessToken: 'new-token' }));
      })
    );

    await expect(api.get('/api/protected')).rejects.toBeTruthy();
    // protected should be called at most twice (initial + one retry)
    expect(protectedCalls).toBeLessThanOrEqual(2);
    expect(refreshCalls).toBe(1);
  });
});
