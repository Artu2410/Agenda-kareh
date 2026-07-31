import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/msw/server';
import { getApiUrl } from '../apiBase';
import { bootstrapAuthSession } from '../authBootstrap';
import * as authStore from '../../stores/auth';

const verifyUrl = getApiUrl('/auth/verify');
const refreshUrl = getApiUrl('/auth/refresh');

describe('bootstrapAuthSession', () => {
  beforeEach(() => {
    authStore.clearAuth();
    localStorage.clear();
  });

  it('restaura la sesión cuando verify falla pero refresh rota el token', async () => {
    let verifyCalls = 0;
    let refreshCalls = 0;

    server.use(
      http.get(verifyUrl, ({ request }) => {
        verifyCalls++;
        const auth = request.headers.get('authorization') || '';

        if (auth === 'Bearer new-token') {
          return HttpResponse.json({
            valid: true,
            user: {
              id: 'user-1',
              email: 'admin@kareh.com',
              name: 'Admin',
              role: 'ADMIN',
              professionalId: null,
            },
          }, { status: 200 });
        }

        return HttpResponse.json({ valid: false, message: 'Token no válido' }, { status: 401 });
      }),
      http.post(refreshUrl, () => {
        refreshCalls++;
        return HttpResponse.json({ success: true, accessToken: 'new-token' }, { status: 200 });
      })
    );

    const session = await bootstrapAuthSession();

    expect(session).toEqual({
      isAuthenticated: true,
      user: {
        id: 'user-1',
        email: 'admin@kareh.com',
        name: 'Admin',
        role: 'ADMIN',
        professionalId: null,
      },
    });
    expect(refreshCalls).toBe(1);
    expect(verifyCalls).toBe(2);
    expect(authStore.getAccessToken()).toBe('new-token');
    expect(localStorage.getItem('userEmail')).toBe('admin@kareh.com');
  });

  it('no dispara un segundo refresh cuando no hay sesión activa', async () => {
    let verifyCalls = 0;
    let refreshCalls = 0;

    server.use(
      http.get(verifyUrl, () => {
        verifyCalls++;
        return HttpResponse.json({ valid: false, message: 'Token no proporcionado' }, { status: 401 });
      }),
      http.post(refreshUrl, () => {
        refreshCalls++;
        return HttpResponse.json({ message: 'Refresh token no proporcionado' }, { status: 401 });
      })
    );

    const session = await bootstrapAuthSession();

    expect(session).toEqual({
      isAuthenticated: false,
      user: {
        id: '',
        name: '',
        email: '',
        role: '',
        professionalId: '',
      },
    });
    expect(verifyCalls).toBe(1);
    expect(refreshCalls).toBe(1);
    expect(authStore.getAccessToken()).toBeNull();
  });
});
