const roundCurrency = (value) => Math.round((Number(value) || 0) * 100) / 100;

export const parseDecimal = (value) => roundCurrency(value);

export const normalizeRequiredDocumentsConfig = (value) => {
  if (!value) {
    return { documents: [], additionalInfo: '' };
  }

  const source = typeof value === 'string' ? (() => {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  })() : value;

  const documents = Array.isArray(source?.documents)
    ? source.documents
      .map((document) => ({
        name: String(document?.name || '').trim(),
        mandatory: Boolean(document?.mandatory),
        validityDays: document?.validityDays === null || document?.validityDays === undefined || document?.validityDays === ''
          ? null
          : Number.parseInt(document.validityDays, 10),
      }))
      .filter((document) => document.name)
    : [];

  return {
    documents,
    additionalInfo: String(source?.additionalInfo || '').trim(),
  };
};

export const buildDocumentChecklist = ({ obraSocial, existingChecklist } = {}) => {
  if (existingChecklist && Array.isArray(existingChecklist?.documents)) {
    return existingChecklist;
  }

  const normalizedConfig = normalizeRequiredDocumentsConfig(obraSocial?.requiredDocuments);

  return {
    documents: normalizedConfig.documents.map((document) => ({
      ...document,
      presented: false,
      fileUrl: null,
      fileName: null,
      presentedAt: null,
      reusedFromAppointmentId: null,
    })),
    additionalInfo: normalizedConfig.additionalInfo,
  };
};

export const calculatePatientCharge = (obraSocial) => {
  const baseCopay = parseDecimal(obraSocial?.coseguroValor);
  const honorario = parseDecimal(obraSocial?.honorarioEstimado);
  const percentage = parseDecimal(obraSocial?.percentageCoinsurance);
  const fixedCopay = parseDecimal(obraSocial?.fixedCopay);
  const percentageAmount = percentage > 0 ? roundCurrency((honorario * percentage) / 100) : 0;
  const total = roundCurrency(baseCopay + percentageAmount + fixedCopay);

  return {
    baseCopay,
    honorario,
    percentage,
    percentageAmount,
    fixedCopay,
    total,
  };
};

export const isInactiveInsurance = (obraSocial) => Boolean(obraSocial && obraSocial.isActive === false);
