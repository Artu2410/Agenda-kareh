const normalizeValue = (value, fallbackValue = 'unknown') => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return fallbackValue;
};

export const getClientReleaseInfo = () => ({
  version: normalizeValue(import.meta.env.VITE_APP_VERSION, 'local'),
  commit: normalizeValue(import.meta.env.VITE_COMMIT_SHA, ''),
});
