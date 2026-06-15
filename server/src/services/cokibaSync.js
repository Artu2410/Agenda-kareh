import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer';
import { loadSupplementalCokibaCatalog, matchSupplementalCokibaEntry } from './cokibaTextCatalog.js';
import { sendCokibaAlertEmail } from './cokibaAlertMailer.js';
import { sendNotificationToAll } from '../controllers/notifications.controller.js';
import { normalizeCokibaDetails } from './cokibaNormalizer.js';
import { auditActions, safeWriteAuditLog } from '../utils/audit.js';
import {
  buildCokibaNotificationPayload,
  buildCokibaSnapshotRecord,
  computeCokibaDiff,
  deriveCokibaAuthorizationType,
  formatCokibaSyncDateKey,
  getNextCokibaSyncRunAt,
  summarizeCokibaDiff,
} from './cokibaSyncHelpers.js';
import logger from '../config/logger.js';

const COKIBA_OS_URL = 'https://autogestion.cokiba.org.ar/web/?q=form_os';

const WHITELIST_SAN_MIGUEL = [
  'OSDE',
  'SWISS MEDICAL',
  'GALENO',
  'MEDICUS',
  'OMINT',
  'HOSPITAL ITALIANO',
  'UNION PERSONAL',
  'OSPRERA',
  'OSECAC',
  'OSDEPYM',
  'ACCORD SALUD',
  'MEDIFE',
  'SANCOR SALUD',
  'PAMI',
];

const DEFAULT_LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
];

const KNOWN_LABELS = [
  'Arancel Vigente desde',
  'CUIT',
  'Area de Cobertura',
  'Coseguro',
  'Observaciones',
  'Convenio',
];

const SECTION_HEADING_PATTERN = /^(documentaci[oó]n|normas|presentaci[oó]n|normativa|importante:|nota:)/i;
const DOCUMENT_LINE_PATTERN =
  /derivaci[oó]n|validaci[oó]n|credencial|orden|planilla|bono|historia cl[ií]nica|certificado|prescripci[oó]n|autorizaci[oó]n previa|carnet|afiliatoria/i;
const STATUS_INACTIVE_PATTERN =
  /OBRA SOCIAL .*?(INACTIVA|SUSPENDIDA|BAJA|INACTIVO)|\bINACTIVA DESDE\b|\bSUSPENDIDA\b|\bBAJA\b/i;
const NOISE_PATTERN = /<!\[CDATA\[|<!--|-->|whatsclasstmp|\/\*--><!\]\]>\*\/|\.whatsclasstmp/i;

const getCokibaConfig = () => ({
  plazoPago: Number.parseInt(process.env.COKIBA_PLAZO_PAGO || '60', 10) || 60,
});

const buildConfigStatus = () => {
  const config = getCokibaConfig();

  return {
    configured: true,
    missingFields: [],
    placeholderFields: [],
    canSync: true,
    credentialsOptional: true,
    accessMode: 'public',
    plazoPago: config.plazoPago,
  };
};

const normalizeMoney = (value) => {
  if (!value) return 0;

  const clean = String(value).replace(/\$/g, '').replace(/\s/g, '').trim();

  if (/^[\d.]+,\d{2}$/.test(clean)) {
    const parsed = Number.parseFloat(clean.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (/^\d+(\.\d{1,2})?$/.test(clean)) {
    const parsed = Number.parseFloat(clean);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const normalizeText = (value) => (
  String(value || '')
    .replace(/<!--\/\*--><!\[CDATA\[\/* ><!--\*\//gi, ' ')
    .replace(/\/\*--><!\]\]>\*\//gi, ' ')
    .replace(/<!\[CDATA\[|\]\]>/gi, ' ')
    .replace(/<!--|-->/g, ' ')
    .replace(/\.whatsclasstmp\{[^}]+\}/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
);

const isNoiseLine = (value) => {
  const normalized = normalizeText(value);
  return !normalized || NOISE_PATTERN.test(normalized);
};

const normalizeLines = (value) => (
  String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => normalizeText(line))
    .filter((line) => line && !isNoiseLine(line))
);

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const uniqueBy = (items, getKey) => {
  const seen = new Set();

  return items.filter((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const mergeTextLines = (...values) => uniqueBy(
  values
    .flatMap((value) => String(value || '').split('\n'))
    .map((line) => normalizeText(line))
    .filter(Boolean),
  (line) => line.toLowerCase()
).join('\n');

const mergeLinks = (...collections) => uniqueBy(
  collections
    .flatMap((collection) => collection || [])
    .map((link) => ({
      href: normalizeText(link?.href),
      text: normalizeText(link?.text || link?.label || link?.href),
    }))
    .filter((link) => link.href),
  (link) => link.href.toLowerCase()
);

const extractUrlsFromText = (value) => uniqueBy(
  (String(value || '').match(/https?:\/\/[^\s)]+/gi) || [])
    .map((item) => item.replace(/[.,;]+$/, '')),
  (item) => item.toLowerCase()
);

const parseCoinsuranceRule = (rawText) => {
  const normalized = normalizeText(rawText);

  if (!normalized || /no posee|sin coseguro|sin copago|no corresponde/i.test(normalized)) {
    return {
      baseCopay: 0,
      percentageCoinsurance: 0,
      fixedCopay: 0,
      mode: 'none',
      isReliable: true,
    };
  }

  const percentageMatches = [...normalized.matchAll(/(\d+(?:[.,]\d+)?)\s*%/gi)]
    .map((match) => Number.parseFloat(match[1].replace(',', '.')))
    .filter((value) => Number.isFinite(value));

  const amountMatches = uniqueBy(
    [...normalized.matchAll(/\$\s*\d[\d.,]*/g)]
      .map((match) => normalizeMoney(match[0]))
      .filter((value) => value > 0),
    (value) => value.toFixed(2)
  );

  const hasComplexKeywords = /seg[uú]n|adicional|bono|por sesi[oó]n|modulo|m[oó]dulo|\s+y\s+|\/|\+/i.test(
    normalized
  );

  if (percentageMatches.length === 1 && amountMatches.length === 0) {
    return {
      baseCopay: 0,
      percentageCoinsurance: percentageMatches[0],
      fixedCopay: 0,
      mode: 'percentage',
      isReliable: true,
    };
  }

  if (percentageMatches.length === 0 && amountMatches.length === 1 && !hasComplexKeywords) {
    return {
      baseCopay: amountMatches[0],
      percentageCoinsurance: 0,
      fixedCopay: 0,
      mode: 'fixed',
      isReliable: true,
    };
  }

  return {
    baseCopay: null,
    percentageCoinsurance: null,
    fixedCopay: null,
    mode: 'complex',
    isReliable: false,
  };
};

const buildLabelRegex = (label) => new RegExp(`^${escapeRegex(label)}\\s*:?\\s*(.*)$`, 'i');

const isKnownLabelLine = (line) => KNOWN_LABELS.some((label) => buildLabelRegex(label).test(line));

const extractLabelValue = (lines, label, { multiline = false } = {}) => {
  const matcher = buildLabelRegex(label);
  const index = lines.findIndex((line) => matcher.test(line));

  if (index === -1) return '';

  const inlineValue = normalizeText(lines[index].replace(matcher, '$1'));
  if (inlineValue && !multiline) {
    return inlineValue;
  }
  const values = inlineValue ? [inlineValue] : [];

  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const current = normalizeText(lines[cursor]);
    if (!current) continue;
    if (isKnownLabelLine(current) || /^Superior$/i.test(current)) break;

    values.push(current);
    if (!multiline) break;
  }

  return normalizeText(values.join(' '));
};

const extractPostLabelLines = (lines, label) => {
  const matcher = buildLabelRegex(label);
  const index = lines.findIndex((line) => matcher.test(line));

  if (index === -1) return [];

  return lines
    .slice(index + 1)
    .map((line) => normalizeText(line))
    .filter((line) => line && !/^Superior$/i.test(line));
};

const cleanDisplayLabel = (value) => normalizeText(String(value || '').split('/')[0]);

const extractCleanInactiveStatus = (value) => {
  const normalized = normalizeText(value);
  return (
    normalizeText(
      normalized.match(/(OBRA SOCIAL\s+(?:INACTIVA|SUSPENDIDA|BAJA)[^\n]*)/i)?.[1]
      || normalized.match(/((?:INACTIVA|SUSPENDIDA|BAJA)\s+DESDE[^\n]*)/i)?.[1]
      || normalized.match(/((?:INACTIVA|SUSPENDIDA|BAJA)[^\n]*)/i)?.[1]
    ) || normalized
  );
};

const getNameFromStatusLine = (value) => {
  const normalized = normalizeText(value);
  const cleanStatus = extractCleanInactiveStatus(normalized);
  const statusIndex = cleanStatus ? normalized.indexOf(cleanStatus) : -1;
  if (statusIndex > 0) {
    return normalizeText(normalized.slice(0, statusIndex));
  }
  const match = normalized.match(/^(.*?)\s*OBRA SOCIAL\b/i);
  return normalizeText(match?.[1] || '');
};

const looksLikeInsuranceName = (value) => {
  const normalized = normalizeText(value);
  return Boolean(normalized) && /[A-ZÁÉÍÓÚÑ]{3,}/i.test(normalized) && !NOISE_PATTERN.test(normalized);
};

const pickDisplayName = (detail, lines, option) => {
  const ignoredHeadingPattern =
    /aranceles y normas|arancel vigente|cuit:|area de cobertura:|coseguro:|observaciones:|convenio|presentaci[oó]n de la facturaci[oó]n|normativa/i;

  const headingCandidate = (detail.headings || [])
    .map((heading) => normalizeText(heading))
    .find(
      (heading) =>
        heading &&
        !isNoiseLine(heading) &&
        !ignoredHeadingPattern.test(heading) &&
        !STATUS_INACTIVE_PATTERN.test(heading)
    );

  if (headingCandidate) return headingCandidate;

  const lineCandidate = lines.find(
    (line) =>
      !isNoiseLine(line) &&
      !isKnownLabelLine(line) &&
      !STATUS_INACTIVE_PATTERN.test(line) &&
      !SECTION_HEADING_PATTERN.test(line) &&
      !/^Aranceles y Normas de Facturaci[oó]n$/i.test(line) &&
      !/^Pasar al contenido principal$/i.test(line)
  );

  return lineCandidate || cleanDisplayLabel(option.label);
};

const detectStatus = (lines) => {
  const statusLine = lines.find((line) => STATUS_INACTIVE_PATTERN.test(line));

  if (statusLine) {
    return {
      detectedStatus: extractCleanInactiveStatus(statusLine),
      detectedIsActive: false,
    };
  }

  return {
    detectedStatus: 'Activa',
    detectedIsActive: true,
  };
};

const isDelegacion4 = (value) => /(?:DELEGACI[OÓ]N|DELEGACION|REGIONAL|DR)\s*(?:REGIONAL\s*)?(?:IV|4)\b/i.test(
  String(value || '')
);

const computeAtendibleSanMiguel = ({ nombreOs, areaCobertura, detailLines }) => {
  const normalizedArea = String(areaCobertura || '').toUpperCase();
  const combinedText = [nombreOs, areaCobertura, ...(detailLines || [])].join(' ').toUpperCase();

  if (normalizedArea.includes('PROVINCIA DE BUENOS AIRES')) {
    return true;
  }

  if (isDelegacion4(combinedText)) {
    return true;
  }

  if (combinedText.includes('SAN MIGUEL') || combinedText.includes('BELLA VISTA')) {
    return true;
  }

  const listedDistricts = normalizedArea
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (listedDistricts.length >= 3) {
    return false;
  }

  return WHITELIST_SAN_MIGUEL.some((item) => combinedText.includes(item));
};

const extractTariffDetails = (tables = []) => {
  const tariffTable = [...tables]
    .filter((table) => table.length > 1)
    .sort((a, b) => b.length - a.length)
    .find((table) =>
      table.some((row) => row.slice(1).some((cell) => normalizeMoney(cell) > 0))
    ) || [];

  const rows = tariffTable
    .map((row) => row.map((cell) => normalizeText(cell)))
    .filter((row) => row.some(Boolean));

  const headers = rows[0] || [];
  const dataRows = rows.slice(1)
    .map((row) => ({
      prestacion: normalizeText(row[0]),
      categoriaBasica: normalizeMoney(row[1] || 0),
      categoriaA: normalizeMoney(row[2] || 0),
      categoriaB: normalizeMoney(row[3] || 0),
      categoriaC: normalizeMoney(row[4] || 0),
      rawValues: row,
    }))
    .filter((row) => row.prestacion);

  const referenceRow =
    dataRows.find((row) => /consultorio/i.test(row.prestacion)) ||
    dataRows.find((row) => row.categoriaBasica > 0) ||
    null;

  return {
    headers,
    rows: dataRows,
    referenceRow,
  };
};

const cleanBulletLine = (line) => normalizeText(String(line || '').replace(/^[*-]\s*/, ''));

const buildRequiredDocuments = (lines = []) => {
  const documentCandidates = lines
    .map((line) => cleanBulletLine(line))
    .filter((line) => line && DOCUMENT_LINE_PATTERN.test(line));

  const documents = uniqueBy(
    documentCandidates.map((line) => {
      const validityMatch = line.match(/(?:validez|vigencia)\s*(\d+)\s*d[ií]as/i);

      return {
        name: normalizeText(line.replace(/\((?:validez|vigencia)[^)]+\)/gi, '').replace(/\.+$/, '')),
        mandatory: true,
        validityDays: validityMatch ? Number.parseInt(validityMatch[1], 10) : null,
      };
    }),
    (document) => document.name.toLowerCase()
  );

  const additionalInfo = uniqueBy(
    lines
      .map((line) => cleanBulletLine(line))
      .filter(
        (line) =>
          line &&
          !/^aqu[ií]$/i.test(line) &&
          (
            /autoriz|validaci[oó]n|verificaci[oó]n|prestador|http|www\.|plazo m[aá]ximo|internaci[oó]n|copago|domicilio|direct connection/i.test(
              line
            ) ||
            (SECTION_HEADING_PATTERN.test(line) && !/^documentaci[oó]n/i.test(line))
          )
      ),
    (line) => line.toLowerCase()
  ).join('\n');

  return {
    documents,
    additionalInfo,
  };
};

const extractAuthorizationInfo = (lines = []) => {
  const joined = normalizeText(lines.join(' '));
  const authLine = lines.find((line) => /autoriz/i.test(line)) || '';

  if (/autorizaci[oó]n previa no es obligatoria|no requiere autorizaci[oó]n previa|sin autorizaci[oó]n previa/i.test(joined)) {
    return {
      value: false,
      isReliable: true,
      note: authLine || 'Sin autorizacion previa obligatoria',
    };
  }

  if (
    /autorizaci[oó]n previa a trav[eé]s|autorizaci[oó]n previa obligatoria|requiere autorizaci[oó]n|debe autorizar|solicitar una autorizaci[oó]n/i.test(
      joined
    )
  ) {
    return {
      value: true,
      isReliable: true,
      note: authLine || 'Requiere autorizacion previa',
    };
  }

  return {
    value: null,
    isReliable: false,
    note: authLine || '',
  };
};

const filterRelevantLinks = (links = []) => uniqueBy(
  links
    .map((link) => ({
      text: normalizeText(link.text),
      href: normalizeText(link.href),
    }))
    .filter(
      (link) =>
        link.href &&
        /^https?:\/\//i.test(link.href) &&
        !/\/web\/\?q=form_os$/i.test(link.href) &&
        !/\/web\/?$/i.test(link.href) &&
        !/#(?:main-content|top)$/i.test(link.href)
    ),
  (link) => `${link.href.toLowerCase()}|${link.text.toLowerCase()}`
);

const buildCokibaDetails = ({ detail, lines, tariffs, rawCoseguro, postConventionLines, authorizationInfo }) => {
  const relevantLinks = filterRelevantLinks(detail.links || []);
  const inlineUrls = extractUrlsFromText(detail.bodyText);
  const combinedUrls = uniqueBy(
    [
      ...relevantLinks.map((link) => link.href),
      ...inlineUrls,
    ],
    (value) => value.toLowerCase()
  );

  const agreementLink = relevantLinks.find((link) => /convenio|\.pdf/i.test(`${link.text} ${link.href}`));
  const validationLink =
    relevantLinks.find((link) => /valid|directconnection|afiliatoria|prestador/i.test(`${link.text} ${link.href}`)) ||
    combinedUrls.find((url) => /valid|directconnection|afiliatoria|prestador/i.test(url)) ||
    '';
  const authorizationLink =
    relevantLinks.find((link) => /autoriz/i.test(`${link.text} ${link.href}`)) ||
    combinedUrls.find((url) => /autoriz/i.test(url)) ||
    '';

  return {
    arancelVigenteDesde: extractLabelValue(lines, 'Arancel Vigente desde'),
    cuit: extractLabelValue(lines, 'CUIT'),
    areaCobertura: extractLabelValue(lines, 'Area de Cobertura'),
    coseguroTexto: rawCoseguro,
    observaciones: extractLabelValue(lines, 'Observaciones', { multiline: true }),
    convenioTexto: extractLabelValue(lines, 'Convenio'),
    convenioUrl: agreementLink?.href || '',
    convenioLabel: agreementLink?.text || '',
    validacionUrl: typeof validationLink === 'string' ? validationLink : validationLink?.href || '',
    autorizacionUrl: typeof authorizationLink === 'string' ? authorizationLink : authorizationLink?.href || '',
    numeroPrestador: (
      lines.find((line) => /numero de prestador de cokiba/i.test(line))
        ?.replace(/.*numero de prestador de cokiba:\s*/i, '')
        ?.trim() || ''
    ),
    authorizationNote: authorizationInfo.note,
    norms: uniqueBy(
      postConventionLines
        .map((line) => cleanBulletLine(line))
        .filter((line) => line && !/^aqu[ií]$/i.test(line)),
      (line) => line.toLowerCase()
    ),
    links: relevantLinks,
    extractedUrls: combinedUrls,
    tariffHeaders: tariffs.headers,
    tariffRows: tariffs.rows,
    honorarioReferenciaPrestacion: tariffs.referenceRow?.prestacion || '',
    honorarioBasicaReferencia: tariffs.referenceRow?.categoriaBasica || 0,
  };
};

const mergeRequiredDocuments = (baseValue, supplementValue) => {
  const baseDocuments = Array.isArray(baseValue?.documents) ? baseValue.documents : [];
  const supplementalDocuments = Array.isArray(supplementValue?.documents) ? supplementValue.documents : [];
  const documentsByName = new Map();

  [...baseDocuments, ...supplementalDocuments].forEach((document) => {
    const name = normalizeText(document?.name);
    if (!name) return;

    const key = name.toLowerCase();
    const current = documentsByName.get(key) || {
      name,
      mandatory: false,
      validityDays: null,
    };

    documentsByName.set(key, {
      name,
      mandatory: current.mandatory || Boolean(document?.mandatory),
      validityDays:
        current.validityDays === null || current.validityDays === undefined
          ? (document?.validityDays ?? null)
          : current.validityDays,
    });
  });

  return {
    documents: [...documentsByName.values()],
    additionalInfo: mergeTextLines(baseValue?.additionalInfo, supplementValue?.additionalInfo),
  };
};

const mergeSupplementalRecord = (record, option, supplementalCatalog) => {
  const supplementalEntry = matchSupplementalCokibaEntry({
    entries: supplementalCatalog,
    candidates: [record.nombreOs, cleanDisplayLabel(option.label), option.label],
  });

  if (!supplementalEntry) {
    return record;
  }

  const baseDetails = record.cokibaDetails || {};
  const supplementalDetails = supplementalEntry.cokibaDetails || {};
  const mergedRequiredDocuments = mergeRequiredDocuments(record.requiredDocuments, supplementalEntry.requiredDocuments);
  const mergedDetails = {
    ...baseDetails,
    arancelVigenteDesde: baseDetails.arancelVigenteDesde || supplementalDetails.arancelVigenteDesde || '',
    cuit: baseDetails.cuit || supplementalDetails.cuit || '',
    areaCobertura: baseDetails.areaCobertura || supplementalDetails.areaCobertura || '',
    coseguroTexto:
      baseDetails.coseguroTexto && baseDetails.coinsuranceReliable !== false
        ? baseDetails.coseguroTexto
        : (supplementalDetails.coseguroTexto || baseDetails.coseguroTexto || ''),
    observaciones: mergeTextLines(baseDetails.observaciones, supplementalDetails.observaciones),
    convenioTexto: baseDetails.convenioTexto || supplementalDetails.convenioTexto || '',
    convenioUrl:
      /convenio/i.test(baseDetails.convenioUrl || '')
        ? (baseDetails.convenioUrl || '')
        : (supplementalDetails.convenioUrl || baseDetails.convenioUrl || ''),
    convenioLabel: baseDetails.convenioLabel || supplementalDetails.convenioLabel || '',
    validacionUrl: baseDetails.validacionUrl || supplementalDetails.validacionUrl || '',
    autorizacionUrl: baseDetails.autorizacionUrl || supplementalDetails.autorizacionUrl || '',
    numeroPrestador: baseDetails.numeroPrestador || supplementalDetails.numeroPrestador || '',
    authorizationNote: baseDetails.authorizationNote || supplementalDetails.authorizationNote || '',
    norms: uniqueBy(
      [...(baseDetails.norms || []), ...(supplementalDetails.norms || [])].map((line) => normalizeText(line)).filter(Boolean),
      (line) => line.toLowerCase()
    ),
    links: mergeLinks(baseDetails.links, supplementalDetails.links),
    extractedUrls: uniqueBy(
      [...(baseDetails.extractedUrls || []), ...(supplementalDetails.extractedUrls || [])].map((url) => normalizeText(url)).filter(Boolean),
      (url) => url.toLowerCase()
    ),
    tariffHeaders: Array.isArray(baseDetails.tariffHeaders) && baseDetails.tariffHeaders.length
      ? baseDetails.tariffHeaders
      : (supplementalDetails.tariffHeaders || []),
    tariffRows: Array.isArray(baseDetails.tariffRows) && baseDetails.tariffRows.length
      ? baseDetails.tariffRows
      : (supplementalDetails.tariffRows || []),
    honorarioReferenciaPrestacion:
      baseDetails.honorarioReferenciaPrestacion || supplementalDetails.honorarioReferenciaPrestacion || '',
    honorarioBasicaReferencia:
      baseDetails.honorarioBasicaReferencia || supplementalDetails.honorarioBasicaReferencia || 0,
    supplementalCatalogMatch: supplementalEntry.nombreOs,
    authorizationType:
      baseDetails.authorizationType
      || supplementalDetails.authorizationType
      || deriveCokibaAuthorizationType({
        authorizationNote: baseDetails.authorizationNote || supplementalDetails.authorizationNote || '',
        authorizationUrl: baseDetails.autorizacionUrl || supplementalDetails.autorizacionUrl || '',
        validationUrl: baseDetails.validacionUrl || supplementalDetails.validacionUrl || '',
        convenienceText: baseDetails.convenioTexto || supplementalDetails.convenioTexto || '',
        additionalText: [
          ...(baseDetails.norms || []),
          ...(supplementalDetails.norms || []),
        ].join(' '),
      }),
  };

  const supplementalCoinsuranceRule = parseCoinsuranceRule(supplementalDetails.coseguroTexto || '');
  const shouldUseSupplementalCoinsurance =
    (!baseDetails.coseguroTexto || baseDetails.coinsuranceReliable === false) &&
    supplementalCoinsuranceRule.isReliable;

  return {
    ...record,
    coseguroValor: shouldUseSupplementalCoinsurance ? supplementalCoinsuranceRule.baseCopay : record.coseguroValor,
    percentageCoinsurance: shouldUseSupplementalCoinsurance
      ? supplementalCoinsuranceRule.percentageCoinsurance
      : record.percentageCoinsurance,
    fixedCopay: shouldUseSupplementalCoinsurance ? supplementalCoinsuranceRule.fixedCopay : record.fixedCopay,
    estado:
      record.detectedIsActive === false || !supplementalEntry.detectedStatus
        ? record.estado
        : supplementalEntry.detectedStatus,
    isActive:
      record.detectedIsActive === false || supplementalEntry.detectedIsActive === null || supplementalEntry.detectedIsActive === undefined
        ? record.isActive
        : supplementalEntry.detectedIsActive,
    detectedStatus:
      record.detectedIsActive === false || !supplementalEntry.detectedStatus
        ? record.detectedStatus
        : supplementalEntry.detectedStatus,
    detectedIsActive:
      record.detectedIsActive === false || supplementalEntry.detectedIsActive === null || supplementalEntry.detectedIsActive === undefined
        ? record.detectedIsActive
        : supplementalEntry.detectedIsActive,
    requiresAuthorization:
      record.requiresAuthorization === null || record.requiresAuthorization === undefined
        ? supplementalEntry.requiresAuthorization
        : record.requiresAuthorization,
    authorizationType:
      record.authorizationType
      || mergedDetails.authorizationType
      || deriveCokibaAuthorizationType({
        authorizationNote: mergedDetails.authorizationNote || '',
        authorizationUrl: mergedDetails.autorizacionUrl || '',
        validationUrl: mergedDetails.validacionUrl || '',
        convenienceText: mergedDetails.convenioTexto || '',
        additionalText: mergedDetails.observaciones || '',
        lines: [...(mergedDetails.norms || []), ...(mergedDetails.extractedUrls || [])],
      }),
    atendibleSanMiguel:
      record.atendibleSanMiguel ||
      computeAtendibleSanMiguel({
        nombreOs: record.nombreOs || supplementalEntry.nombreOs,
        areaCobertura: mergedDetails.areaCobertura,
        detailLines: [
          ...(mergedDetails.norms || []),
          mergedDetails.observaciones,
          mergedDetails.authorizationNote,
          supplementalEntry.nombreOs,
        ],
      }),
    requiredDocuments: mergedRequiredDocuments,
    cokibaDetails: {
      ...mergedDetails,
      coinsuranceMode: shouldUseSupplementalCoinsurance
        ? supplementalCoinsuranceRule.mode
        : baseDetails.coinsuranceMode,
      coinsuranceReliable: shouldUseSupplementalCoinsurance
        ? supplementalCoinsuranceRule.isReliable
        : baseDetails.coinsuranceReliable,
      authorizationType:
        mergedDetails.authorizationType
        || record.authorizationType
        || deriveCokibaAuthorizationType({
          authorizationNote: mergedDetails.authorizationNote || '',
          authorizationUrl: mergedDetails.autorizacionUrl || '',
          validationUrl: mergedDetails.validacionUrl || '',
          convenienceText: mergedDetails.convenioTexto || '',
          additionalText: mergedDetails.observaciones || '',
          lines: [...(mergedDetails.norms || []), ...(mergedDetails.extractedUrls || [])],
        }),
    },
    normalizedData: normalizeCokibaDetails({
      lines: [],
      links: mergeLinks(baseDetails.links, supplementalDetails.links),
      rawCoseguro: mergedDetails.coseguroTexto,
      authorizationInfo: mergedDetails.authorizationNote,
      rawText: mergeTextLines(mergedDetails.observaciones, mergedDetails.convenioTexto),
      details: mergedDetails,
    }),
  };
};

const extractDetailRecord = (detail, option, plazoPago) => {
  const lines = normalizeLines(detail.bodyText).filter(
    (line) =>
      !/^Aranceles y Normas de Facturaci[oó]n(\s*\|.*)?$/i.test(line) &&
      !/^Pasar al contenido principal$/i.test(line) &&
      !/^Superior$/i.test(line)
  );

  const initialName = pickDisplayName(detail, lines, option);
  const { detectedStatus, detectedIsActive } = detectStatus(lines);
  const statusDerivedName = getNameFromStatusLine(detectedStatus);
  const nombreOs =
    looksLikeInsuranceName(initialName)
      ? initialName
      : (looksLikeInsuranceName(statusDerivedName) ? statusDerivedName : cleanDisplayLabel(option.label));
  const areaCobertura = extractLabelValue(lines, 'Area de Cobertura');
  const rawCoseguro = extractLabelValue(lines, 'Coseguro', { multiline: true });
  const postConventionLines = extractPostLabelLines(lines, 'Convenio');
  const tariffs = extractTariffDetails(detail.tables);
  const authorizationInfo = extractAuthorizationInfo(lines);
  const coinsuranceRule = parseCoinsuranceRule(rawCoseguro);
  const requiredDocuments = buildRequiredDocuments(
    uniqueBy(
      [
        ...lines.filter((line) => /^[-*]\s*/.test(line) || DOCUMENT_LINE_PATTERN.test(line)),
        ...postConventionLines,
      ],
      (line) => normalizeText(line).toLowerCase()
    )
  );
  const cokibaDetails = buildCokibaDetails({
    detail,
    lines,
    tariffs,
    rawCoseguro,
    postConventionLines,
    authorizationInfo,
  });
  const normalizedData = normalizeCokibaDetails({
    lines,
    links: cokibaDetails.links,
    rawCoseguro,
    authorizationInfo: authorizationInfo.note,
    rawText: detail.bodyText,
    details: cokibaDetails,
  });
  const authorizationType = deriveCokibaAuthorizationType({
    authorizationNote: authorizationInfo.note,
    authorizationUrl: cokibaDetails.autorizacionUrl,
    validationUrl: cokibaDetails.validacionUrl,
    convenienceText: cokibaDetails.convenioTexto,
    additionalText: cokibaDetails.observaciones,
    lines: [
      ...lines.slice(0, 60),
      ...(cokibaDetails.norms || []),
      ...(cokibaDetails.extractedUrls || []),
    ],
  });

  return {
    codigoCokiba: option.value,
    nombreOs,
    coseguroValor: coinsuranceRule.baseCopay,
    percentageCoinsurance: coinsuranceRule.percentageCoinsurance,
    fixedCopay: coinsuranceRule.fixedCopay,
    honorarioEstimado: tariffs.referenceRow?.categoriaBasica || 0,
    plazoPago,
    estado: detectedStatus,
    isActive: detectedIsActive,
    detectedStatus,
    detectedIsActive,
    requiresAuthorization: authorizationInfo.isReliable ? authorizationInfo.value : null,
    authorizationType,
    atendibleSanMiguel: computeAtendibleSanMiguel({
      nombreOs,
      areaCobertura,
      detailLines: [
        ...lines.slice(0, 40),
        ...(cokibaDetails.norms || []).slice(0, 20),
      ],
    }),
    requiredDocuments,
    cokibaDetails: {
      ...cokibaDetails,
      coinsuranceMode: coinsuranceRule.mode,
      coinsuranceReliable: coinsuranceRule.isReliable,
      authorizationType,
    },
    normalizedData,
    rawCategoria: 'Básica',
  };
};

const fetchOptionCatalog = async (page, logger) => {
  logger.info('📋 Navegando a la sección pública de Obras Sociales...');
  await page.goto(COKIBA_OS_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('#edit-seleccion-os-obrasocial', { timeout: 15000 });

  const catalog = await page.evaluate(() => {
    const select = document.querySelector('#edit-seleccion-os-obrasocial');
    const form = document.querySelector('form');
    if (!select || !form) return null;

    return {
      action: form.getAttribute('action') || location.href,
      formBuildId: form.querySelector('input[name="form_build_id"]')?.value || '',
      formToken: form.querySelector('input[name="form_token"]')?.value || '',
      formId: form.querySelector('input[name="form_id"]')?.value || '',
      options: Array.from(select.querySelectorAll('option'))
        .map((option) => ({
          value: option.value,
          label: option.textContent.trim(),
        }))
        .filter((option) => option.value && option.label),
    };
  });

  if (!catalog) {
    throw new Error('No se pudo leer el selector de obras sociales en COKIBA.');
  }

  logger.info(`📊 Se encontraron ${catalog.options.length} obras sociales en el selector`);
  return catalog;
};

const fetchOptionDetails = async (page, catalog, option) => {
  const detail = await page.evaluate(async (payload) => {
    const targetUrl = new URL(payload.action, window.location.origin).toString();
    const params = new URLSearchParams();
    params.set('seleccion_OS[obrasocial]', payload.optionValue);
    params.set('op', 'Seleccionar');
    params.set('form_build_id', payload.formBuildId);
    params.set('form_token', payload.formToken);
    params.set('form_id', payload.formId);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      credentials: 'include',
    });

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    return {
      ok: response.ok,
      status: response.status,
      headings: Array.from(doc.querySelectorAll('h1,h2,h3,h4,strong,b'))
        .map((element) => element.textContent.trim())
        .filter(Boolean),
      tables: Array.from(doc.querySelectorAll('table'))
        .map((table) =>
          Array.from(table.querySelectorAll('tr')).map((tr) =>
            Array.from(tr.children).map((cell) => cell.textContent.trim())
          )
        )
        .filter((table) => table.length > 1),
      bodyText: doc.body?.innerText || doc.body?.textContent || '',
      links: Array.from(doc.querySelectorAll('a[href]'))
        .map((anchor) => ({
          text: anchor.textContent.trim(),
          href: new URL(anchor.getAttribute('href'), window.location.origin).toString(),
        }))
        .filter((link) => link.href),
    };
  }, {
    action: catalog.action,
    formBuildId: catalog.formBuildId,
    formToken: catalog.formToken,
    formId: catalog.formId,
    optionValue: option.value,
  });

  if (!detail.ok) {
    throw new Error(`Respuesta HTTP ${detail.status}`);
  }

  return detail;
};

const collectObrasSociales = async (page, plazoPago, logger) => {
  const catalog = await fetchOptionCatalog(page, logger);
  const supplementalCatalog = await loadSupplementalCokibaCatalog({ logger });
  const result = [];

  for (const [index, option] of catalog.options.entries()) {
    try {
      let detail = null;

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          detail = await fetchOptionDetails(page, catalog, option);
          break;
        } catch (error) {
          if (attempt === 2) {
            throw error;
          }

          logger.warn(
            `⚠️ Reintentando ${option.value} · ${cleanDisplayLabel(option.label)} tras fallo transitorio: ${error.message}`
          );
          await wait(1500);
        }
      }

      const record = mergeSupplementalRecord(
        extractDetailRecord(detail, option, plazoPago),
        option,
        supplementalCatalog
      );
      result.push(record);

      if ((index + 1) % 10 === 0 || index === catalog.options.length - 1) {
        logger.info(`✔ Progreso COKIBA: ${index + 1}/${catalog.options.length}`);
      }
    } catch (error) {
      logger.warn(`⚠️ No se pudo extraer ${option.value} · ${cleanDisplayLabel(option.label)}: ${error.message}`);
    }
  }

  logger.info(`✅ ${result.length} obras sociales extraídas con detalle`);
  return result;
};

const pickSyncedValue = (nextValue, currentValue, fallbackValue) => (
  nextValue === null || nextValue === undefined
    ? (currentValue === null || currentValue === undefined ? fallbackValue : currentValue)
    : nextValue
);

const synchronizeRows = async (prisma, obrasSociales, logger) => {
  let created = 0;
  let updated = 0;

  for (const obraSocial of obrasSociales) {
    const existing = await prisma.obraSocial.findUnique({
      where: { codigoCokiba: obraSocial.codigoCokiba },
      select: {
        id: true,
        estado: true,
        isActive: true,
        statusManualOverride: true,
        coseguroValor: true,
        percentageCoinsurance: true,
        fixedCopay: true,
        requiresAuthorization: true,
        requiredDocuments: true,
      },
    });

    const updateData = {
      nombreOs: obraSocial.nombreOs,
      coseguroValor: pickSyncedValue(obraSocial.coseguroValor, existing?.coseguroValor, 0),
      percentageCoinsurance: pickSyncedValue(
        obraSocial.percentageCoinsurance,
        existing?.percentageCoinsurance,
        0
      ),
      fixedCopay: pickSyncedValue(obraSocial.fixedCopay, existing?.fixedCopay, 0),
      honorarioEstimado: obraSocial.honorarioEstimado,
      honorarium: obraSocial.normalizedData?.honorarium ?? null,
      plazoPago: obraSocial.plazoPago,
      billingMethod: obraSocial.normalizedData?.billingMethod || null,
      paymentDays: obraSocial.normalizedData?.paymentDays ?? null,
      copaymentRequired: obraSocial.normalizedData?.copaymentRequired ?? false,
      copaymentAmount: obraSocial.normalizedData?.copaymentAmount ?? null,
      allowedPlans: obraSocial.normalizedData?.plans || null,
      normalizedData: obraSocial.normalizedData ?? null,
      detectedStatus: obraSocial.detectedStatus,
      detectedIsActive: obraSocial.detectedIsActive,
      requiresAuthorization:
        obraSocial.requiresAuthorization === null || obraSocial.requiresAuthorization === undefined
          ? (existing?.requiresAuthorization ?? false)
          : obraSocial.requiresAuthorization,
      authorizationType:
        obraSocial.authorizationType === null || obraSocial.authorizationType === undefined
          ? (existing?.authorizationType ?? null)
          : obraSocial.authorizationType,
      atendibleSanMiguel: obraSocial.atendibleSanMiguel,
      requiredDocuments:
        obraSocial.requiredDocuments?.documents?.length || obraSocial.requiredDocuments?.additionalInfo
          ? obraSocial.requiredDocuments
          : (existing?.requiredDocuments ?? null),
      cokibaDetails: obraSocial.cokibaDetails,
      rawCategoria: obraSocial.rawCategoria,
      ultimaSync: new Date(),
    };

    if (!existing?.statusManualOverride) {
      updateData.estado = obraSocial.estado;
      updateData.isActive = obraSocial.isActive;
    }

    await prisma.obraSocial.upsert({
      where: { codigoCokiba: obraSocial.codigoCokiba },
      update: updateData,
      create: {
        codigoCokiba: obraSocial.codigoCokiba,
        nombreOs: obraSocial.nombreOs,
        coseguroValor: obraSocial.coseguroValor ?? 0,
        percentageCoinsurance: obraSocial.percentageCoinsurance ?? 0,
        fixedCopay: obraSocial.fixedCopay ?? 0,
        honorarioEstimado: obraSocial.honorarioEstimado,
        honorarium: obraSocial.normalizedData?.honorarium ?? null,
        plazoPago: obraSocial.plazoPago,
        billingMethod: obraSocial.normalizedData?.billingMethod || null,
        paymentDays: obraSocial.normalizedData?.paymentDays ?? null,
        copaymentRequired: obraSocial.normalizedData?.copaymentRequired ?? false,
        copaymentAmount: obraSocial.normalizedData?.copaymentAmount ?? null,
        allowedPlans: obraSocial.normalizedData?.plans || null,
        normalizedData: obraSocial.normalizedData ?? null,
        estado: obraSocial.estado,
        isActive: obraSocial.isActive,
        detectedStatus: obraSocial.detectedStatus,
        detectedIsActive: obraSocial.detectedIsActive,
        statusManualOverride: false,
        requiresAuthorization: obraSocial.requiresAuthorization ?? false,
        authorizationType: obraSocial.authorizationType ?? null,
        atendibleSanMiguel: obraSocial.atendibleSanMiguel,
        requiredDocuments: obraSocial.requiredDocuments,
        cokibaDetails: obraSocial.cokibaDetails,
        rawCategoria: obraSocial.rawCategoria,
        ultimaSync: new Date(),
      },
    });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  logger.info(`✅ Sincronización completada: ${created} nuevas, ${updated} actualizadas`);
  return { created, updated, total: obrasSociales.length };
};

const defaultLogger = logger.child({ service: 'cokiba-sync' });

const buildPreviousSnapshot = (auditLogEntry) => {
  const records = auditLogEntry?.newValues?.records;
  return Array.isArray(records) ? records : [];
};

const serializeCokibaStatus = (status = {}) => ({
  ...status,
  lastSyncAt: status.lastSyncAt ? new Date(status.lastSyncAt).toISOString() : null,
  lastSnapshotAt: status.lastSnapshotAt ? new Date(status.lastSnapshotAt).toISOString() : null,
  lastDiffAt: status.lastDiffAt ? new Date(status.lastDiffAt).toISOString() : null,
});

const getLatestCokibaAuditEntry = async (prisma, action) => prisma.auditLog.findFirst({
  where: {
    entityType: 'COKIBA_SYNC',
    action,
  },
  orderBy: { createdAt: 'desc' },
  select: {
    createdAt: true,
    newValues: true,
    details: true,
  },
});

const persistCokibaAuditArtifacts = async ({
  prisma,
  trigger,
  snapshotRecords,
  previousSnapshotRecords,
  status,
  logger: syncLogger,
}) => {
  const snapshotDateKey = formatCokibaSyncDateKey();
  const diff = computeCokibaDiff(previousSnapshotRecords, snapshotRecords);
  const diffSummary = summarizeCokibaDiff(diff);
  const serializedStatus = serializeCokibaStatus(status);
  const snapshotAt = new Date().toISOString();
  const notificationPayload = buildCokibaNotificationPayload({
    summary: serializedStatus,
    diffSummary,
    snapshotAt,
  });

  await safeWriteAuditLog(prisma, { headers: {}, user: null }, {
    action: auditActions.cokibaSyncSnapshot,
    entityType: 'COKIBA_SYNC',
    entityId: snapshotDateKey,
    newValues: {
      records: snapshotRecords,
      summary: serializedStatus,
    },
    details: {
      trigger,
      snapshotDateKey,
      diffSummary,
    },
  });

  if (diffSummary.hasChanges) {
    await safeWriteAuditLog(prisma, { headers: {}, user: null }, {
      action: auditActions.cokibaSyncDiff,
      entityType: 'COKIBA_SYNC',
      entityId: snapshotDateKey,
      newValues: {
        diff,
        diffSummary,
      },
      details: {
        trigger,
        snapshotDateKey,
      },
    });

    try {
      await sendNotificationToAll(prisma, notificationPayload);
    } catch (error) {
      syncLogger.warn('⚠️ No se pudieron enviar notificaciones internas COKIBA', {
        errorMessage: error.message,
      });
    }

    try {
      await sendCokibaAlertEmail({
        diffSummary,
        diff,
        snapshotAt,
      });
    } catch (error) {
      syncLogger.warn('⚠️ No se pudo enviar el email de alerta COKIBA', {
        errorMessage: error.message,
      });
    }

    await safeWriteAuditLog(prisma, { headers: {}, user: null }, {
      action: auditActions.cokibaSyncAlert,
      entityType: 'COKIBA_SYNC',
      entityId: snapshotDateKey,
      details: {
        trigger,
        snapshotDateKey,
        notificationPayload,
      },
    });
  }

  return { diff, diffSummary, notificationPayload };
};

export const getCokibaSyncStatus = async (prisma) => {
  const config = buildConfigStatus();
  const [total, activas, latest, lastSnapshot, lastDiff] = await Promise.all([
    prisma.obraSocial.count({ where: { isArchived: false } }),
    prisma.obraSocial.count({ where: { isArchived: false, isActive: true } }),
    prisma.obraSocial.findFirst({
      where: { isArchived: false },
      orderBy: { ultimaSync: 'desc' },
      select: {
        ultimaSync: true,
        nombreOs: true,
      },
    }),
    getLatestCokibaAuditEntry(prisma, auditActions.cokibaSyncSnapshot),
    getLatestCokibaAuditEntry(prisma, auditActions.cokibaSyncDiff),
  ]);

  return {
    source: 'COKIBA',
    total,
    activas,
    lastSyncAt: latest?.ultimaSync || null,
    lastSyncedRecord: latest?.nombreOs || null,
    lastSnapshotAt: lastSnapshot?.createdAt || null,
    lastSnapshotSummary: lastSnapshot?.newValues?.summary || null,
    lastDiffAt: lastDiff?.createdAt || null,
    lastDiffSummary: lastDiff?.newValues?.diffSummary || lastDiff?.details?.diffSummary || null,
    config,
  };
};

let activeCokibaSyncPromise = null;

export const isCokibaSyncRunning = () => Boolean(activeCokibaSyncPromise);

const runCokibaSyncInternal = async ({ prisma, logger: syncLogger = defaultLogger, trigger = 'manual' } = {}) => {
  const config = getCokibaConfig();
  const localPrisma = prisma || new PrismaClient();
  const ownsPrisma = !prisma;
  let browser = null;

  try {
    syncLogger.info('🚀 Iniciando sincronización COKIBA en modo público...', {
      trigger,
    });

    const previousSnapshotEntry = await getLatestCokibaAuditEntry(localPrisma, auditActions.cokibaSyncSnapshot);
    const previousSnapshotRecords = buildPreviousSnapshot(previousSnapshotEntry);

    browser = await puppeteer.launch({
      headless: 'new',
      args: DEFAULT_LAUNCH_ARGS,
      protocolTimeout: 120000,
      defaultViewport: { width: 1280, height: 800 },
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(30000);
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const obrasSociales = await collectObrasSociales(page, config.plazoPago, syncLogger);

    if (obrasSociales.length === 0) {
      throw new Error('No se pudieron extraer obras sociales desde COKIBA.');
    }

    const syncResult = await synchronizeRows(localPrisma, obrasSociales, syncLogger);
    const snapshotRecords = obrasSociales.map((obraSocial) => buildCokibaSnapshotRecord(obraSocial));
    const preAuditStatus = await getCokibaSyncStatus(localPrisma);
    const auditArtifacts = await persistCokibaAuditArtifacts({
      prisma: localPrisma,
      trigger,
      snapshotRecords,
      previousSnapshotRecords,
      status: preAuditStatus,
      logger: syncLogger,
    });
    const status = await getCokibaSyncStatus(localPrisma);

    return {
      ...syncResult,
      extracted: obrasSociales.length,
      status,
      snapshot: {
        dateKey: formatCokibaSyncDateKey(),
        records: snapshotRecords,
        summary: status,
      },
      diff: auditArtifacts.diff,
      diffSummary: auditArtifacts.diffSummary,
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        syncLogger.warn(`⚠️ No se pudo cerrar el navegador de COKIBA: ${error.message}`);
      }
    }

    if (ownsPrisma) {
      await localPrisma.$disconnect();
    }
  }
};

export const runCokibaSync = async ({ prisma, logger = defaultLogger, trigger = 'manual' } = {}) => {
  if (activeCokibaSyncPromise) {
    return activeCokibaSyncPromise;
  }

  activeCokibaSyncPromise = runCokibaSyncInternal({ prisma, logger, trigger })
    .finally(() => {
      activeCokibaSyncPromise = null;
    });

  return activeCokibaSyncPromise;
};

export const scheduleCokibaDailySync = ({ prisma, logger: syncLogger = defaultLogger, enabled = true, scheduleTime = process.env.COKIBA_DAILY_SYNC_TIME || '03:15' } = {}) => {
  if (!enabled) {
    return null;
  }

  let timeoutId = null;

  const scheduleNextRun = () => {
    const nextRunAt = getNextCokibaSyncRunAt(scheduleTime, new Date());
    const delayMs = Math.max(1000, nextRunAt.getTime() - Date.now());

    syncLogger.info('🕒 COKIBA sync diario programado', {
      nextRunAt: nextRunAt.toISOString(),
      delayMs,
      scheduleTime,
    });

    timeoutId = setTimeout(async () => {
      try {
        await runCokibaSync({ prisma, logger: syncLogger, trigger: 'scheduler' });
      } catch (error) {
        syncLogger.error('Error en sincronización automática COKIBA', {
          errorMessage: error.message,
        });
      } finally {
        scheduleNextRun();
      }
    }, delayMs);
  };

  scheduleNextRun();

  return {
    stop: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
  };
};
