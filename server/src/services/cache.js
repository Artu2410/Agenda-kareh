// Simple in-memory cache with TTL (useful for low-traffic, single-instance deployments).
// For production / multi-instance, replace with Redis or similar.

const cacheStore = new Map();

export const setCache = (key, value, ttlMs = 60000) => {
  const expiresAt = Date.now() + ttlMs;
  cacheStore.set(key, { value, expiresAt });
};

export const getCache = (key) => {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }
  return entry.value;
};

export const delCache = (key) => {
  cacheStore.delete(key);
};

export const clearCache = () => {
  cacheStore.clear();
};
