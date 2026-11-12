/**
 * Ciclos de tratamiento de un paciente a partir de sus turnos.
 *
 * Un ciclo empieza en cada turno marcado como sesión de ingreso (isFirstSession),
 * que es el mismo corte que usa la renumeración de sesiones: el primer turno
 * histórico, un "Reiniciar ciclo", un turno nuevo con "Iniciar ciclo nuevo" o
 * la sesión 11 (los ciclos son de 10).
 *
 * Así un paciente que abandona en la sesión 3 y vuelve más tarde muestra
 * "Ciclo 1: quedó en 3 sesiones" y "Ciclo 2" desde la nueva sesión 1.
 */

export const CYCLE_LENGTH = 10;

export const CYCLE_STATES = {
  inProgress: 'IN_PROGRESS', // tiene turnos pendientes
  complete: 'COMPLETE', // llegó a las 10 sesiones
  interrupted: 'INTERRUPTED', // sin turnos pendientes y con menos de 10 sesiones
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

    let state = CYCLE_STATES.interrupted;
    if (pending > 0) state = CYCLE_STATES.inProgress;
    else if (sessions.length >= CYCLE_LENGTH) state = CYCLE_STATES.complete;

    // Abandono: solo cuando se marcó a mano en un turno del ciclo (no se adivina por
    // turnos faltantes: un ingreso de hoy sin más sesiones cargadas no es abandono).
    const abandonedIndex = sessions.findLastIndex((item) => item.treatmentAbandoned);
    const abandonedAtSession = abandonedIndex === -1
      ? null
      : (sessions[abandonedIndex].sessionNumber || abandonedIndex + 1);

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
      })),
    };
  });
};

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
