import { describe, expect, it } from 'vitest';
import { formatPatientAge } from './patientAge';

const TODAY = new Date(2026, 10, 22);

describe('formatPatientAge', () => {
  it('muestra meses para bebés (no "0 años")', () => {
    expect(formatPatientAge('2026-01-22', TODAY)).toBe('10 meses');
    expect(formatPatientAge('2026-10-21T00:00:00.000Z', TODAY)).toBe('1 mes');
  });

  it('muestra días en el primer mes de vida', () => {
    expect(formatPatientAge('2026-11-10', TODAY)).toBe('12 días');
  });

  it('muestra año y meses entre 1 y 2 años', () => {
    expect(formatPatientAge('2025-08-22', TODAY)).toBe('1 año y 3 meses');
    expect(formatPatientAge('2025-11-22', TODAY)).toBe('1 año');
  });

  it('muestra años desde los 2 años', () => {
    expect(formatPatientAge('1990-11-23', TODAY)).toBe('35 años');
    expect(formatPatientAge('1990-11-22', TODAY)).toBe('36 años');
  });

  it('devuelve null sin fecha válida o futura', () => {
    expect(formatPatientAge('', TODAY)).toBeNull();
    expect(formatPatientAge('2027-01-01', TODAY)).toBeNull();
  });
});
