/**
 * Historia clínica ↔ turnos del paciente.
 *
 * Cada ciclo empieza en un turno de ingreso (ciclo 1) o reingreso (ciclos siguientes).
 * La ficha de ese ciclo lleva la fecha y el diagnóstico de ese turno: una ficha cuenta
 * como ingreso/reingreso solo si su fecha coincide exactamente con la del turno.
 * Una ficha con una fecha que no es la de ningún turno se marca para corregirla.
 *
 * Los ciclos llegan de `/patients/:id/session-cycles`; las fechas de las fichas,
 * como `AAAA-MM-DD`.
 */

/** `AAAA-MM-DD` de un ISO o Date (los turnos se guardan al mediodía: no hay corrimiento). */
export const toDateKey = (value) => {
  if (!value) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  return text.split('T')[0];
};

/** Hoy en hora local (toISOString daría mañana después de las 21 h en Argentina). */
export const todayDateKey = (now = new Date()) => {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

const chronological = (cycles = []) => [...cycles]
  .sort((a, b) => toDateKey(a.from).localeCompare(toDateKey(b.from)));

/**
 * Rango de fechas de cada ciclo: desde su ingreso hasta el día anterior al siguiente.
 * El primero no tiene límite inferior (una ficha anterior al primer turno es de ese ciclo).
 */
const withRanges = (cycles) => {
  const ordered = chronological(cycles);
  return ordered.map((cycle, index) => ({
    cycle,
    fromKey: toDateKey(cycle.from),
    lowerKey: index === 0 ? '' : toDateKey(cycle.from),
    nextKey: ordered[index + 1] ? toDateKey(ordered[index + 1].from) : null,
  }));
};

const isInRange = (dateKey, range) => (
  dateKey >= range.lowerKey && (!range.nextKey || dateKey < range.nextKey)
);

const entriesInRange = (entries, range) => (entries || [])
  .filter((entry) => entry?.date && isInRange(entry.date, range))
  .sort((a, b) => a.date.localeCompare(b.date));

const hasEntryOn = (entries, dateKey) => (entries || []).some((entry) => entry?.date === dateKey);

export const getIntakeLabel = (cycle) => (cycle?.cycleNumber === 1 ? 'Ingreso' : 'Reingreso');

/** Ciclo al que pertenece una fecha; una fecha anterior al primer ingreso es del primer ciclo. */
export const findCycleForDate = (cycles, dateKey) => {
  const ordered = chronological(cycles);
  let match = ordered[0] || null;
  ordered.forEach((cycle) => {
    if (toDateKey(cycle.from) <= dateKey) match = cycle;
  });
  return match;
};

/**
 * Ingresos/reingresos sin una ficha con su misma fecha, incluidos los que todavía no
 * llegaron (la ficha se puede cargar antes). El más reciente primero.
 */
export const findMissingIntakes = (cycles, entries, todayKey) => chronological(cycles)
  .filter((cycle) => !hasEntryOn(entries, toDateKey(cycle.from)))
  .map((cycle) => ({
    cycleNumber: cycle.cycleNumber,
    dateKey: toDateKey(cycle.from),
    label: getIntakeLabel(cycle),
    isUpcoming: toDateKey(cycle.from) > todayKey,
    diagnosis: cycle.diagnosis || '',
    professional: cycle.professional || null,
  }))
  .reverse();

/**
 * Fecha para una ficha nueva, siempre la de un turno de ingreso/reingreso:
 * 1. el ingreso ya ocurrido sin ficha más reciente;
 * 2. el próximo ingreso reservado sin ficha (se carga antes);
 * 3. el ingreso del ciclo en curso (o el próximo, si todavía no empezó).
 * Solo si el paciente no tiene turnos, hoy.
 */
export const pickNewEntryDate = (cycles, entries, todayKey) => {
  const missing = findMissingIntakes(cycles, entries, todayKey);
  const latestPastMissing = missing.find((intake) => !intake.isUpcoming);
  if (latestPastMissing) return latestPastMissing.dateKey;
  const nextUpcomingMissing = [...missing].reverse().find((intake) => intake.isUpcoming);
  if (nextUpcomingMissing) return nextUpcomingMissing.dateKey;

  const current = findCycleForDate(cycles, todayKey);
  return current ? toDateKey(current.from) : todayKey;
};

/** Diagnóstico del turno de ingreso del ciclo al que pertenece la fecha. */
export const findDiagnosisForDate = (cycles, dateKey) => findCycleForDate(cycles, dateKey)?.diagnosis || '';

/**
 * A qué turno corresponde la fecha de una ficha:
 * { kind: 'intake', label: 'Ingreso' | 'Reingreso' } · { kind: 'session', label: 'Sesión 4' } · null
 */
export const describeEntryAppointment = (cycles, dateKey) => {
  for (const cycle of chronological(cycles)) {
    if (toDateKey(cycle.from) === dateKey) return { kind: 'intake', label: getIntakeLabel(cycle) };
    const session = (cycle.sessions || []).find((item) => toDateKey(item.date) === dateKey);
    if (session) return { kind: 'session', label: `Sesión ${session.sessionNumber}` };
  }
  return null;
};

/**
 * Ficha cuya fecha no es la de ningún turno: propone la fecha y el diagnóstico del
 * turno de ingreso de su ciclo. null si coincide con un turno o no hay turnos.
 */
export const findEntryDateMismatch = (cycles, entry) => {
  if (!entry?.date || !cycles?.length) return null;
  if (describeEntryAppointment(cycles, entry.date)) return null;
  const cycle = findCycleForDate(cycles, entry.date);
  if (!cycle) return null;
  return {
    dateKey: toDateKey(cycle.from),
    label: getIntakeLabel(cycle),
    diagnosis: cycle.diagnosis || '',
  };
};

const AUTO_FIX_EARLY_DAYS = 30;

const daysBetween = (fromKey, toKey) => Math.round(
  (new Date(`${toKey}T12:00:00Z`) - new Date(`${fromKey}T12:00:00Z`)) / 86_400_000,
);

/**
 * Fichas de ingreso cargadas con otra fecha, que se pasan solas a la del turno.
 * Por cada ingreso/reingreso sin ficha en su fecha, toma la primera ficha de su ciclo
 * que no cae en ningún día de turno: la cargada después (se olvidaron) o hasta 30 días
 * antes (se cargó antes). Las que caen en un día de sesión no se tocan: son evoluciones.
 *
 * @returns {Array<{ clientKey, dateKey, diagnosis }>}
 */
export const findAutoFixableEntries = (cycles, entries) => {
  const fixes = [];
  const fixedKeys = new Set();
  withRanges(cycles).forEach((range) => {
    if (hasEntryOn(entries, range.fromKey)) return;
    const candidate = entriesInRange(entries, range).find((entry) => (
      !fixedKeys.has(entry.clientKey)
      && !String(entry.id || '').startsWith('temp-')
      && !describeEntryAppointment(cycles, entry.date)
      && (entry.date > range.fromKey || daysBetween(entry.date, range.fromKey) <= AUTO_FIX_EARLY_DAYS)
    ));
    if (!candidate) return;
    fixedKeys.add(candidate.clientKey);
    fixes.push({ clientKey: candidate.clientKey, dateKey: range.fromKey, diagnosis: range.cycle.diagnosis || '' });
  });
  return fixes;
};

/** Solo si se marcó "Abandonó tratamiento" en un turno del ciclo. */
export const buildAbandonMessage = (cycle) => {
  if (!cycle || cycle.abandonedAtSession == null) return null;
  return `PACIENTE ABANDONA TRATAMIENTO EN LA SESIÓN ${cycle.abandonedAtSession} SIN AVISAR`;
};

/** Aviso de abandono por ficha: va en la primera ficha de cada ciclo cortado. */
export const buildAbandonMessagesByEntry = (cycles, entries) => {
  const messages = new Map();
  withRanges(cycles).forEach((range) => {
    const message = buildAbandonMessage(range.cycle);
    if (!message) return;
    const [firstEntry] = entriesInRange(entries, range);
    if (firstEntry) messages.set(firstEntry.clientKey, message);
  });
  return messages;
};

/** Profesional de la ficha; si no quedó guardado, el del ciclo (o el último que atendió). */
export const resolveEntryProfessional = (entry, cycles) => {
  if (entry?.professional?.fullName) return entry.professional;
  const cycleProfessional = findCycleForDate(cycles, entry?.date || '')?.professional;
  if (cycleProfessional?.fullName) return cycleProfessional;
  const latest = chronological(cycles).reverse().find((cycle) => cycle.professional?.fullName);
  return latest?.professional || null;
};

/** { name: 'Lic. Katia Alumine Romero', licenses: 'M.P. 10318 - M.N. 18900' } */
export const buildProfessionalSignature = (professional) => {
  if (!professional?.fullName) return null;
  const licenses = [
    professional.licenseNumberMP ? `M.P. ${professional.licenseNumberMP}` : '',
    professional.licenseNumber ? `M.N. ${professional.licenseNumber}` : '',
  ].filter(Boolean).join(' - ');
  return { name: `Lic. ${professional.fullName}`, licenses };
};
