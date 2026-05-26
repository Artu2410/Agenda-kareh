const roundCurrency = (value) => Math.round((Number(value) || 0) * 100) / 100;

const normalizeCoverageId = (value) => (value === undefined || value === null || value === '' ? null : String(value));

export const resolveStoredHonorarioAmount = (appointment = {}) =>
  roundCurrency(appointment?.coinsuranceDetails?.honorario);

export const buildStoredFinancialSnapshot = ({ currentAppointment = null, nextObraSocialId = null, nextCharge = null } = {}) => {
  const normalizedCurrentCoverageId = normalizeCoverageId(currentAppointment?.obraSocialId);
  const normalizedNextCoverageId = normalizeCoverageId(nextObraSocialId);
  const shouldPreserveCurrentSnapshot = Boolean(currentAppointment)
    && normalizedCurrentCoverageId === normalizedNextCoverageId;

  if (shouldPreserveCurrentSnapshot) {
    return {
      coinsuranceAmount:
        currentAppointment?.coinsuranceAmount === undefined
        ? null
        : currentAppointment.coinsuranceAmount,
      patientChargeAmount:
        currentAppointment?.patientChargeAmount === undefined
        ? null
        : currentAppointment.patientChargeAmount,
      coinsuranceDetails: currentAppointment?.coinsuranceDetails ?? null,
    };
  }

  return {
    coinsuranceAmount: roundCurrency(nextCharge?.total),
    patientChargeAmount: roundCurrency(nextCharge?.total),
    coinsuranceDetails: nextCharge ?? null,
  };
};
