import {
  clearHolidayCalendarCache,
  getHolidays,
  getHolidaysForDateRange,
} from '../src/services/holidayCalendar.service.js';
import { mockOfficialHolidayFeed } from './helpers/officialHolidayFixture.js';

describe('Argentine holiday calendar', () => {
  beforeEach(() => clearHolidayCalendarCache());
  afterEach(() => {
    clearHolidayCalendarCache();
    jest.restoreAllMocks();
  });

  it('uses the official transferred October 12 date rather than date-holidays package dates', async () => {
    mockOfficialHolidayFeed();

    const holidays = await getHolidays(2026);
    const octoberHoliday = holidays.find((entry) => entry.name === 'Día de la Raza');

    expect(octoberHoliday).toEqual(expect.objectContaining({
      date: '2026-10-12',
      type: 'NATIONAL_HOLIDAY',
      rawType: 'trasladable',
      jurisdiction: 'AR',
      source: 'Argentina.gob.ar',
      sourceUrl: 'https://www.argentina.gob.ar/sites/default/files/holidays-2026-es.json',
      sourceUpdatedAt: '2026-10-02T12:42:31Z',
      affectsOperationByDefault: true,
      affectsOperation: true,
    }));
    expect(holidays.some((entry) => entry.date === '2026-10-11')).toBe(false);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://www.argentina.gob.ar/sites/default/files/holidays-2026-es.json',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('includes post-package official amendments such as the November 9 DNU holiday', async () => {
    mockOfficialHolidayFeed();

    const holidays = await getHolidays(2026);
    const dnuHoliday = holidays.find((entry) => entry.date === '2026-11-09');
    const regionalHoliday = holidays.find((entry) => entry.date === '2026-11-10');

    expect(dnuHoliday).toEqual(expect.objectContaining({
      type: 'NATIONAL_HOLIDAY',
      rawType: 'inamovible',
      jurisdiction: 'AR',
      affectsOperation: true,
    }));
    expect(regionalHoliday).toEqual(expect.objectContaining({
      type: 'REGIONAL_HOLIDAY',
      jurisdiction: 'Córdoba y Ciudad Autónoma de Buenos Aires',
      affectsOperation: false,
    }));
  });

  it('keeps tourism days distinct and does not close them under the national-holiday policy', async () => {
    mockOfficialHolidayFeed();

    const holiday = (await getHolidays(2026)).find((entry) => entry.date === '2026-03-23');
    expect(holiday).toEqual(expect.objectContaining({
      type: 'TOURISM_DAY',
      rawType: 'turistico',
      affectsOperationByDefault: false,
      affectsOperation: false,
    }));
  });

  it('honors the Kareh policy toggle while preserving the national holiday classification', async () => {
    mockOfficialHolidayFeed();

    const holiday = (await getHolidays(2026, { nationalHolidaysClose: false }))
      .find((entry) => entry.date === '2026-10-12');
    expect(holiday.type).toBe('NATIONAL_HOLIDAY');
    expect(holiday.affectsOperationByDefault).toBe(true);
    expect(holiday.affectsOperation).toBe(false);
  });

  it('returns only dates inside a date-only inclusive range without UTC day shifts', async () => {
    mockOfficialHolidayFeed();

    const holidays = await getHolidaysForDateRange('2026-10-11', '2026-10-12');
    expect(holidays.map((entry) => entry.date)).toEqual(['2026-10-12']);
  });

  it('falls back to date-holidays only when the official feed is unavailable and labels the fallback', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 503 }));

    const holidays = await getHolidays(2026);
    expect(holidays.length).toBeGreaterThan(0);
    expect(holidays.every((entry) => entry.sourceFallback === true)).toBe(true);
    expect(holidays.some((entry) => entry.date === '2026-11-09')).toBe(false);
  });
});
