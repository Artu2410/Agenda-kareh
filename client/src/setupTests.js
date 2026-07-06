import 'whatwg-fetch';
import '@testing-library/jest-dom/vitest';
import { JSDOM } from 'jsdom';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './tests/msw/server';
import { resetApiClientState } from './services/api';
import * as authStore from './stores/auth';

const ensureDom = () => {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return window;
  }

  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
  const { window: domWindow } = dom;

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: domWindow,
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: domWindow.document,
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: domWindow.navigator,
  });

  return domWindow;
};

const domWindow = ensureDom();

const createStorageShim = () => {
  const values = new Map();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    },
    removeItem(key) {
      values.delete(String(key));
    },
    key(index) {
      const entries = Array.from(values.entries());
      return entries[index]?.[0] ?? null;
    },
  };
};

const patchStorage = (storageName) => {
  const storage = createStorageShim();

  Object.defineProperty(globalThis, storageName, {
    configurable: true,
    value: storage,
  });
  Object.defineProperty(domWindow, storageName, {
    configurable: true,
    value: storage,
  });
  vi.stubGlobal(storageName, storage);
};

patchStorage('localStorage');
patchStorage('sessionStorage');

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
  if (typeof sessionStorage?.clear === 'function') {
    sessionStorage.clear();
  }
  vi.restoreAllMocks();
});
afterAll(() => server.close());
