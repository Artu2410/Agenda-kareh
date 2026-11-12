import { describe, expect, it } from 'vitest';
import {
  buildAbandonMessagesByEntry,
  buildProfessionalSignature,
  findMissingIntakes,
  pickNewEntryDate,
  resolveEntryProfessional,
  todayDateKey,
} from './clinicalHistoryCycles';

const katia = { id: 'pro-1', fullName: 'Katia Alumine Romero', licenseNumber: '18900', licenseNumberMP: '10318' };
const cycle = (cycleNumber, from, extra = {}) => ({
  cycleNumber, from: `${from}T12:00:00.000Z`, state: 'COMPLETE', abandonedAtSession: null, professional: katia, ...extra,
});
const entry = (clientKey, date) => ({ clientKey, date });

// La API devuelve el ciclo más reciente primero.
const cycles = [
  cycle(3, '2026-11-12', { state: 'IN_PROGRESS' }),
  cycle(2, '2026-09-01', { state: 'INTERRUPTED', abandonedAtSession: 3 }),
  cycle(1, '2026-03-02'),
];

describe('historia clínica y ciclos', () => {
  it('avisa los ingresos y reingresos que no tienen ficha, el más reciente primero', () => {
    const missing = findMissingIntakes(cycles, [entry('e1', '2026-03-02')], '2026-11-12');
    expect(missing.map((item) => [item.label, item.dateKey])).toEqual([
      ['Reingreso', '2026-11-12'],
      ['Reingreso', '2026-09-01'],
    ]);
  });

  it('cuenta como ficha del ciclo una cargada unos días después del turno', () => {
    const missing = findMissingIntakes(cycles, [entry('e1', '2026-03-02'), entry('e2', '2026-09-04')], '2026-10-01');
    expect(missing).toEqual([]);
  });

  it('no avisa un ingreso reservado que todavía no llegó', () => {
    expect(findMissingIntakes([cycle(1, '2026-12-01')], [], '2026-11-12')).toEqual([]);
  });

  it('una ficha nueva toma la fecha del turno de ingreso aunque se cargue otro día', () => {
    expect(pickNewEntryDate(cycles, [entry('e1', '2026-03-02'), entry('e2', '2026-09-01')], '2026-11-20')).toBe('2026-11-12');
  });

  it('si se carga antes, toma la fecha del próximo ingreso reservado', () => {
    expect(pickNewEntryDate([cycle(1, '2026-11-20')], [], '2026-11-12')).toBe('2026-11-20');
  });

  it('con todas las fichas al día, una evolución nueva va con la fecha de hoy', () => {
    expect(pickNewEntryDate([cycle(1, '2026-03-02')], [entry('e1', '2026-03-02')], '2026-11-12')).toBe('2026-11-12');
  });

  it('pone el aviso de abandono en la primera ficha del ciclo cortado', () => {
    const messages = buildAbandonMessagesByEntry(cycles, [
      entry('a', '2026-09-01'), entry('b', '2026-09-05'), entry('c', '2026-11-12'),
    ]);
    expect([...messages.entries()]).toEqual([
      ['a', 'PACIENTE ABANDONA TRATAMIENTO EN LA SESIÓN 3 SIN AVISAR'],
    ]);
  });

  it('firma cada ficha con el profesional del ciclo y sus matrículas', () => {
    const professional = resolveEntryProfessional(entry('a', '2026-09-05'), cycles);
    expect(buildProfessionalSignature(professional)).toEqual({
      name: 'Lic. Katia Alumine Romero',
      licenses: 'M.P. 10318 - M.N. 18900',
    });
  });

  it('usa la fecha local de hoy, no la UTC', () => {
    expect(todayDateKey(new Date(2026, 10, 12, 23, 30))).toBe('2026-11-12');
  });
});
