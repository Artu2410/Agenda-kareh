export const getMonthInputValue = (date = new Date()) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
);

const parseCurrencyLikeValue = (value) => {
  const normalized = String(value || '')
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .trim();

  if (!normalized) return 0;

  if (/^[\d.]+,\d{2}$/.test(normalized)) {
    const parsed = Number.parseFloat(normalized.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    const parsed = Number.parseFloat(normalized.replace(/\./g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (/^\d+(\.\d{1,2})?$/.test(normalized)) {
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

export const extractBonusAmounts = (...texts) => {
  const source = texts
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join('\n');

  const bonuses = [];
  const seen = new Set();
  const pattern = /\bbono(?:\s+de)?\s+(\d+)\s+sesiones?\s*:?\s*\$\s*([\d.,]+)(?=\s|$|\.|,|;|:)/gi;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    const sessions = Number.parseInt(match[1], 10);
    const amount = parseCurrencyLikeValue(match[2]);
    if (!Number.isFinite(sessions) || amount <= 0) continue;

    const key = `${sessions}|${amount.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    bonuses.push({
      label: `Bono ${sessions} sesiones`,
      sessions,
      amount,
    });
  }

  return bonuses;
};

export const shiftMonthValue = (monthValue, delta) => {
  const [year, month] = String(monthValue || '').split('-').map(Number);
  const baseDate = Number.isFinite(year) && Number.isFinite(month)
    ? new Date(year, month - 1 + delta, 1)
    : new Date();

  return getMonthInputValue(baseDate);
};

export const createEmptyManualForm = () => ({
  nombreOs: '',
  codigoCokiba: '',
  coseguroValor: 0,
  coseguroTexto: '',
  honorarioEstimado: 0,
  percentageCoinsurance: 0,
  fixedCopay: 0,
  plazoPago: 60,
  areaCobertura: '',
  documentLines: '',
  additionalDocumentInfo: '',
  usefulLinks: '',
  atendibleSanMiguel: false,
  isActive: true,
  requiresAuthorization: false,
  statusManualOverride: true,
});

export const getCokibaDetails = (obraSocial) => {
  const details =
    obraSocial?.cokibaDetails && typeof obraSocial.cokibaDetails === 'object'
      ? obraSocial.cokibaDetails
      : {};

  const linkMap = new Map();
  const pushLink = (href, label) => {
    const normalizedHref = String(href || '').trim();
    if (!normalizedHref) return;
    if (!linkMap.has(normalizedHref)) {
      linkMap.set(normalizedHref, {
        href: normalizedHref,
        label: String(label || normalizedHref).trim(),
      });
    }
  };

  if (Array.isArray(details.links)) {
    details.links.forEach((link) => pushLink(link?.href, link?.text));
  }

  pushLink(details.convenioUrl, details.convenioLabel || 'Convenio');
  pushLink(details.validacionUrl, 'Validación afiliatoria');
  pushLink(details.autorizacionUrl, 'Autorización');

  const bonusAmounts = extractBonusAmounts(details.coseguroTexto, details.observaciones);
  const normalized = details.normalizedData || {};

  return {
    arancelVigenteDesde: details.arancelVigenteDesde || '',
    cuit: details.cuit || '',
    areaCobertura: details.areaCobertura || '',
    coseguroTexto: details.coseguroTexto || '',
    observaciones: details.observaciones || '',
    numeroPrestador: details.numeroPrestador || '',
    authorizationNote: details.authorizationNote || '',
    norms: Array.isArray(details.norms) ? details.norms : [],
    tariffRows: Array.isArray(details.tariffRows) ? details.tariffRows : [],
    honorarioReferenciaPrestacion: details.honorarioReferenciaPrestacion || '',
    honorarioBasicaReferencia: parseFloat(details.honorarioBasicaReferencia) || 0,
    coinsuranceReliable: details.coinsuranceReliable !== false,
    bonusAmounts,
    bonusTotal: bonusAmounts.reduce((sum, bonus) => sum + (Number(bonus.amount) || 0), 0),
    links: [...linkMap.values()],
    billingMethod: normalized.billingMethod || '',
    billingPortal: normalized.billingPortal || '',
    billingEmail: normalized.billingEmail || '',
    honorarium: normalized.honorarium ?? null,
    paymentDays: normalized.paymentDays ?? null,
    copaymentRequired: normalized.copaymentRequired ?? false,
    copaymentAmount: normalized.copaymentAmount ?? null,
    plans: Array.isArray(normalized.plans) ? normalized.plans : [],
    authorization: normalized.authorization || {},
  };
};

export const parseTextareaLines = (value = '') => (
  String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
);

export const buildDocumentPayload = (documentLines = '', additionalInfo = '') => {
  const documents = parseTextareaLines(documentLines).map((line) => {
    const validityMatch = line.match(/\(?(\d+)\s*d[ií]as\)?/i);
    const name = line
      .replace(/\(?\d+\s*d[ií]as\)?/gi, '')
      .replace(/[():-]+$/g, '')
      .trim();

    return {
      name: name || line.trim(),
      mandatory: true,
      validityDays: validityMatch ? Number.parseInt(validityMatch[1], 10) : null,
    };
  });

  const normalizedAdditionalInfo = String(additionalInfo || '').trim();
  if (!documents.length && !normalizedAdditionalInfo) {
    return null;
  }

  return {
    documents,
    additionalInfo: normalizedAdditionalInfo,
  };
};

export const guessLinkLabel = (href = '') => {
  const normalized = String(href || '').toLowerCase();
  if (/autoriz/.test(normalized)) return 'Autorización';
  if (/valid|directconnection|prestador|afiliatoria/.test(normalized)) return 'Validación';
  if (/convenio/.test(normalized)) return 'Convenio';
  if (/manual/.test(normalized)) return 'Manual';
  return 'Link útil';
};

export const buildLinksPayload = (value = '') => {
  const seen = new Set();

  return parseTextareaLines(value)
    .filter((line) => /^https?:\/\//i.test(line))
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((href) => ({
      href,
      text: guessLinkLabel(href),
    }));
};

export const buildCokibaDetailsPayload = (currentDetails = {}, form = {}) => {
  const links = buildLinksPayload(form.usefulLinks);
  const convenioLink = links.find((link) => /convenio/i.test(link.text) || /convenio/i.test(link.href));
  const validacionLink = links.find((link) => /valid|directconnection|prestador|afiliatoria/i.test(`${link.text} ${link.href}`));
  const autorizacionLink = links.find((link) => /autoriz/i.test(`${link.text} ${link.href}`));

  return {
    ...currentDetails,
    areaCobertura: String(form.areaCobertura || '').trim(),
    coseguroTexto: String(form.coseguroTexto || '').trim(),
    authorizationNote:
      currentDetails?.authorizationNote
      || (form.requiresAuthorization ? 'Requiere autorización previa' : 'Sin autorización previa'),
    convenioUrl: convenioLink?.href || '',
    convenioLabel: convenioLink?.text || '',
    validacionUrl: validacionLink?.href || '',
    autorizacionUrl: autorizacionLink?.href || '',
    links,
  };
};
