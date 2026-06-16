const normalizeText = (value) => (
  String(value || '')
    .replace(/<!\[CDATA\[|\]\]>|<!--|-->/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
);

const normalizeLines = (value) => (
  String(value || '')
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter(Boolean)
);

const extractMoney = (value) => {
  const normalized = String(value || '')
    .replace(/\$/g, '')
    .replace(/\./g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '.')
    .trim();

  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const amount = Number.parseFloat(match[0]);
  return Number.isFinite(amount) ? amount : null;
};

const extractInt = (value) => {
  const normalized = String(value || '').replace(/\./g, '').replace(/,/g, '.').trim();
  const match = normalized.match(/\d+/);
  if (!match) return null;
  const amount = Number.parseInt(match[0], 10);
  return Number.isFinite(amount) ? amount : null;
};

const findEmail = (value) => {
  const match = String(value || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : '';
};

const findUrls = (value) => (
  Array.from(String(value || '').matchAll(/https?:\/\/[^\s)]+/gi), (match) => match[0])
);

const buildDocumentList = (textLines) => {
  const docs = [];
  const seen = new Set();

  textLines.forEach((line) => {
    const normalized = normalizeText(line);
    if (!normalized) return;

    const hasDocumentHint = /derivaci[oó]n|orden m[eé]dica|credencial|planilla|autorizaci[oó]n|documentaci[oó]n|certificado|historia cl[ií]nica|carn[eé]t|afiliatoria/i.test(normalized);
    if (!hasDocumentHint) return;

    const validity = /(?:\(?)(\d+)\s*d[ií]as?(?:\)?)/i.exec(normalized);
    const name = normalized
      .replace(/(?:\(?\d+\s*d[ií]as?(?:\)?))/gi, '')
      .replace(/[:\-]+$/g, '')
      .trim();

    const documentName = name || normalized;
    if (seen.has(documentName.toLowerCase())) return;
    seen.add(documentName.toLowerCase());

    docs.push({
      name: documentName,
      validityDays: validity ? Number.parseInt(validity[1], 10) : null,
    });
  });

  return docs;
};

const buildPlans = (textLines) => {
  const plans = [];
  const seen = new Set();

  textLines.forEach((line) => {
    const normalized = normalizeText(line);
    if (!normalized) return;

    if (/^(plan|planes)\b/i.test(normalized) || /delegaci[oó]n/i.test(normalized)) {
      const items = normalized.split(/,|;|\band\b|\by\b|\//i)
        .map((item) => item.replace(/^plan\s*/i, '').trim())
        .filter(Boolean);

      items.forEach((plan) => {
        const label = plan.replace(/:\s*$/, '').trim();
        if (!label) return;
        const key = label.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          plans.push(label);
        }
      });
    }
  });

  return plans;
};

const parseBillingMethod = (normalizedText, urls) => {
  const hasCokiba = /cokiba|autogesti[oó]n\.cokiba|portal cokiba|portal interno/i.test(normalizedText);
  const hasExternalPortal = /portal (externo|web externo)|pago en l[ií]nea|portal externo|https?:\/\//i.test(normalizedText);
  const hasPresential = /presencial|sucursal|oficina|en persona|atenci[oó]n personal/i.test(normalizedText);
  const hasMixed = /mixto|combinado|ambos|tamb[ié]n|o bien/i.test(normalizedText);

  if (hasMixed || (hasCokiba && hasPresential) || (hasExternalPortal && hasPresential)) {
    return 'Mixto';
  }

  if (hasCokiba) return 'Portal COKIBA';
  if (hasExternalPortal) return 'Portal externo';
  if (hasPresential) return 'Presencial';
  if (urls.some((url) => /cokiba/i.test(url))) return 'Portal COKIBA';
  if (urls.length > 0) return 'Portal externo';
  return 'Mixto';
};

const parseAuthorization = (normalizedText) => {
  const lower = normalizedText.toLowerCase();
  let type = 'Desconocida';

  if (/autom[aá]tica|automated|automática/i.test(normalizedText) && /manual|mixta|mixto/i.test(normalizedText)) {
    type = 'Mixta';
  } else if (/autom[aá]tica/i.test(normalizedText)) {
    type = 'Automática';
  } else if (/manual/i.test(normalizedText)) {
    type = 'Manual';
  }

  const channels = [];
  if (/whatsapp|wsp|whatsap/i.test(lower)) channels.push('WhatsApp');
  if (/portal/i.test(lower)) channels.push('Portal');
  if (/mail|correo|email|e-mail/i.test(lower)) channels.push('Mail');
  if (/sucursal|oficina|presencial/i.test(lower)) channels.push('Sucursal');

  return {
    type,
    channels: Array.from(new Set(channels)),
  };
};

const parseCopayment = (rawText) => {
  const normalized = normalizeText(rawText).toLowerCase();
  const amount = extractMoney(normalized);
  const required = /coseguro|copago|con copago|lleva coseguro|con coseguro/i.test(normalized) && amount > 0;

  return {
    required: required || /coseguro|copago/i.test(normalized),
    amount: amount || 0,
  };
};

export const normalizeCokibaDetails = ({
  lines = [],
  links = [],
  rawCoseguro = '',
  authorizationInfo = '',
  rawText = '',
  details = {},
}) => {
  const mergedText = [rawText, rawCoseguro, authorizationInfo, details.observaciones, details.convenioTexto]
    .filter(Boolean)
    .join('\n');

  const normalizedText = normalizeText(mergedText);
  const allLines = [
    ...lines,
    ...normalizeLines(rawCoseguro),
    ...normalizeLines(authorizationInfo),
    ...normalizeLines(details.observaciones),
    ...normalizeLines(details.convenioTexto),
  ].map(normalizeText).filter(Boolean);

  const documentLines = allLines.filter((line) => /derivaci[oó]n|credencial|planilla|orden m[eé]dica|autorizaci[oó]n|documentaci[oó]n|certificado|historia cl[ií]nica|carn[eé]t|afiliatoria/i.test(line));
  const documents = buildDocumentList(documentLines);

  const urls = [
    ...(links || []).filter(Boolean).map((link) => link.href || ''),
    ...findUrls(mergedText),
  ].filter(Boolean);

  const billingMethod = parseBillingMethod(normalizedText, urls);
  const billingPortal = urls.find((url) => /cokiba|portal/i.test(url)) || urls[0] || '';
  const billingEmail = findEmail(mergedText);

  const honorarium = extractMoney(details.honorarioReferenciaPrestacion || details.honorarioBasicaReferencia || details.coseguroTexto || details.observaciones) || null;
  const honorariumUpdatedAt = (() => {
    if (!details.arancelVigenteDesde) return null;
    const date = new Date(details.arancelVigenteDesde);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  })();

  const paymentDays = extractInt(normalizedText.match(/(plazo|pago).*?\b(\d{1,3})\b\s*d[ií]as?/i)?.[0] || normalizedText);

  const copayment = parseCopayment(rawCoseguro || normalizedText);

  const plans = buildPlans(allLines);

  const authorization = parseAuthorization([authorizationInfo, details.authorizationNote, details.observaciones, details.coseguroTexto].join('\n'));

  return {
    rawData: {
      lines,
      rawCoseguro,
      authorizationInfo,
      observations: normalizeText(details.observaciones || ''),
    },
    documents,
    billingMethod,
    billingPortal,
    billingEmail,
    honorarium,
    honorariumUpdatedAt,
    paymentDays: paymentDays || null,
    copaymentRequired: copayment.required,
    copaymentAmount: copayment.amount,
    plans,
    authorization,
  };
};
