import { beforeEach, describe, expect, it } from 'vitest';
import { setAccessToken, clearAuth } from '../../stores/auth';
import { getAuthenticatedFileUrl } from '../fileUrl';

describe('getAuthenticatedFileUrl', () => {
  beforeEach(() => {
    clearAuth();
  });

  it('adds the in-memory access token to backend upload URLs', () => {
    setAccessToken('access-token');

    expect(getAuthenticatedFileUrl('/uploads/clinical-history/file.pdf'))
      .toBe('http://localhost:5000/uploads/clinical-history/file.pdf?token=access-token');
  });

  it('preserves data URLs and does not add tokens to external URLs', () => {
    setAccessToken('access-token');

    expect(getAuthenticatedFileUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
    expect(getAuthenticatedFileUrl('https://example.com/file.pdf')).toBe('https://example.com/file.pdf');
  });
});
