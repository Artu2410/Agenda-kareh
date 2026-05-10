import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_CATALOG_PATH = path.resolve(__dirname, '../../data/obras-sociales.txt');

const KNOWN_LABELS = [
  'Arancel Vigente desde',
  'Arancel desde el',
  'Arancel desde',
  'CUIT',
  'Area de Cobertura',
  'Coseguro',
  'Observaciones',
  'Convenio',
];

const SECTION_HEADING_PATTERN =
  /^(requisitos de facturaci[oó]n|documentaci[oó]n|normas|procedimiento|importante|nota|dato|obras sociales y planes|al utilizar la plataforma)/i;
const DOCUMENT_LINE_PATTERN =
  /derivaci[oó]n|validaci[oó]n|credencial|orden|planilla|bono|historia cl[ií]nica|certificado|prescripci[oó]n|autorizaci[oó]n previa|carnet|afiliatoria|documento de identidad|cud/i;
const STATUS_INACTIVE_PATTERN =
  /OBRA SOCIAL .*?(INACTIVA|SUSPENDIDA|BAJA|INACTIVO)|\bINACTIVA DESDE\b|\bSUSPENDIDA\b|\bBAJA\b/i;

const normalizeText = (value) => (
  String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
);

const normalizeLines = (value) => (
  String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => normalizeText(line))
    .filter(Boolean)
);

const uniqueBy = (items, getKey) => {
  const seen = new Set();

  return items.filter((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const extractUrlsFromText = (value) => uniqueBy(
  (String(value || '').match(/https?:\/\/[^\s)]+/gi) || [])
    .map((item) => item.replace(/[.,;]+$/, '')),
  (item) => item.toLowerCase()
);

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const buildLabelRegex = (label) => new RegExp(`^${escapeRegex(label)}\\s*:?\\s*(.*)$`, 'i');
const isKnownLabelLine = (line) => KNOWN_LABELS.some((label) => buildLabelRegex(label).test(line));
const cleanBulletLine = (line) => normalizeText(String(line || '').replace(/^[*-]\s*/, ''));

const normalizeInsuranceName = (value) => (
  normalizeText(
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, ' ')
  ).toUpperCase()
);

const extractLabelValue = (lines, labels, { multiline = false } = {}) => {
  const labelList = Array.isArray(labels) ? labels : [labels];

  for (const label of labelList) {
    const matcher = buildLabelRegex(label);
    const index = lines.findIndex((line) => matcher.test(line));

    if (index === -1) continue;

    const inlineValue = normalizeText(lines[index].replace(matcher, '$1'));
    if (inlineValue && !multiline) {
      return inlineValue;
    }
    const values = inlineValue ? [inlineValue] : [];

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const current = normalizeText(lines[cursor]);
      if (!current) continue;
      if (isKnownLabelLine(current)) break;

      values.push(current);
      if (!multiline) break;
    }

    return normalizeText(values.join(' '));
  }

  return '';
};

const extractPostLabelLines = (lines, label) => {
  const matcher = buildLabelRegex(label);
  const index = lines.findIndex((line) => matcher.test(line));

  if (index === -1) return [];

  return lines
    .slice(index + 1)
    .map((line) => normalizeText(line))
    .filter((line) => line && !isKnownLabelLine(line));
};

const buildRequiredDocuments = (lines = []) => {
  const documents = uniqueBy(
    lines
      .map((line) => cleanBulletLine(line))
      .filter((line) => line && DOCUMENT_LINE_PATTERN.test(line))
      .map((line) => {
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
          !DOCUMENT_LINE_PATTERN.test(line) &&
          !/^aqu[ií]$/i.test(line) &&
          (
            SECTION_HEADING_PATTERN.test(line) ||
            /validaci[oó]n|verificaci[oó]n|prestador|http|www\.|plazo|copago|domicilio|direct connection|facturaci[oó]n|afiliado|autoriz/i.test(
              line
            )
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
    /autorizaci[oó]n previa a trav[eé]s|autorizaci[oó]n previa obligatoria|requiere autorizaci[oó]n|debe autorizar|solicitud de autorizaciones|orden de prestaci[oó]n autorizada/i.test(
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

const buildAliases = (name) => uniqueBy(
  [
    name,
    name.split('/')[0],
    name.replace(/\bCONVENIO LOCAL\b.*$/i, '').trim(),
    name.replace(/\bDELEGACI[OÓ]N\b.*$/i, '').trim(),
  ]
    .map((item) => normalizeInsuranceName(item))
    .filter(Boolean),
  (item) => item
);

const parseSection = (sectionText) => {
  const lines = normalizeLines(sectionText);
  const nombreOs = lines[0] || '';

  if (!nombreOs) return null;

  const conventionLines = extractPostLabelLines(lines, 'Convenio');
  const dataLines = uniqueBy(
    lines.filter((line, index) => index > 0),
    (line) => line.toLowerCase()
  );
  const relevantNarrativeLines = conventionLines.length > 0 ? conventionLines : dataLines;
  const requiredDocuments = buildRequiredDocuments(relevantNarrativeLines);
  const authorizationInfo = extractAuthorizationInfo(relevantNarrativeLines);
  const urls = extractUrlsFromText(sectionText);
  const convenioUrl = urls.find((url) => /\.pdf|convenio/i.test(url)) || '';
  const validacionUrl = urls.find((url) => /valid|directconnection|afiliatoria|prestador/i.test(url)) || '';
  const autorizacionUrl = urls.find((url) => /autoriz/i.test(url)) || '';
  const observationLines = [];
  const observacionesLabel = extractLabelValue(lines, 'Observaciones', { multiline: true });

  if (observacionesLabel) {
    observationLines.push(observacionesLabel);
  }

  conventionLines.forEach((line) => {
    if (
      !DOCUMENT_LINE_PATTERN.test(line) &&
      !/^aqu[ií]$/i.test(line)
    ) {
      observationLines.push(line);
    }
  });

  const statusLine = lines.find((line) => STATUS_INACTIVE_PATTERN.test(line)) || '';

  return {
    nombreOs,
    aliases: buildAliases(nombreOs),
    detectedStatus: statusLine || null,
    detectedIsActive: statusLine ? false : null,
    requiresAuthorization: authorizationInfo.isReliable ? authorizationInfo.value : null,
    requiredDocuments,
    cokibaDetails: {
      arancelVigenteDesde: extractLabelValue(lines, ['Arancel Vigente desde', 'Arancel desde el', 'Arancel desde']),
      cuit: extractLabelValue(lines, 'CUIT'),
      areaCobertura: extractLabelValue(lines, 'Area de Cobertura', { multiline: true }),
      coseguroTexto: extractLabelValue(lines, 'Coseguro', { multiline: true }),
      observaciones: uniqueBy(
        observationLines.map((line) => normalizeText(line)).filter(Boolean),
        (line) => line.toLowerCase()
      ).join('\n'),
      convenioTexto: extractLabelValue(lines, 'Convenio', { multiline: true }),
      convenioUrl,
      convenioLabel: convenioUrl ? 'Convenio' : '',
      validacionUrl,
      autorizacionUrl,
      numeroPrestador:
        lines.find((line) => /numero de prestador de cokiba/i.test(line))
          ?.replace(/.*numero de prestador de cokiba:\s*/i, '')
          ?.trim() || '',
      authorizationNote: authorizationInfo.note,
      norms: uniqueBy(
        conventionLines
          .map((line) => cleanBulletLine(line))
          .filter((line) => line && !/^aqu[ií]$/i.test(line)),
        (line) => line.toLowerCase()
      ),
      links: uniqueBy(
        urls.map((url) => ({ href: url, text: url === convenioUrl ? 'Convenio' : url })),
        (link) => link.href.toLowerCase()
      ),
      extractedUrls: urls,
      tariffHeaders: [],
      tariffRows: [],
      honorarioReferenciaPrestacion: '',
      honorarioBasicaReferencia: 0,
    },
  };
};

let cachedCatalog = null;

export const loadSupplementalCokibaCatalog = async ({ logger = console } = {}) => {
  if (cachedCatalog) return cachedCatalog;

  try {
    const text = await fs.readFile(DEFAULT_CATALOG_PATH, 'utf8');
    const entries = text
      .split(/Aranceles y Normas de Facturación/gi)
      .map((section) => section.trim())
      .filter(Boolean)
      .map((section) => parseSection(section))
      .filter(Boolean);

    logger.info(`📚 Catálogo complementario cargado: ${entries.length} obras sociales desde TXT`);
    cachedCatalog = entries;
    return entries;
  } catch (error) {
    logger.warn(`⚠️ No se pudo cargar el catálogo complementario TXT: ${error.message}`);
    cachedCatalog = [];
    return cachedCatalog;
  }
};

export const matchSupplementalCokibaEntry = ({ entries = [], candidates = [] } = {}) => {
  const normalizedCandidates = uniqueBy(
    candidates.map((candidate) => normalizeInsuranceName(candidate)).filter(Boolean),
    (item) => item
  );

  if (normalizedCandidates.length === 0 || entries.length === 0) {
    return null;
  }

  let bestMatch = null;
  let bestScore = 0;

  for (const entry of entries) {
    const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];

    for (const candidate of normalizedCandidates) {
      for (const alias of aliases) {
        if (candidate === alias) {
          const score = 1000 + alias.length;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = entry;
          }
          continue;
        }

        const shorter = candidate.length <= alias.length ? candidate : alias;
        const longer = shorter === candidate ? alias : candidate;
        const ratio = shorter.length / longer.length;

        if (shorter.length >= 8 && ratio >= 0.72 && longer.includes(shorter)) {
          const score = Math.round(shorter.length * ratio);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = entry;
          }
        }
      }
    }
  }

  return bestScore >= 8 ? bestMatch : null;
};
