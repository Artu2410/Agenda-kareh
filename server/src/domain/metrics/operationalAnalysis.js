/**
 * KIS Fase 2 — análisis operativo.
 *
 * Funciones puras (sin Prisma) que convierten turnos + capacidad diaria en
 * indicadores conciliados. Unidad de capacidad: "lugar de turno" =
 * una franja de `slotDuration` minutos × `capacityPerSlot` pacientes
 * simultáneos. Cada turno no cancelado consume exactamente un lugar: el modelo
 * Appointment no registra duración, así que un tratamiento de 60 minutos se
 * cuenta como un lugar (limitación documentada en DEFINITIONS.occupancy).
 */
import { addDays, differenceInCalendarDays, format, startOfDay, startOfWeek } from 'date-fns';

export const STATUS = {
  COMPLETED: 'COMPLETED',
  SCHEDULED: 'SCHEDULED',
  NO_SHOW: 'NO_SHOW',
  CANCELLED: 'CANCELLED',
};

/**
 * Estados que todavía esperan resultado (asistió / no asistió). Incluye los
 * estados de autorización de obra social: un turno "Pend. autorización",
 * "Autorizado" o "Rechazado" sigue reservado y sin cerrar.
 */
export const PENDING_STATUSES = ['SCHEDULED', 'PENDING_AUTHORIZATION', 'AUTHORIZED', 'REJECTED'];
export const AUTHORIZATION_ATTENTION_STATUSES = ['PENDING_AUTHORIZATION', 'REJECTED'];

/** Clasificación única de estados para todos los indicadores de KIS y del Panel. */
export const classifyStatus = (status) => {
  const value = String(status || '').toUpperCase();
  if (value === 'CANCELLED') return 'cancelled';
  if (value === 'COMPLETED') return 'attended';
  if (value === 'NO_SHOW') return 'noShow';
  if (PENDING_STATUSES.includes(value)) return 'pending';
  return 'other';
};

export const THRESHOLDS = {
  generalSaturationRate: 85,
  slotSaturationRate: 90,
  minSlotOccurrences: 4,
  saturationWindowWeeks: 8,
  futureWindowDays: 60,
  // Si más de este % de los turnos pasados del mes siguen sin cerrar, los
  // indicadores de asistencia no son confiables.
  unclosedDataQualityRate: 15,
  // Referencias de volumen administrativo (turnos reservados/mes). Miden
  // volumen, no necesidad: nunca disparan una contratación por sí solas.
  adminVolumeMedium: 80,
  adminVolumeHigh: 160,
};

export const DEFINITIONS = {
  capacity: 'Lugares de turno del período: por cada día operativo (sin feriados, cierres ni bloqueos), franjas de la duración configurada dentro del horario de cada profesional × pacientes simultáneos por franja.',
  weeklyCapacity: 'Capacidad de la semana en curso (domingo a sábado) descontando cierres. La semana estándar es la misma semana sin cierres.',
  reserved: 'Turnos no cancelados del período: asistidos + inasistencias + pendientes sin cerrar + próximos. Cada uno consume un lugar.',
  attended: 'Turnos con estado Asistido (COMPLETED). Excluye pendientes, futuros, cancelados e inasistencias.',
  occupancy: 'Turnos reservados / capacidad del período × 100. Unidad: lugares de turno (un turno = un lugar, sin importar su duración real, porque la agenda no registra duración por turno).',
  freeCapacity: 'Capacidad − turnos reservados.',
  activePatients: 'Pacientes distintos (por identificador) con al menos un turno no cancelado en el mes.',
  calendarDaysToLastAppointment: 'Días calendario entre hoy y el último turno reservado. No implica que esos días tengan turnos.',
  daysWithAppointments: 'Días distintos desde hoy que tienen al menos un turno reservado.',
  weeksWithAppointments: 'Semanas distintas desde hoy con al menos un turno reservado.',
  futureOccupancy: 'Turnos reservados / capacidad en los próximos 60 días. Mide qué tan llena está la agenda futura.',
  slotSaturation: 'Por día de la semana y horario, turnos reservados / lugares disponibles en las últimas 8 semanas. Saturada si ≥ 90% con al menos 4 ocurrencias.',
  historicalCapacity: 'Estimada con la configuración de horarios actual: no existen versiones históricas de horarios ni de profesionales.',
};

const toKey = (date) => format(date, 'yyyy-MM-dd');
const roundOne = (value) => Math.round((Number(value) || 0) * 10) / 10;
const rate = (part, total) => (total > 0 ? (part / total) * 100 : 0);
const upper = (value) => String(value || '').toUpperCase();

/**
 * Conciliación del período: capacidad → reservados (por estado) → libre.
 * `appointments` puede incluir cancelados: se informan aparte y no consumen capacidad.
 */
export const buildPeriodBreakdown = ({ appointments = [], capacity = 0, now = new Date() }) => {
  const todayKey = toKey(now);
  const counts = {
    attended: 0, noShow: 0, pendingPast: 0, upcoming: 0, otherStatus: 0, cancelled: 0, authorizationAttention: 0,
  };

  appointments.forEach((appointment) => {
    const group = classifyStatus(appointment.status);
    const isPast = toKey(appointment.date) < todayKey;
    if (group === 'cancelled') counts.cancelled += 1;
    else if (group === 'attended') counts.attended += 1;
    else if (group === 'noShow') counts.noShow += 1;
    else if (group === 'pending') {
      counts[isPast ? 'pendingPast' : 'upcoming'] += 1;
      if (AUTHORIZATION_ATTENTION_STATUSES.includes(upper(appointment.status))) counts.authorizationAttention += 1;
    } else counts.otherStatus += 1;
  });

  const reserved = counts.attended + counts.noShow + counts.pendingPast + counts.upcoming + counts.otherStatus;
  const pastReserved = counts.attended + counts.noShow + counts.pendingPast;
  const overbooked = Math.max(reserved - capacity, 0);
  const resolved = counts.attended + counts.noShow;

  return {
    capacity,
    reserved,
    ...counts,
    free: Math.max(capacity - reserved, 0),
    overbooked,
    occupancyRate: roundOne(rate(reserved, capacity)),
    attendanceRate: resolved > 0 ? roundOne(rate(counts.attended, resolved)) : null,
    unclosedRate: pastReserved > 0 ? roundOne(rate(counts.pendingPast, pastReserved)) : 0,
    reconciles: reserved + Math.max(capacity - reserved, 0) - overbooked === capacity,
    asOf: todayKey,
  };
};

export const buildPatientBreakdown = ({
  monthAppointments = [],
  futureAppointments = [],
  historicalAppointments = [],
  monthStart,
}) => {
  const valid = (appointment) => upper(appointment.status) !== STATUS.CANCELLED && appointment.patientId;
  const monthKeyStart = toKey(monthStart);
  const active = new Set(monthAppointments.filter(valid).map((a) => a.patientId));
  const attended = new Set(monthAppointments
    .filter((a) => valid(a) && upper(a.status) === STATUS.COMPLETED)
    .map((a) => a.patientId));
  const withUpcoming = new Set(futureAppointments.filter(valid).map((a) => a.patientId));
  const seenBefore = new Set(historicalAppointments
    .filter((a) => valid(a) && toKey(a.date) < monthKeyStart)
    .map((a) => a.patientId));
  const newPatients = [...active].filter((id) => !seenBefore.has(id)).length;

  return {
    active: active.size,
    attendedThisMonth: attended.size,
    withUpcoming: withUpcoming.size,
    newThisMonth: newPatients,
    recurrentThisMonth: active.size - newPatients,
    activeWithoutUpcoming: [...active].filter((id) => !withUpcoming.has(id)).length,
  };
};

/**
 * Agenda futura. `getDayCapacity(date)` devuelve la capacidad efectiva del día.
 */
export const buildFutureAgenda = ({
  futureAppointments = [],
  now = new Date(),
  getDayCapacity = () => 0,
  windowDays = THRESHOLDS.futureWindowDays,
}) => {
  const today = startOfDay(now);
  const valid = futureAppointments.filter((a) => upper(a.status) !== STATUS.CANCELLED);
  const sorted = [...valid].sort((left, right) => left.date - right.date);
  const lastDate = sorted.length ? sorted[sorted.length - 1].date : null;
  const dayKeys = new Set(sorted.map((a) => toKey(a.date)));
  const weekKeys = new Set(sorted.map((a) => toKey(startOfWeek(a.date))));
  const windowEnd = addDays(today, windowDays);

  let windowCapacity = 0;
  for (let day = today; day < windowEnd; day = addDays(day, 1)) windowCapacity += getDayCapacity(day);
  const windowReserved = sorted.filter((a) => a.date < windowEnd).length;
  const calendarDays = lastDate ? Math.max(0, differenceInCalendarDays(lastDate, today)) : 0;

  return {
    lastAppointmentDate: lastDate,
    appointmentCount: sorted.length,
    patientCount: new Set(sorted.map((a) => a.patientId).filter(Boolean)).size,
    calendarDaysToLastAppointment: calendarDays,
    calendarWeeksToLastAppointment: roundOne(calendarDays / 7),
    daysWithAppointments: dayKeys.size,
    weeksWithAppointments: weekKeys.size,
    window: {
      days: windowDays,
      capacity: windowCapacity,
      reserved: windowReserved,
      occupancyRate: windowCapacity > 0 ? roundOne(rate(windowReserved, windowCapacity)) : null,
    },
  };
};

const minutesToTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const timeToMinutes = (value) => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

/**
 * Saturación por día de la semana y franja horaria.
 * `days` = resultados de getCapacityForDate (con capacityByProfessional).
 */
export const buildSlotSaturation = ({
  days = [],
  appointments = [],
  professionals = [],
  slotDuration = 0,
  capacityPerSlot = 0,
}) => {
  const slots = new Map();
  const byDay = new Map();
  const ensure = (map, key, init) => {
    if (!map.has(key)) map.set(key, init());
    return map.get(key);
  };

  if (slotDuration > 0 && capacityPerSlot > 0) {
    days.forEach((day) => {
      (day.capacityByProfessional || []).forEach((row) => {
        if (!row.isOperational || row.capacity <= 0) return;
        const professional = professionals.find((p) => p.id === row.professionalId);
        (professional?.workSchedule || [])
          .filter((item) => Number(item.dayOfWeek) === day.dayOfWeek)
          .forEach((item) => {
            const start = timeToMinutes(item.startTime);
            const end = timeToMinutes(item.endTime);
            if (start === null || end === null) return;
            for (let m = start; m + slotDuration <= end; m += slotDuration) {
              const slot = ensure(slots, `${day.dayOfWeek}|${minutesToTime(m)}`, () => ({
                dayOfWeek: day.dayOfWeek, time: minutesToTime(m), capacity: 0, reserved: 0, occurrences: 0,
              }));
              slot.capacity += capacityPerSlot;
              slot.occurrences += 1;
            }
          });
      });
    });
  }

  const windowKeys = new Set(days.map((day) => day.date));
  appointments.forEach((appointment) => {
    if (upper(appointment.status) === STATUS.CANCELLED) return;
    if (!windowKeys.has(toKey(appointment.date))) return;
    const slot = slots.get(`${appointment.date.getDay()}|${appointment.time}`);
    if (slot) slot.reserved += 1;
  });

  const slotRows = [...slots.values()].map((slot) => ({
    ...slot,
    occupancyRate: roundOne(rate(slot.reserved, slot.capacity)),
    saturated: slot.occurrences >= THRESHOLDS.minSlotOccurrences
      && rate(slot.reserved, slot.capacity) >= THRESHOLDS.slotSaturationRate,
  }));
  slotRows.forEach((slot) => {
    const day = ensure(byDay, slot.dayOfWeek, () => ({ dayOfWeek: slot.dayOfWeek, capacity: 0, reserved: 0 }));
    day.capacity += slot.capacity;
    day.reserved += slot.reserved;
  });

  const saturatedSlots = slotRows.filter((slot) => slot.saturated);
  return {
    windowStart: days[0]?.date || null,
    windowEnd: days[days.length - 1]?.date || null,
    byDayOfWeek: [...byDay.values()]
      .map((day) => ({ ...day, occupancyRate: roundOne(rate(day.reserved, day.capacity)) }))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek),
    topSlots: [...slotRows].sort((a, b) => b.occupancyRate - a.occupancyRate).slice(0, 5),
    saturatedSlotCount: saturatedSlots.length,
    slotCount: slotRows.length,
    saturatedShare: roundOne(rate(saturatedSlots.length, slotRows.length)),
  };
};

/** Crecimiento sostenido: usa solo meses cerrados (excluye el mes en curso). */
export const getSustainedGrowth = (closedMonths = []) => {
  const last = closedMonths.slice(-3);
  if (last.length < 3 || last.some((row) => row.attendedCount <= 0)) return false;
  return last[0].attendedCount <= last[1].attendedCount
    && last[1].attendedCount <= last[2].attendedCount
    && last[2].attendedCount > last[0].attendedCount;
};

export const buildAdminAssessment = ({ breakdown, patients }) => {
  const volumeLevel = breakdown.reserved >= THRESHOLDS.adminVolumeHigh
    ? 'HIGH'
    : breakdown.reserved >= THRESHOLDS.adminVolumeMedium ? 'MEDIUM' : 'LOW';
  const supportByVolume = {
    LOW: 'Sin soporte adicional',
    MEDIUM: 'Automatización (recordatorios y confirmaciones)',
    HIGH: 'Evaluar soporte parcial',
  };
  const volume = [
    { key: 'reserved', label: 'Turnos reservados en el mes', value: breakdown.reserved, measured: true },
    { key: 'patients', label: 'Pacientes distintos en el mes', value: patients.active, measured: true },
    { key: 'new_patients', label: 'Pacientes nuevos en el mes', value: patients.newThisMonth, measured: true },
    { key: 'cancelled', label: 'Cancelaciones en el mes', value: breakdown.cancelled, measured: true },
    { key: 'no_show', label: 'Inasistencias en el mes', value: breakdown.noShow, measured: true },
    { key: 'unclosed', label: 'Turnos pasados sin cerrar', value: breakdown.pendingPast, measured: true },
  ];
  const need = [
    { key: 'whatsapp', label: 'Consultas de WhatsApp por semana', measured: false },
    { key: 'admin_hours', label: 'Horas administrativas semanales', measured: false },
    { key: 'non_clinical_time', label: 'Tiempo del profesional en tareas no clínicas', measured: false },
    { key: 'response_delay', label: 'Demora en responder consultas', measured: false },
  ];
  const reasons = [
    `Volumen ${volumeLevel === 'HIGH' ? 'alto' : volumeLevel === 'MEDIUM' ? 'medio' : 'bajo'}: ${breakdown.reserved} turnos reservados y ${patients.active} pacientes en el mes.`,
    'No hay datos de carga administrativa real (consultas, horas, demoras): no se puede afirmar que la carga no se absorba.',
  ];
  if (breakdown.pendingPast > 0) {
    reasons.push(`${breakdown.pendingPast} turnos pasados siguen sin cerrar: es una señal concreta de carga administrativa pendiente.`);
  }

  return {
    status: 'INSUFFICIENT_DATA',
    recommended: false,
    label: 'Datos insuficientes para recomendar contratación',
    volumeLevel,
    suggestedSupport: supportByVolume[volumeLevel],
    reasons,
    volume,
    need,
    // La UI solo lista datos medidos; los de necesidad faltantes se explican en `reasons`.
    criteria: volume.map((item) => ({ ...item, met: false })),
    metCount: 0,
    requiredCount: 0,
  };
};

export const buildKinesiologistAssessment = ({
  occupancyRate, futureOccupancyRate, sustainedGrowth, saturation,
}) => {
  const criteria = [
    {
      key: 'occupancy', label: 'Ocupación del mes mayor a 85%',
      met: occupancyRate > THRESHOLDS.generalSaturationRate, value: roundOne(occupancyRate), measured: true,
    },
    {
      key: 'future_occupancy', label: 'Agenda de los próximos 60 días ocupada más de 85%',
      met: futureOccupancyRate !== null && futureOccupancyRate > THRESHOLDS.generalSaturationRate,
      value: futureOccupancyRate, measured: futureOccupancyRate !== null,
    },
    {
      key: 'growth', label: 'Crecimiento sostenido 3 meses cerrados',
      met: sustainedGrowth, value: sustainedGrowth ? 'Sí' : 'No', measured: true,
    },
  ];
  const metCount = criteria.filter((c) => c.met).length;
  const informational = [
    {
      key: 'saturated_slots',
      label: `Franjas saturadas: ${saturation.saturatedSlotCount} de ${saturation.slotCount}`,
      met: false, value: saturation.saturatedShare, measured: true,
    },
  ];

  return {
    recommended: metCount === criteria.length,
    metCount,
    requiredCount: criteria.length,
    label: metCount === criteria.length ? 'Segundo kinesiólogo recomendado' : 'Segundo kinesiólogo en observación',
    criteria: [...criteria, ...informational],
  };
};

export const getOperationalStatus = ({
  capacity, occupancyRate, unclosedRate, saturation, sustainedGrowth,
}) => {
  if (capacity <= 0) {
    return { key: 'INSUFFICIENT_DATA', label: 'Datos insuficientes', tone: 'neutral', description: 'No hay capacidad calculable: faltan horarios o duración de sesión.' };
  }
  if (unclosedRate > THRESHOLDS.unclosedDataQualityRate) {
    return { key: 'INSUFFICIENT_DATA', label: 'Datos insuficientes', tone: 'warning', description: `El ${roundOne(unclosedRate)}% de los turnos pasados del mes no tiene estado final (asistió / no asistió).` };
  }
  if (occupancyRate > THRESHOLDS.generalSaturationRate) {
    return { key: 'GENERAL_SATURATION', label: 'Saturación general', tone: 'danger', description: 'La ocupación mensual supera el 85% de la capacidad.' };
  }
  if (saturation.saturatedSlotCount > 0) {
    return { key: 'PARTIAL_SATURATION', label: 'Saturación parcial', tone: 'warning', description: `${saturation.saturatedSlotCount} franjas horarias superan el 90% de ocupación en las últimas semanas.` };
  }
  if (sustainedGrowth) {
    return { key: 'GROWING_DEMAND', label: 'Demanda en crecimiento', tone: 'success', description: 'Los asistidos crecieron 3 meses cerrados seguidos, con capacidad disponible.' };
  }
  return { key: 'AVAILABLE_CAPACITY', label: 'Capacidad disponible', tone: 'success', description: 'Hay margen para atender más pacientes con la agenda actual.' };
};

export const buildBottleneck = ({ capacity, occupancyRate, saturation }) => {
  if (capacity <= 0) {
    return { key: 'CONFIGURATION', label: 'Falta configuración operativa', description: 'No hay capacidad calculable porque faltan horarios profesionales o duración de sesión.' };
  }
  if (occupancyRate > THRESHOLDS.generalSaturationRate) {
    return { key: 'CLINICAL_CAPACITY', label: 'Falta capacidad clínica', description: 'La ocupación mensual supera el 85%.' };
  }
  if (saturation.saturatedSlotCount > 0) {
    return { key: 'SATURATED_SLOTS', label: 'Franjas horarias saturadas', description: 'Algunos horarios están llenos aunque la ocupación global tenga margen. Conviene redistribuir antes de ampliar.' };
  }
  if (occupancyRate < 50) {
    return { key: 'DEMAND', label: 'Falta demanda', description: 'La capacidad disponible supera claramente los turnos reservados. La palanca principal es captar pacientes.' };
  }
  return { key: 'NO_CRITICAL_BOTTLENECK', label: 'Sin cuello crítico visible', description: 'La operación tiene margen y no muestra una restricción dominante con los datos actuales.' };
};
