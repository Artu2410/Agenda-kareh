import 'whatwg-fetch';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './tests/msw/server';
import { resetApiClientState } from './services/api';
import * as authStore from './stores/auth';

// Start MSW before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetApiClientState();
  authStore.clearAuth();
  if (typeof localStorage?.clear === 'function') {
    localStorage.clear();
  }
  vi.restoreAllMocks();
});
afterAll(() => server.close());
