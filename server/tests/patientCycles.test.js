import { buildAttendedByYear, buildPatientCycles, CYCLE_STATES } from '../src/utils/patientCycles.js';

const NOW = new Date('2026-11-11T15:00:00Z');
const apt = (id, date, status, isFirstSession = false) => ({
  id, date: new Date(`${date}T12:00:00Z`), time: '10:00', status, isFirstSession,
});

describe('patient cycles', () => {
  it('cuts the cycle at a new intake session and reports where the old one stopped', () => {
    const cycles = buildPatientCycles([
      apt('a1', '2026-08-03', 'COMPLETED', true),
      apt('a2', '2026-08-05', 'COMPLETED'),
      apt('a3', '2026-08-07', 'COMPLETED'),
      // abandonó; vuelve en noviembre con ciclo nuevo
      apt('b1', '2026-11-02', 'COMPLETED', true),
      apt('b2', '2026-11-16', 'SCHEDULED'),
    ], NOW);

    expect(cycles).toHaveLength(2);
    expect(cycles[0]).toMatchObject({ cycleNumber: 1, state: CYCLE_STATES.interrupted, totalSessions: 3, attended: 3 });
    expect(cycles[1]).toMatchObject({ cycleNumber: 2, state: CYCLE_STATES.inProgress, attended: 1, pending: 1 });
    expect(cycles[0].sessions.map((s) => s.id)).toEqual(['a1', 'a2', 'a3']);
  });

  it('starts a new cycle after 10 sessions and marks the full one complete', () => {
    const sessions = Array.from({ length: 12 }, (_, i) => apt(`s${i}`, `2026-0${i < 9 ? 3 : 4}-${String(i + 1).padStart(2, '0')}`, 'COMPLETED', i === 0));
    const cycles = buildPatientCycles(sessions, NOW);

    expect(cycles.map((c) => c.totalSessions)).toEqual([10, 2]);
    expect(cycles[0].state).toBe(CYCLE_STATES.complete);
  });

  it('counts past sessions never marked separately from no-shows', () => {
    const [cycle] = buildPatientCycles([
      apt('a1', '2026-10-01', 'COMPLETED', true),
      apt('a2', '2026-10-03', 'NO_SHOW'),
      apt('a3', '2026-10-05', 'SCHEDULED'),
    ], NOW);

    expect(cycle).toMatchObject({ attended: 1, noShow: 1, unmarked: 1, pending: 0, state: CYCLE_STATES.interrupted });
  });

  it('reports the last session the patient attended when the cycle was abandoned', () => {
    const cycles = buildPatientCycles([
      apt('a1', '2026-08-03', 'COMPLETED', true),
      apt('a2', '2026-08-05', 'SCHEDULED'), // pasó sin marcar: cuenta como que fue
      apt('a3', '2026-08-07', 'NO_SHOW'),
      apt('b1', '2026-11-02', 'COMPLETED', true),
      apt('b2', '2026-11-16', 'SCHEDULED'),
    ], NOW);

    expect(cycles[0].abandonedAtSession).toBe(2);
    expect(cycles[1].abandonedAtSession).toBeNull();
  });

  it('reports 0 when the patient never came to any session of the cycle', () => {
    const [cycle] = buildPatientCycles([
      apt('a1', '2026-08-03', 'NO_SHOW', true),
    ], NOW);

    expect(cycle.abandonedAtSession).toBe(0);
  });

  it('exposes the professional of the cycle with both licenses', () => {
    const [cycle] = buildPatientCycles([
      {
        ...apt('a1', '2026-11-02', 'COMPLETED', true),
        professional: { id: 'pro-1', fullName: 'Katia Alumine Romero', licenseNumber: '18900', licenseNumberMP: '10318' },
      },
    ], NOW);

    expect(cycle.professional).toEqual({
      id: 'pro-1', fullName: 'Katia Alumine Romero', licenseNumber: '18900', licenseNumberMP: '10318',
    });
  });

  it('counts attended sessions per year', () => {
    expect(buildAttendedByYear([
      apt('a', '2025-12-01', 'COMPLETED'),
      apt('b', '2026-01-10', 'COMPLETED'),
      apt('c', '2026-01-12', 'NO_SHOW'),
    ])).toEqual([{ year: 2026, totalCompleted: 1 }, { year: 2025, totalCompleted: 1 }]);
  });
});
