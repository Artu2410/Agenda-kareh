/**
 * Historia clínica ↔ ciclos de tratamiento.
 *
 * Cada ciclo empieza en un turno de ingreso (ciclo 1) o reingreso (ciclos siguientes).
 * La ficha de ese ciclo lleva la fecha del turno reservado, aunque se cargue días
 * después o antes. Una ficha pertenece al ciclo cuya fecha de ingreso es la última
 * anterior o igual a la de la ficha.
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
 * El primero no tiene límite inferior, así cuenta una ficha cargada antes del primer turno.
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

export const getIntakeLabel = (cycle) => (cycle?.cycleNumber === 1 ? 'Ingreso' : 'Reingreso');

/** Ciclo al que pertenece una fecha (null si es anterior al primer ingreso). */
export const findCycleForDate = (cycles, dateKey) => {
  let match = null;
  chronological(cycles).forEach((cycle) => {
    if (toDateKey(cycle.from) <= dateKey) match = cycle;
  });
  return match;
};

/**
 * Ingresos/reingresos que ya ocurrieron (o son hoy) y no tienen ninguna ficha en su
 * ciclo. El más reciente primero.
 */
export const findMissingIntakes = (cycles, entries, todayKey) => withRanges(cycles)
  .filter((range) => range.fromKey <= todayKey && entriesInRange(entries, range).length === 0)
  .map((range) => ({
    cycleNumber: range.cycle.cycleNumber,
    dateKey: range.fromKey,
    label: getIntakeLabel(range.cycle),
    professional: range.cycle.professional || null,
  }))
  .reverse();

/**
 * Fecha para una ficha nueva: la del ingreso pendiente más reciente; si no hay, la
 * del próximo ingreso reservado sin ficha (se carga antes); si no, hoy.
 */
export const pickNewEntryDate = (cycles, entries, todayKey) => {
  const [latestMissing] = findMissingIntakes(cycles, entries, todayKey);
  if (latestMissing) return latestMissing.dateKey;

  const upcoming = withRanges(cycles).find((range) => (
    range.fromKey > todayKey && entriesInRange(entries, range).length === 0
  ));
  return upcoming ? upcoming.fromKey : todayKey;
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
