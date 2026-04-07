const DEFAULT_DOCUMENTATION = 'Orden + Credencial';
const ART_DOCUMENTATION = 'N° Siniestro + Orden';
const CONSULTAR_DOCUMENTATION = 'Consultar con administración';

const INITIAL_COVERAGES = [
  { name: 'ACTIVA SALUD', aliases: ['OSFATLYF', 'OSCONARA'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'AMEBPBA', aliases: ['Banco Provincia'], isActive: true, documentationRequired: 'Orden + Planilla/Bono' },
  { name: 'AMFFA', aliases: ['Farmacéuticos'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'AMSTERDAM SALUD', aliases: ['Amsterdam'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'APRES S.A.', aliases: ['APRES', 'APRES SA'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'APSOT', aliases: [], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'ASI', aliases: ['Asistencia Sanitaria Integral'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'ASOCIACIÓN ECLESIÁSTICA SAN PEDRO', aliases: ['San Pedro'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'AVALIAN', aliases: ['Ex AC Salud', 'AC Salud'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'CASA', aliases: ['Abogados'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'CENTRO MÉDICO PUEYRREDÓN', aliases: ['Pueyrredón', 'C.M. PUEYRREDÓN'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'COLEGIO DE ESCRIBANOS', aliases: ['COL. ESCRIBANOS'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'COMEI', aliases: ['Odontólogos'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'DASMI', aliases: [], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'DASUTEN', aliases: [], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'E.W. HOPE', aliases: ['William Hope'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'FEDERADA SALUD', aliases: ['Federada'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'FUTBOLISTAS', aliases: [], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'GLOBAL EMPRESARIA', aliases: ['GLOBAL MPRESARIA'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'IOMA', aliases: [], isActive: true, documentationRequired: 'Orden sellada y firmada' },
  { name: 'JERÁRQUICOS SALUD', aliases: ['Jerárquicos'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'LUIS PASTEUR', aliases: ['Pasteur'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'MEDICUS', aliases: [], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'MEDIFÉ', aliases: ['Medife'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'OPDEA', aliases: [], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'OSDOP', aliases: ['Docentes particulares'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'OSFATUN', aliases: [], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'OSPE', aliases: ['Petroleros'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'OSPEDYC', aliases: [], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'OSPEPBA', aliases: ['Escribanías'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'OSPIA', aliases: ['Alimentación'], isActive: true, documentationRequired: CONSULTAR_DOCUMENTATION },
  { name: 'OSPSA', aliases: ['Sanidad'], isActive: true, documentationRequired: CONSULTAR_DOCUMENTATION },
  { name: 'OSPTV', aliases: ['Televisión'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'OSSEG', aliases: ['Integral', 'Adherente'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'PODER JUDICIAL', aliases: [], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'PREVENCIÓN SALUD', aliases: ['Prevención'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'SANCOR SALUD', aliases: ['Sancor'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'SCIS S.A.', aliases: ['SCIS', 'SCIS SA'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'SWISS MEDICAL', aliases: ['Swiss'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'UNION PERSONAL', aliases: ['UP'], isActive: true, documentationRequired: DEFAULT_DOCUMENTATION },
  { name: 'LA HOLANDO ART', aliases: ['Holando Art', 'Holando'], isActive: true, documentationRequired: ART_DOCUMENTATION },
  { name: 'LA SEGUNDA ART', aliases: ['La Segunda', 'Segunda Art'], isActive: true, documentationRequired: ART_DOCUMENTATION },
  { name: 'OMINT ART (SERENA)', aliases: ['OMINT ART', 'SERENA'], isActive: true, documentationRequired: ART_DOCUMENTATION },
  { name: 'PARANÁ ART', aliases: ['Paraná'], isActive: true, documentationRequired: ART_DOCUMENTATION },
  { name: 'RECONQUISTA ART', aliases: ['Reconquista'], isActive: true, documentationRequired: ART_DOCUMENTATION },
  { name: 'RURAL MUTUAL ART', aliases: ['Rural Mutual'], isActive: true, documentationRequired: ART_DOCUMENTATION },
  { name: 'SAN FRANCISCO ART', aliases: [], isActive: true, documentationRequired: ART_DOCUMENTATION },
  { name: 'SMG ART (Swiss Medical)', aliases: ['SMG ART', 'SMG'], isActive: true, documentationRequired: ART_DOCUMENTATION },
];

const EXACT_MATCH_ONLY_ALIASES = new Set(['asi', 'casa', 'up']);

const normalizeCoverageText = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\w\s]/g, ' ')
  .replace(/_/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const toUniqueAliases = (value) => {
  const sourceValues = Array.isArray(value)
    ? value
    : String(value || '').split(/[\n,]/g);

  return Array.from(new Set(
    sourceValues
      .map((item) => String(item || '').trim())
      .filter(Boolean),
  ));
};

const normalizeDocumentationRequired = (value) => {
  const normalized = String(value || '').trim();
  return normalized || DEFAULT_DOCUMENTATION;
};

const slugifyCoverageId = (value) => normalizeCoverageText(value).replace(/\s+/g, '-');

let coverageCounter = INITIAL_COVERAGES.length + 1;
let inMemoryCoverages = INITIAL_COVERAGES.map((coverage, index) => ({
  id: slugifyCoverageId(coverage.name) || `coverage-${index + 1}`,
  name: coverage.name,
  aliases: toUniqueAliases(coverage.aliases),
  isActive: coverage.isActive !== false,
  documentationRequired: normalizeDocumentationRequired(coverage.documentationRequired),
  sortOrder: index + 1,
}));

const sortCoverageCatalog = () => {
  inMemoryCoverages = [...inMemoryCoverages]
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'es'));
};

const rebuildCoverageOrder = () => {
  sortCoverageCatalog();
  inMemoryCoverages = inMemoryCoverages.map((coverage, index) => ({
    ...coverage,
    sortOrder: index + 1,
  }));
};

const buildCoverageSnapshot = (coverage) => ({
  id: coverage.id,
  name: coverage.name,
  aliases: [...coverage.aliases],
  isActive: coverage.isActive,
  documentationRequired: coverage.documentationRequired,
  sortOrder: coverage.sortOrder,
});

const buildCoverageSearchTerms = (coverage) => [
  coverage.name,
  ...(coverage.aliases || []),
].map(normalizeCoverageText).filter(Boolean);

const matchesCoverageTerm = (normalizedText, normalizedTerm) => {
  if (!normalizedText || !normalizedTerm) return false;
  if (normalizedText === normalizedTerm) return true;

  if (EXACT_MATCH_ONLY_ALIASES.has(normalizedTerm)) {
    return false;
  }

  return ` ${normalizedText} `.includes(` ${normalizedTerm} `);
};

const findCoverageIndexById = (id) => inMemoryCoverages.findIndex((coverage) => coverage.id === id);

const findCoverageNameConflict = (name, ignoreId) => {
  const normalizedName = normalizeCoverageText(name);
  return inMemoryCoverages.find((coverage) => (
    coverage.id !== ignoreId && normalizeCoverageText(coverage.name) === normalizedName
  ));
};

export const listInMemoryWhatsAppCoverages = ({ includeInactive = false } = {}) => {
  rebuildCoverageOrder();
  return inMemoryCoverages
    .filter((coverage) => includeInactive || coverage.isActive)
    .map(buildCoverageSnapshot);
};

export const findInMemoryWhatsAppCoverageByInput = (value, { includeInactive = false } = {}) => {
  const normalizedText = normalizeCoverageText(value);
  if (!normalizedText) return null;

  const matchedCoverage = listInMemoryWhatsAppCoverages({ includeInactive }).find((coverage) => (
    buildCoverageSearchTerms(coverage).some((term) => matchesCoverageTerm(normalizedText, term))
  ));

  return matchedCoverage || null;
};

export const findInMemoryWhatsAppCoverageById = (id) => {
  rebuildCoverageOrder();
  const matchedCoverage = inMemoryCoverages.find((coverage) => coverage.id === id);
  return matchedCoverage ? buildCoverageSnapshot(matchedCoverage) : null;
};

export const createInMemoryWhatsAppCoverage = ({ name, aliases, isActive = true, documentationRequired }) => {
  const normalizedName = String(name || '').trim();
  if (!normalizedName) {
    throw new Error('El nombre es obligatorio.');
  }

  if (findCoverageNameConflict(normalizedName)) {
    throw new Error('Ya existe una cobertura con ese nombre.');
  }

  const newCoverage = {
    id: `${slugifyCoverageId(normalizedName) || 'coverage'}-${coverageCounter}`,
    name: normalizedName,
    aliases: toUniqueAliases(aliases),
    isActive: !!isActive,
    documentationRequired: normalizeDocumentationRequired(documentationRequired),
    sortOrder: inMemoryCoverages.length + 1,
  };

  coverageCounter += 1;
  inMemoryCoverages.push(newCoverage);
  rebuildCoverageOrder();
  return buildCoverageSnapshot(newCoverage);
};

export const updateInMemoryWhatsAppCoverage = (id, payload = {}) => {
  const coverageIndex = findCoverageIndexById(id);
  if (coverageIndex === -1) {
    throw new Error('Cobertura no encontrada.');
  }

  const currentCoverage = inMemoryCoverages[coverageIndex];
  const nextName = payload.name === undefined ? currentCoverage.name : String(payload.name || '').trim();
  if (!nextName) {
    throw new Error('El nombre es obligatorio.');
  }

  if (findCoverageNameConflict(nextName, id)) {
    throw new Error('Ya existe otra cobertura con ese nombre.');
  }

  const updatedCoverage = {
    ...currentCoverage,
    name: nextName,
    aliases: payload.aliases === undefined ? currentCoverage.aliases : toUniqueAliases(payload.aliases),
    isActive: payload.isActive === undefined ? currentCoverage.isActive : !!payload.isActive,
    documentationRequired: payload.documentationRequired === undefined
      ? currentCoverage.documentationRequired
      : normalizeDocumentationRequired(payload.documentationRequired),
  };

  inMemoryCoverages[coverageIndex] = updatedCoverage;
  rebuildCoverageOrder();
  return buildCoverageSnapshot(updatedCoverage);
};
