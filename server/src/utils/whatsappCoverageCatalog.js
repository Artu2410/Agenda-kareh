const INITIAL_COVERAGES = [
  { name: 'ACTIVA SALUD', aliases: ['OSFATLYF', 'OSCONARA'], isActive: true },
  { name: 'AMEBPBA', aliases: ['Banco Provincia'], isActive: true },
  { name: 'AMFFA', aliases: ['Farmacéuticos'], isActive: true },
  { name: 'AMSTERDAM SALUD', aliases: ['Amsterdam'], isActive: true },
  { name: 'APRES S.A.', aliases: ['APRES', 'APRES SA'], isActive: true },
  { name: 'APSOT', aliases: [], isActive: true },
  { name: 'ASI', aliases: ['Asistencia Sanitaria Integral'], isActive: true },
  { name: 'ASOCIACIÓN ECLESIÁSTICA SAN PEDRO', aliases: ['San Pedro'], isActive: true },
  { name: 'AVALIAN', aliases: ['Ex AC Salud', 'AC Salud'], isActive: true },
  { name: 'CASA', aliases: [], isActive: true },
  { name: 'CENTRO MÉDICO PUEYRREDÓN', aliases: ['Pueyrredón'], isActive: true },
  { name: 'COLEGIO DE ESCRIBANOS', aliases: [], isActive: true },
  { name: 'COMEI', aliases: ['Odontólogos'], isActive: true },
  { name: 'DASMI', aliases: [], isActive: true },
  { name: 'DASUTEN', aliases: [], isActive: true },
  { name: 'E.W. HOPE', aliases: ['William Hope'], isActive: true },
  { name: 'FEDERADA SALUD', aliases: ['Federada'], isActive: true },
  { name: 'FUTBOLISTAS', aliases: [], isActive: true },
  { name: 'GLOBAL EMPRESARIA', aliases: [], isActive: true },
  { name: 'IOMA', aliases: [], isActive: true },
  { name: 'JERÁRQUICOS SALUD', aliases: ['Jerárquicos'], isActive: true },
  { name: 'LUIS PASTEUR', aliases: ['Pasteur'], isActive: true },
  { name: 'MEDICUS', aliases: [], isActive: true },
  { name: 'MEDIFÉ', aliases: ['Medife'], isActive: true },
  { name: 'OPDEA', aliases: [], isActive: true },
  { name: 'OSDOP', aliases: ['Docentes particulares'], isActive: true },
  { name: 'OSFATUN', aliases: [], isActive: true },
  { name: 'OSPE', aliases: ['Petroleros'], isActive: true },
  { name: 'OSPEDYC', aliases: [], isActive: true },
  { name: 'OSPEPBA', aliases: ['Escribanías'], isActive: true },
  { name: 'OSPIA', aliases: ['Alimentación'], isActive: true },
  { name: 'OSPSA', aliases: ['Sanidad'], isActive: true },
  { name: 'OSPTV', aliases: ['Televisión'], isActive: true },
  { name: 'OSSEG', aliases: ['Integral', 'Adherente'], isActive: true },
  { name: 'PODER JUDICIAL', aliases: [], isActive: true },
  { name: 'PREVENCIÓN SALUD', aliases: ['Prevención'], isActive: true },
  { name: 'SANCOR SALUD', aliases: ['Sancor'], isActive: true },
  { name: 'SCIS S.A.', aliases: ['SCIS', 'SCIS SA'], isActive: true },
  { name: 'SWISS MEDICAL', aliases: ['Swiss'], isActive: true },
  { name: 'UNION PERSONAL', aliases: ['UP'], isActive: true },
  { name: 'LA HOLANDO ART', aliases: ['Holando Art', 'Holando'], isActive: true },
  { name: 'LA SEGUNDA ART', aliases: ['La Segunda', 'Segunda Art'], isActive: true },
  { name: 'OMINT ART (SERENA)', aliases: ['OMINT ART', 'SERENA'], isActive: true },
  { name: 'PARANÁ ART', aliases: ['Paraná'], isActive: true },
  { name: 'RECONQUISTA ART', aliases: ['Reconquista'], isActive: true },
  { name: 'RURAL MUTUAL ART', aliases: ['Rural Mutual'], isActive: true },
  { name: 'SAN FRANCISCO ART', aliases: [], isActive: true },
  { name: 'SMG ART (Swiss Medical)', aliases: ['SMG ART', 'SMG'], isActive: true },
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

const slugifyCoverageId = (value) => normalizeCoverageText(value).replace(/\s+/g, '-');

let coverageCounter = INITIAL_COVERAGES.length + 1;
let inMemoryCoverages = INITIAL_COVERAGES.map((coverage, index) => ({
  id: slugifyCoverageId(coverage.name) || `coverage-${index + 1}`,
  name: coverage.name,
  aliases: toUniqueAliases(coverage.aliases),
  isActive: coverage.isActive !== false,
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

export const createInMemoryWhatsAppCoverage = ({ name, aliases, isActive = true }) => {
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
  };

  inMemoryCoverages[coverageIndex] = updatedCoverage;
  rebuildCoverageOrder();
  return buildCoverageSnapshot(updatedCoverage);
};
