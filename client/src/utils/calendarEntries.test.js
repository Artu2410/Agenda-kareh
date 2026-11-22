import { describe, expect, it } from 'vitest';
import { dedupeCalendarEntries } from './calendarEntries';

describe('dedupeCalendarEntries', () => {
  it('muestra una sola vez la misma fecha con distinta capitalización', () => {
    const entries = [
      { date: '2027-01-01', type: 'NATIONAL_HOLIDAY', name: 'Año nuevo' },
      { date: '2027-01-01', type: 'NATIONAL_HOLIDAY', name: 'Año Nuevo' },
      { date: '2027-01-01', type: 'CLINIC_CLOSURE', name: 'Año Nuevo' },
    ];
    expect(dedupeCalendarEntries(entries)).toHaveLength(2);
  });
});
