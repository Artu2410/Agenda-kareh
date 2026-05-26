import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authStore from '../auth';

describe('auth store', () => {
  beforeEach(() => {
    authStore.clearAuth();
    localStorage.clear();
  });

  it('clearAuth limpia token y datos persistidos', () => {
    localStorage.setItem('userId', '123');
    authStore.setAccessToken('token-inicial');

    authStore.clearAuth();

    expect(authStore.getAccessToken()).toBeNull();
    expect(localStorage.getItem('userId')).toBeNull();
  });

  it('subscribe devuelve unsubscribe y evita listeners colgados', () => {
    const listener = vi.fn();
    const unsubscribe = authStore.subscribe(listener);

    authStore.setAccessToken('nuevo-token');
    expect(listener).toHaveBeenCalledWith('nuevo-token');

    unsubscribe();
    authStore.clearAuth();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
