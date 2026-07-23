import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/msw/server';
import { getApiUrl } from '../apiBase';
import {
  clearCsrfToken,
  ensureCsrfToken,
  fetchCsrfToken,
  getStoredCsrfToken,
  setStoredCsrfToken,
} from '../csrf';

describe('csrf helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('guarda el token sólo en sessionStorage', () => {
    setStoredCsrfToken('session-token');

    expect(sessionStorage.getItem('csrfToken')).toBe('session-token');
    expect(localStorage.getItem('csrfToken')).toBeNull();
    expect(getStoredCsrfToken()).toBe('session-token');
  });

  it('usa el token cacheado sin pedir uno nuevo', async () => {
    sessionStorage.setItem('csrfToken', 'cached-token');

    await expect(ensureCsrfToken()).resolves.toBe('cached-token');
  });

  it('fetchCsrfToken persiste el token en sessionStorage', async () => {
    server.use(
      http.get(getApiUrl('/csrf-token'), () => HttpResponse.json({ token: 'fresh-token' }, { status: 200 }))
    );

    await expect(fetchCsrfToken()).resolves.toBe('fresh-token');
    expect(sessionStorage.getItem('csrfToken')).toBe('fresh-token');
  });

  it('clearCsrfToken limpia sessionStorage', () => {
    sessionStorage.setItem('csrfToken', 'to-clear');

    clearCsrfToken();

    expect(sessionStorage.getItem('csrfToken')).toBeNull();
  });
});
