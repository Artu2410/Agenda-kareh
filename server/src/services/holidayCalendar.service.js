import Holidays from 'date-holidays';

const ARGENTINA_JURISDICTION = 'AR';
const holidayCalendar = new Holidays(ARGENTINA_JURISDICTION);
holidayCalendar.setLanguages('es');
const OFFICIAL_CALENDAR_URL = (year) => `https://www.argentina.gob.ar/sites/default/files/holidays-${year}-es.json`;
const calendarCache = new Map();
const OFFICIAL_CACHE_MS = 12 * 60 * 60 * 1000;
const FALLBACK_CACHE_MS = 5 * 60 * 1000;

const decodeOfficialName = (value = '') => String(value)
  .replace(/<[^>]*>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&nbsp;/g, ' ')
  .trim();

const extractRegionalJurisdiction = (htmlName) => {
  const link = String(htmlName).match(/<a[^>]*>(.*?)<\/a>/i);
  if (!link) return null;
  return decodeOfficialName(link[1]).replace(/^feriado en\s*/i, '').trim() || null;
};

const toCalendarDate = (value) => {
  if (value instanceof Date) return new Date(value);
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(value);
};

const mapOfficialHoliday = (row, sourceUpdatedAt, nationalHolidaysClose) => {
  const item = row?.item || {};
  const rawType = String(item?.additionalProperty?.value || '').toLowerCase();
  const rawName = String(item.name || '');
  const linkJurisdiction = extractRegionalJurisdiction(rawName);
  const type = rawType === 'inamovible' || rawType === 'trasladable'
    ? 'NATIONAL_HOLIDAY'
    : rawType === 'turistico'
      ? 'TOURISM_DAY'
      : rawType === 'no_laborable'
        ? 'NON_WORKING_DAY'
        : rawType === 'especial'
          ? 'REGIONAL_HOLIDAY'
          : 'OBSERVANCE';
  const affectsOperationByDefault = type === 'NATIONAL_HOLIDAY';

  return {
    date: String(item.startDate || '').slice(0, 10),
    name: decodeOfficialName(rawName),
    type,
    rawType,
    jurisdiction: linkJurisdiction || ARGENTINA_JURISDICTION,
    source: 'Argentina.gob.ar',
    sourceUrl: OFFICIAL_CALENDAR_URL(new Date(item.startDate).getFullYear()),
    sourceUpdatedAt,
    affectsOperationByDefault,
    affectsOperation: affectsOperationByDefault && nationalHolidaysClose === true,
    substitute: false,
  };
};

const mapLibraryHoliday = (holiday, year, nationalHolidaysClose) => {
  const rawType = String(holiday.type || 'observance').toLowerCase();
  const normalizedName = String(holiday.name || '').toLowerCase();
  const type = rawType === 'public'
    ? 'NATIONAL_HOLIDAY'
    : rawType === 'optional' && normalizedName.includes('turíst')
      ? 'TOURISM_DAY'
      : rawType === 'optional'
        ? 'NON_WORKING_DAY'
        : rawType === 'bank'
          ? 'BANK_HOLIDAY'
          : rawType === 'school'
            ? 'SCHOOL_HOLIDAY'
            : 'OBSERVANCE';
  const affectsOperationByDefault = type === 'NATIONAL_HOLIDAY';

  return {
    date: String(holiday.date).slice(0, 10),
    name: holiday.name,
    type,
    rawType,
    jurisdiction: ARGENTINA_JURISDICTION,
    source: 'date-holidays-fallback',
    sourceUrl: null,
    sourceUpdatedAt: null,
    sourceFallback: true,
    affectsOperationByDefault,
    affectsOperation: affectsOperationByDefault && nationalHolidaysClose === true,
    substitute: Boolean(holiday.substitute),
  };
};

const fetchOfficialHolidayCalendar = async (year) => {
  const response = await fetch(OFFICIAL_CALENDAR_URL(year), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Argentina.gob.ar respondió HTTP ${response.status}.`);
  const data = await response.json();
  const rows = data?.mainEntity?.itemListElement;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`El calendario oficial argentino ${year} no contiene feriados.`);
  }
  return {
    sourceUpdatedAt: data.dateModified || null,
    rows,
  };
};

export const clearHolidayCalendarCache = () => calendarCache.clear();

export const getHolidays = async (year, { nationalHolidaysClose = true } = {}) => {
  const normalizedYear = Number(year);
  if (!Number.isInteger(normalizedYear) || normalizedYear < 1900 || normalizedYear > 2200) {
    throw new RangeError('year debe ser un entero entre 1900 y 2200.');
  }

  const cached = calendarCache.get(normalizedYear);
  let calendarData;
  if (cached && cached.expiresAt > Date.now()) {
    calendarData = cached;
  } else {
    try {
      const official = await fetchOfficialHolidayCalendar(normalizedYear);
      calendarData = {
        source: 'Argentina.gob.ar',
        sourceUpdatedAt: official.sourceUpdatedAt,
        rows: official.rows,
        expiresAt: Date.now() + OFFICIAL_CACHE_MS,
      };
    } catch (officialError) {
      const fallbackRows = holidayCalendar.getHolidays(normalizedYear);
      if (!fallbackRows.length) throw officialError;
      calendarData = {
        source: 'date-holidays-fallback',
        sourceUpdatedAt: null,
        rows: fallbackRows,
        expiresAt: Date.now() + FALLBACK_CACHE_MS,
      };
    }
    calendarCache.set(normalizedYear, calendarData);
  }

  if (calendarData.source === 'Argentina.gob.ar') {
    return calendarData.rows.map((row) => mapOfficialHoliday(
      row,
      calendarData.sourceUpdatedAt,
      nationalHolidaysClose,
    ));
  }

  return calendarData.rows.map((holiday) => mapLibraryHoliday(
    holiday,
    normalizedYear,
    nationalHolidaysClose,
  ));
};

export const getHolidaysForDateRange = async (startDate, endDate, policy = {}) => {
  const start = toCalendarDate(startDate);
  const end = toCalendarDate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const holidayYears = [];
  for (let year = start.getFullYear(); year <= end.getFullYear(); year += 1) {
    holidayYears.push(await getHolidays(year, policy));
  }
  const holidays = holidayYears.flat();

  const startKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  const endKey = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  return holidays.filter((holiday) => holiday.date >= startKey && holiday.date <= endKey);
};
