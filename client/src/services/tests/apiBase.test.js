import { describe, expect, it } from 'vitest';
import { getApiBaseUrl, getApiUrl } from '../apiBase';

describe('apiBase helpers', () => {
  it('normaliza la base y agrega /api una sola vez', () => {
    expect(getApiBaseUrl('http://localhost:5000')).toBe('http://localhost:5000/api');
    expect(getApiBaseUrl('http://localhost:5000/')).toBe('http://localhost:5000/api');
    expect(getApiBaseUrl('http://localhost:5000/api')).toBe('http://localhost:5000/api');
    expect(getApiBaseUrl('http://localhost:5000/api/')).toBe('http://localhost:5000/api');
  });

  it('arma URLs sin duplicar /api ni //', () => {
    const logoutUrl = getApiUrl('/auth/logout');

    expect(logoutUrl).toMatch(/\/api\/auth\/logout$/);
    expect(logoutUrl).not.toContain('/api/api/');
    expect(logoutUrl).not.toContain('//api/');
  });
});
