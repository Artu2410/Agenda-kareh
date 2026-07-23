export const normalizeCoverage = (value) => String(value || '').trim();

export const isParticularCoverage = (value, treatAsParticular = false) => {
  const normalized = normalizeCoverage(value).toLowerCase();
  return !!treatAsParticular || !normalized || normalized === 'particular';
};

export const getCoverageLabel = (value, treatAsParticular = false) => (
  isParticularCoverage(value, treatAsParticular) ? 'PARTICULAR' : normalizeCoverage(value).toUpperCase()
);
