export const normalizeCoverage = (value) => String(value || '').trim();

export const isParticularCoverage = (value, treatAsParticular = false) => {
  const normalized = normalizeCoverage(value).toLowerCase();
  return !!treatAsParticular || !normalized || normalized === 'particular';
};

export const getCoverageLabel = (value, treatAsParticular = false) => (
  isParticularCoverage(value, treatAsParticular) ? 'PARTICULAR' : normalizeCoverage(value).toUpperCase()
);

export const resolveCoverageSelectionId = (patientData = {}, selectedObraSocial = null) => {
  const explicitObraSocialId = normalizeCoverage(patientData.obraSocialId);

  if (explicitObraSocialId) {
    return explicitObraSocialId;
  }

  if (selectedObraSocial?.isActive) {
    return normalizeCoverage(selectedObraSocial.id);
  }

  return '';
};

export const resolveCoveragePayload = (patientData = {}, selectedObraSocial = null) => {
  const resolvedHealthInsurance = normalizeCoverage(patientData.healthInsurance || selectedObraSocial?.nombreOs);
  const resolvedObraSocialId = resolveCoverageSelectionId(patientData, selectedObraSocial);

  if (patientData.treatAsParticular) {
    return {
      obraSocialId: '',
      healthInsurance: resolvedHealthInsurance || 'PARTICULAR',
      treatAsParticular: true,
    };
  }

  return {
    obraSocialId: resolvedObraSocialId,
    healthInsurance: resolvedHealthInsurance,
    treatAsParticular: false,
  };
};
