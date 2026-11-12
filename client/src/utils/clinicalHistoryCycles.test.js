import { describe, expect, it } from 'vitest';
import {
  buildAbandonMessagesByEntry,
  buildProfessionalSignature,
  describeEntryAppointment,
  findAutoFixableEntries,
  findDiagnosisForDate,
  findEntryDateMismatch,
  findMissingIntakes,
  pickNewEntryDate,
  resolveEntryProfessional,
  todayDateKey,
} from './clinicalHistoryCycles';

const katia = { id: 'pro-1', fullName: 'Katia Alumine Romero', licenseNumber: '18900', licenseNumberMP: '10318' };
const cycle = (cycleNumber, from, extra = {}) => ({
  cycleNumber,
  from: `${from}T12:00:00.000Z`,
  state: 'COMPLETE',
  abandonedAtSession: null,
  professional: katia,
  diagnosis: null,
  sessions: [{ id: `s-${from}`, date: `${from}T12:00:00.000Z`, sessionNumber: 1 }],
  ...extra,
});
const entry = (clientKey, date) => ({ clientKey, date });

// La API devuelve el ciclo más reciente primero.
const cycles = [
  cycle(3, '2026-11-12', { state: 'IN_PROGRESS' }),
  cycle(2, '2026-09-01', { state: 'INTERRUPTED', abandonedAtSession: 3 }),
  cycle(1, '2026-03-02'),
];

describe('historia clínica y turnos', () => {
  it('avisa los ingresos y reingresos sin una ficha con su misma fecha', () => {
    const missing = findMissingIntakes(cycles, [entry('e1', '2026-03-02'), entry('e2', '2026-09-04')], '2026-11-12');
    expect(missing.map((item) => [item.label, item.dateKey])).toEqual([
      ['Reingreso', '2026-11-12'],
      ['Reingreso', '2026-09-01'],
    ]);
  });

  it('avisa también un ingreso de mañana aunque haya una ficha cargada antes con otra fecha', () => {
    // Paciente que inicia mañana y tiene una ficha vieja con la fecha del día en que se cargó.
    const tomorrow = [cycle(1, '2026-11-13', { diagnosis: 'SME MANGUITO ROTADOR DER' })];
    const missing = findMissingIntakes(tomorrow, [entry('vieja', '2026-11-10')], '2026-11-12');
    expect(missing).toEqual([expect.objectContaining({
      label: 'Ingreso', dateKey: '2026-11-13', isUpcoming: true, diagnosis: 'SME MANGUITO ROTADOR DER',
    })]);
  });

  it('marca la ficha con una fecha que no es de ningún turno y propone la del ingreso', () => {
    const tomorrow = [cycle(1, '2026-11-13', { diagnosis: 'SME MANGUITO ROTADOR DER' })];
    expect(findEntryDateMismatch(tomorrow, entry('vieja', '2026-11-10'))).toEqual({
      dateKey: '2026-11-13', label: 'Ingreso', diagnosis: 'SME MANGUITO ROTADOR DER',
    });
    expect(findEntryDateMismatch(tomorrow, entry('ok', '2026-11-13'))).toBeNull();
  });

  it('pasa sola a la fecha del turno una ficha de ingreso cargada antes', () => {
    const tomorrow = [cycle(1, '2026-11-13', { diagnosis: 'SME MANGUITO ROTADOR DER' })];
    expect(findAutoFixableEntries(tomorrow, [{ id: 'h1', clientKey: 'vieja', date: '2026-11-10' }])).toEqual([
      { clientKey: 'vieja', dateKey: '2026-11-13', diagnosis: 'SME MANGUITO ROTADOR DER' },
    ]);
  });

  it('pasa sola a la fecha del ingreso una ficha cargada días después por olvido', () => {
    const fixes = findAutoFixableEntries([cycle(1, '2026-11-02')], [{ id: 'h1', clientKey: 'tarde', date: '2026-11-06' }]);
    expect(fixes.map((fix) => [fix.clientKey, fix.dateKey])).toEqual([['tarde', '2026-11-02']]);
  });

  it('no mueve fichas viejas de hace meses, ni evoluciones de un día de sesión, ni si el ingreso ya tiene ficha', () => {
    const withSessions = [cycle(1, '2026-11-02', {
      sessions: [
        { id: 'a', date: '2026-11-02T12:00:00.000Z', sessionNumber: 1 },
        { id: 'b', date: '2026-11-04T12:00:00.000Z', sessionNumber: 2 },
      ],
    })];
    expect(findAutoFixableEntries(withSessions, [{ id: 'h1', clientKey: 'old', date: '2025-01-10' }])).toEqual([]);
    expect(findAutoFixableEntries(withSessions, [{ id: 'h1', clientKey: 's2', date: '2026-11-04' }])).toEqual([]);
    expect(findAutoFixableEntries(withSessions, [
      { id: 'h1', clientKey: 'ok', date: '2026-11-02' },
      { id: 'h2', clientKey: 'otra', date: '2026-11-06' },
    ])).toEqual([]);
  });

  it('dice a qué turno corresponde cada ficha', () => {
    const withSessions = [cycle(1, '2026-03-02', {
      sessions: [
        { id: 'a', date: '2026-03-02T12:00:00.000Z', sessionNumber: 1 },
        { id: 'b', date: '2026-03-04T12:00:00.000Z', sessionNumber: 2 },
      ],
    })];
    expect(describeEntryAppointment(withSessions, '2026-03-02')).toEqual({ kind: 'intake', label: 'Ingreso' });
    expect(describeEntryAppointment(withSessions, '2026-03-04')).toEqual({ kind: 'session', label: 'Sesión 2' });
    expect(describeEntryAppointment(withSessions, '2026-03-05')).toBeNull();
  });

  it('una ficha nueva toma la fecha del ingreso sin ficha aunque se cargue otro día', () => {
    expect(pickNewEntryDate(cycles, [entry('e1', '2026-03-02'), entry('e2', '2026-09-01')], '2026-11-20')).toBe('2026-11-12');
  });

  it('si el paciente inicia mañana, la ficha nueva toma la fecha de mañana', () => {
    expect(pickNewEntryDate([cycle(1, '2026-11-13')], [entry('vieja', '2026-11-10')], '2026-11-12')).toBe('2026-11-13');
  });

  it('con todas las fichas al día, una evolución nueva va con la fecha del turno de ingreso', () => {
    expect(pickNewEntryDate([cycle(1, '2026-03-02')], [entry('e1', '2026-03-02')], '2026-11-12')).toBe('2026-03-02');
  });

  it('sin turnos cargados, usa la fecha de hoy', () => {
    expect(pickNewEntryDate([], [], '2026-11-12')).toBe('2026-11-12');
  });

  it('trae el diagnóstico del turno de ingreso del ciclo', () => {
    const withDiagnosis = [cycle(1, '2026-11-12', { diagnosis: 'ESGUINCE TOBILLO DER' })];
    expect(findDiagnosisForDate(withDiagnosis, '2026-11-12')).toBe('ESGUINCE TOBILLO DER');
    expect(findDiagnosisForDate([], '2026-11-12')).toBe('');
  });

  it('pone el aviso de abandono en la primera ficha del ciclo cortado', () => {
    const messages = buildAbandonMessagesByEntry(cycles, [
      entry('a', '2026-09-01'), entry('b', '2026-09-05'), entry('c', '2026-11-12'),
    ]);
    expect([...messages.entries()]).toEqual([
      ['a', 'PACIENTE ABANDONA TRATAMIENTO EN LA SESIÓN 3 SIN AVISAR'],
    ]);
  });

  it('no muestra abandono si nadie lo marcó, aunque el ciclo tenga una sola sesión', () => {
    const today = [cycle(1, '2026-11-12', { state: 'INTERRUPTED', abandonedAtSession: null })];
    expect(buildAbandonMessagesByEntry(today, [entry('a', '2026-11-12')]).size).toBe(0);
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
