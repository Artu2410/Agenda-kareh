import { format } from 'date-fns';

export const COKIBA_AUTHORIZATION_TYPES = Object.freeze({
  TOKEN_ONLINE: 'TOKEN_ONLINE',
  COKIBA_SISTEMA: 'COKIBA_SISTEMA',
  PRESENCIAL: 'PRESENCIAL',
});

export const COKIBA_SYNC_ACTIONS = Object.freeze({
  SNAPSHOT: 'COKIBA_SYNC_SNAPSHOT',
  DIFF: 'COKIBA_SYNC_DIFF',
  ALERT: 'COKIBA_SYNC_ALERT',
});

const TRACKED_FIELDS = [
  'estado',
  'isActive',
  'detectedStatus',
  'detectedIsActive',
  'requiresAuthorization',
  'authorizationType',
  'authorizationNote',
  'coseguroValor',
  'honorarioEstimado',
  'percentageCoinsurance',
  'fixedCopay',
  'plazoPago',
  'atendibleSanMiguel',
  'rawCategoria',
];

const FINANCIAL_CHANGE_FIELDS = [
  'coseguroValor',
  'honorarioEstimado',
  'percentageCoinsurance',
  'fixedCopay',
];

const normalizeComparableText = (value) => String(value ?? '').trim();

const normalizeComparableNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number.parseFloat(parsed.toFixed(2)) : null;
};

const normalizeComparableBoolean = (value) => {
  if (value === null || value === undefined || value === '') return null;
  return Boolean(value);
};

const normalizeComparableValue = (field, value) => {
  if (['isActive', 'detectedIsActive', 'requiresAuthorization', 'atendibleSanMiguel'].includes(field)) {
    return normalizeComparableBoolean(value);
  }

  if (FINANCIAL_CHANGE_FIELDS.includes(field)) {
    return normalizeComparableNumber(value);
  }

  if (field === 'plazoPago') {
    return value === null || value === undefined || value === '' ? null : Number.parseInt(value, 10) || 0;
  }

  return normalizeComparableText(value);
};

const normalizeComparableRecord = (record = {}) => {
  const normalized = {};

  TRACKED_FIELDS.forEach((field) => {
    normalized[field] = normalizeComparableValue(field, record[field]);
  });

  normalized.codigoCokiba = normalizeComparableText(record.codigoCokiba);
  normalized.nombreOs = normalizeComparableText(record.nombreOs);
  normalized.ultimaSync = record.ultimaSync ? new Date(record.ultimaSync).toISOString() : null;

  return normalized;
};

export const deriveCokibaAuthorizationType = ({
  authorizationNote = '',
  authorizationUrl = '',
  validationUrl = '',
  convenienceText = '',
  additionalText = '',
  lines = [],
} = {}) => {
  const joined = [
    authorizationNote,
    authorizationUrl,
    validationUrl,
    convenienceText,
    additionalText,
    ...(Array.isArray(lines) ? lines : []),
  ]
    .map((value) => normalizeComparableText(value))
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!joined) return null;

  if (
    /\b(token|credencial digital|clave|n[úu]mero de validaci[óo]n|obligatorio la utilizaci[óo]n de token|token de validaci[óo]n)\b/i
      .test(joined)
  ) {
    return COKIBA_AUTHORIZATION_TYPES.TOKEN_ONLINE;
  }

  if (
    /\b(presencial|filial|delegaci[óo]n|sucursal|acercarse|presentarse|obra social presencialmente|por mail a cada sucursal)\b/i
      .test(joined)
  ) {
    return COKIBA_AUTHORIZATION_TYPES.PRESENCIAL;
  }

  if (
    /\b(plataforma web|autogesti[óo]n|cokiba|colegio|backoffice|sistema web|online|validaci[óo]n prestacional|validaci[óo]n de las prestaciones)\b/i
      .test(joined)
  ) {
    return COKIBA_AUTHORIZATION_TYPES.COKIBA_SISTEMA;
  }

  return null;
};

export const buildCokibaSnapshotRecord = (record = {}) => {
  const normalized = normalizeComparableRecord(record);

  return {
    codigoCokiba: normalized.codigoCokiba,
    nombreOs: normalized.nombreOs,
    estado: normalized.estado,
    isActive: normalized.isActive ?? false,
    detectedStatus: normalized.detectedStatus || null,
    detectedIsActive: normalized.detectedIsActive,
    requiresAuthorization: normalized.requiresAuthorization,
    authorizationType: normalized.authorizationType || null,
    authorizationNote: normalized.authorizationNote || null,
    coseguroValor: normalized.coseguroValor ?? 0,
    honorarioEstimado: normalized.honorarioEstimado ?? 0,
    percentageCoinsurance: normalized.percentageCoinsurance ?? 0,
    fixedCopay: normalized.fixedCopay ?? 0,
    plazoPago: normalized.plazoPago ?? 0,
    atendibleSanMiguel: normalized.atendibleSanMiguel ?? false,
    rawCategoria: normalized.rawCategoria || '',
    ultimaSync: normalized.ultimaSync,
  };
};

export const computeCokibaDiff = (previousRecords = [], currentRecords = []) => {
  const previousByCode = new Map(
    previousRecords
      .map((record) => buildCokibaSnapshotRecord(record))
      .filter((record) => record.codigoCokiba)
      .map((record) => [record.codigoCokiba, record])
  );
  const currentByCode = new Map(
    currentRecords
      .map((record) => buildCokibaSnapshotRecord(record))
      .filter((record) => record.codigoCokiba)
      .map((record) => [record.codigoCokiba, record])
  );

  const added = [];
  const removed = [];
  const changed = [];

  currentByCode.forEach((currentRecord, codigoCokiba) => {
    const previousRecord = previousByCode.get(codigoCokiba);
    if (!previousRecord) {
      added.push(currentRecord);
      return;
    }

    const changes = TRACKED_FIELDS.reduce((accumulator, field) => {
      if (normalizeComparableValue(field, previousRecord[field]) === normalizeComparableValue(field, currentRecord[field])) {
        return accumulator;
      }

      accumulator.push({
        field,
        before: previousRecord[field],
        after: currentRecord[field],
      });
      return accumulator;
    }, []);

    if (changes.length > 0) {
      changed.push({
        codigoCokiba,
        nombreOs: currentRecord.nombreOs,
        changes,
        previous: previousRecord,
        current: currentRecord,
      });
    }
  });

  previousByCode.forEach((previousRecord, codigoCokiba) => {
    if (!currentByCode.has(codigoCokiba)) {
      removed.push(previousRecord);
    }
  });

  return {
    previousRecords: [...previousByCode.values()],
    currentRecords: [...currentByCode.values()],
    added,
    removed,
    changed,
  };
};

export const summarizeCokibaDiff = (diff = {}) => {
  const addedCount = Array.isArray(diff.added) ? diff.added.length : 0;
  const removedCount = Array.isArray(diff.removed) ? diff.removed.length : 0;
  const changedCount = Array.isArray(diff.changed) ? diff.changed.length : 0;

  const fieldChanges = (Array.isArray(diff.changed) ? diff.changed : []).flatMap((entry) => (
    Array.isArray(entry.changes) ? entry.changes : []
  ));

  const fieldCounts = fieldChanges.reduce((accumulator, change) => {
    accumulator[change.field] = (accumulator[change.field] || 0) + 1;
    return accumulator;
  }, {});

  const activeToInactive = (Array.isArray(diff.changed) ? diff.changed : []).filter((entry) => (
    Boolean(entry.previous?.isActive) && entry.current?.isActive === false
  )).length;
  const inactiveToActive = (Array.isArray(diff.changed) ? diff.changed : []).filter((entry) => (
    entry.previous?.isActive === false && Boolean(entry.current?.isActive)
  )).length;

  const authorizationChanges = (
    (fieldCounts.requiresAuthorization || 0)
    + (fieldCounts.authorizationType || 0)
    + (fieldCounts.authorizationNote || 0)
  );

  return {
    addedCount,
    removedCount,
    changedCount,
    totalChanges: addedCount + removedCount + changedCount,
    activeToInactive,
    inactiveToActive,
    honorarioChanges: FINANCIAL_CHANGE_FIELDS.reduce(
      (total, field) => total + (fieldCounts[field] || 0),
      0,
    ),
    authorizationChanges,
    fieldCounts,
    hasChanges: addedCount > 0 || removedCount > 0 || changedCount > 0,
  };
};

export const buildCokibaSyncMessage = (summary = {}) => {
  const parts = [];

  if (summary.addedCount) parts.push(`${summary.addedCount} altas`);
  if (summary.removedCount) parts.push(`${summary.removedCount} bajas`);
  if (summary.activeToInactive) parts.push(`${summary.activeToInactive} activas→suspendidas`);
  if (summary.inactiveToActive) parts.push(`${summary.inactiveToActive} suspendidas→activas`);
  if (summary.honorarioChanges) parts.push(`${summary.honorarioChanges} cambios de honorarios/coseguro`);
  if (summary.authorizationChanges) parts.push(`${summary.authorizationChanges} cambios de autorización`);

  if (parts.length === 0) {
    return 'COKIBA sin cambios relevantes.';
  }

  return `COKIBA actualizado: ${parts.join(' · ')}`;
};

export const buildCokibaNotificationPayload = ({
  summary = {},
  diffSummary = {},
  snapshotAt = new Date().toISOString(),
} = {}) => ({
  kind: 'cokiba-sync',
  title: 'COKIBA actualizado',
  body: buildCokibaSyncMessage(diffSummary),
  data: {
    summary,
    diffSummary,
    snapshotAt,
    openPath: '/obras-sociales',
  },
});

export const parseCokibaSyncTime = (value = '03:15') => {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return { hours: 3, minutes: 15 };
  }

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return { hours: 3, minutes: 15 };
  }

  return {
    hours: Math.max(0, Math.min(23, hours)),
    minutes: Math.max(0, Math.min(59, minutes)),
  };
};

export const getNextCokibaSyncRunAt = (timeValue = '03:15', baseDate = new Date()) => {
  const { hours, minutes } = parseCokibaSyncTime(timeValue);
  const nextRun = new Date(baseDate);
  nextRun.setHours(hours, minutes, 0, 0);

  if (nextRun <= baseDate) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  return nextRun;
};

export const formatCokibaSyncDateKey = (dateValue = new Date()) => format(new Date(dateValue), 'yyyy-MM-dd');
