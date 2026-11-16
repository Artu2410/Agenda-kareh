/**
 * Ciclos de tratamiento de un paciente a partir de sus turnos.
 *
 * Un ciclo empieza en cada turno marcado como sesión de ingreso (isFirstSession),
 * que es el mismo corte que usa la renumeración de sesiones: el primer turno
 * histórico, un "Reiniciar ciclo", un turno nuevo con "Iniciar ciclo nuevo" o
 * la sesión 11 (los ciclos son de 10).
 *
 * La cantidad de sesiones la fija la orden médica / obra social (2, 5, 8 o 10):
 * un ciclo terminado sin turnos pendientes cuenta como completo aunque sea corto.
 * Solo queda "cortado" si en algún turno se marcó a mano el abandono.
 */

export const CYCLE_LENGTH = 10;

export const CYCLE_STATES = {
  inProgress: 'IN_PROGRESS', // tiene turnos pendientes
  complete: 'COMPLETE', // terminado: sin turnos pendientes (ciclo de 10 o corto según la orden)
  interrupted: 'INTERRUPTED', // el paciente abandonó (marcado a mano en un turno)
};

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const isPending = (appointment, today) => (
  appointment.status !== 'COMPLETED'
  && appointment.status !== 'NO_SHOW'
  && new Date(appointment.date) >= today
);

/**
 * @param {Array} appointments turnos no cancelados del paciente, en orden cronológico
 * @param {Date} now
 */
export const buildPatientCycles = (appointments = [], now = new Date()) => {
  const today = startOfDay(now);
  const groups = [];

  appointments.forEach((appointment, index) => {
    const startsCycle = index === 0
      || appointment.isFirstSession
      || groups[groups.length - 1].length >= CYCLE_LENGTH;
    if (startsCycle) groups.push([]);
    groups[groups.length - 1].push(appointment);
  });

  return groups.map((sessions, index) => {
    const attended = sessions.filter((item) => item.status === 'COMPLETED').length;
    const noShow = sessions.filter((item) => item.status === 'NO_SHOW').length;
    const pending = sessions.filter((item) => isPending(item, today)).length;
    // Turnos pasados que nunca se marcaron (ni asistió ni inasistencia).
    const unmarked = sessions.length - attended - noShow - pending;

    // Abandono: solo cuando se marcó a mano en un turno del ciclo (no se adivina por
    // turnos faltantes: un ingreso de hoy sin más sesiones cargadas no es abandono).
    const abandonedIndex = sessions.findLastIndex((item) => item.treatmentAbandoned);
    const abandonedAtSession = abandonedIndex === -1
      ? null
      : (sessions[abandonedIndex].sessionNumber || abandonedIndex + 1);

    let state = CYCLE_STATES.complete;
    if (abandonedAtSession != null) state = CYCLE_STATES.interrupted;
    else if (pending > 0) state = CYCLE_STATES.inProgress;

    const firstProfessional = sessions[0].professional;
    const professional = firstProfessional
      ? {
        id: firstProfessional.id || null,
        fullName: firstProfessional.fullName || null,
        licenseNumber: firstProfessional.licenseNumber || null,
        licenseNumberMP: firstProfessional.licenseNumberMP || null,
      }
      : null;

    // Diagnóstico del turno de ingreso (o el primero cargado en el ciclo) para la ficha.
    const diagnosis = sessions.find((item) => item.diagnosis?.trim())?.diagnosis.trim() || null;

    return {
      cycleNumber: index + 1,
      state,
      shortCycle: sessions.length < CYCLE_LENGTH,
      abandonedAtSession,
      professional,
      diagnosis,
      from: sessions[0].date,
      to: sessions[sessions.length - 1].date,
      totalSessions: sessions.length,
      attended,
      noShow,
      pending,
      unmarked,
      sessions: sessions.map((item, sessionIndex) => ({
        id: item.id,
        date: item.date,
        time: item.time,
        status: item.status,
        sessionNumber: item.sessionNumber || sessionIndex + 1,
        professionalName: item.professional?.fullName || null,
        sessionToken: item.sessionToken || null,
      })),
    };
  });
};

/** `AAAA-MM-DD` de una fecha guardada (los turnos van al mediodía: no hay corrimiento). */
export const toDateKey = (value) => new Date(value).toISOString().slice(0, 10);

/**
 * Ingresos/reingresos sin una ficha de historia clínica con su misma fecha, entre
 * `fromKey` y `untilKey` (inclusive). El más reciente primero.
 *
 * @param {Array} appointments turnos no cancelados del paciente, en orden cronológico
 * @param {Set<string>} historyDateKeys fechas (AAAA-MM-DD) de las fichas del paciente
 */
export const findPendingIntakes = (appointments, historyDateKeys, { fromKey, untilKey }) => (
  buildPatientCycles(appointments)
    .map((cycle) => ({ cycle, dateKey: toDateKey(cycle.from) }))
    .filter(({ dateKey }) => dateKey >= fromKey && dateKey <= untilKey && !historyDateKeys.has(dateKey))
    .map(({ cycle, dateKey }) => ({
      cycleNumber: cycle.cycleNumber,
      dateKey,
      label: cycle.cycleNumber === 1 ? 'Ingreso' : 'Reingreso',
      diagnosis: cycle.diagnosis,
    }))
    .reverse()
);

/** Sesiones asistidas por año (control de topes anuales de obra social). */
export const buildAttendedByYear = (appointments = []) => {
  const byYear = new Map();
  appointments
    .filter((item) => item.status === 'COMPLETED')
    .forEach((item) => {
      const year = new Date(item.date).getFullYear();
      byYear.set(year, (byYear.get(year) || 0) + 1);
    });

  return [...byYear.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, totalCompleted]) => ({ year, totalCompleted }));
};
