const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeDateKey = (value) => {
  if (value === null || value === undefined || value === '') return null;

  const rawValue = value instanceof Date ? value : String(value);
  const date = typeof rawValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawValue.trim())
    ? new Date(`${rawValue.trim()}T00:00:00`)
    : new Date(rawValue);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toDateObject = (value) => {
  if (value instanceof Date) return new Date(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return new Date(`${trimmed}T00:00:00`);
    }
    return new Date(trimmed);
  }
  return new Date(value);
};

export const roundOne = (value) => Math.round(toNumber(value) * 10) / 10;
export const roundTwo = (value) => Math.round(toNumber(value) * 100) / 100;

export const parseTimeToMinutes = (value) => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
};

export const getScheduleMinutesByDay = (schedule = []) => {
  const entries = Array.isArray(schedule) ? schedule : [];

  return entries.map((item) => {
    const start = parseTimeToMinutes(item.startTime);
    const end = parseTimeToMinutes(item.endTime);

    return {
      dayOfWeek: item.dayOfWeek,
      startTime: item.startTime,
      endTime: item.endTime,
      minutes: start === null || end === null || end <= start ? 0 : end - start,
    };
  });
};

export const getScheduleMinutes = (schedule = []) => (
  getScheduleMinutesByDay(schedule).reduce((sum, item) => sum + item.minutes, 0)
);

const resolveSessionDurationMinutes = (agendaConfig = null) => {
  const duration = Number(agendaConfig?.slotDuration);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
};

const resolveCapacityPerSlot = (agendaConfig = null) => {
  const capacity = Number(agendaConfig?.capacityPerSlot);
  return Number.isFinite(capacity) && capacity > 0 ? capacity : 0;
};

const getEffectiveSlotsForRange = (startTime, endTime, slotDurationMinutes) => {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);

  if (start === null || end === null || end < start || slotDurationMinutes <= 0) return 0;

  const totalSpanMinutes = end - start;
  // Schedule end times are exclusive: 14:00–19:30 contains 11 half-hour starts,
  // not an additional slot at 19:30.
  return Math.max(0, Math.floor(totalSpanMinutes / slotDurationMinutes));
};

const getDateKeySet = (values = []) => new Set(
  (Array.isArray(values) ? values : []).map((value) => normalizeDateKey(value)).filter(Boolean)
);

const getApplicableCalendarEntries = (calendarEntries, dateKey, professionalId) => (
  (Array.isArray(calendarEntries) ? calendarEntries : []).filter((entry) => (
    entry?.isActive !== false
    && normalizeDateKey(entry?.date) === dateKey
    && (!entry.professionalId || entry.professionalId === professionalId)
  ))
);

const getCalendarEntriesForDate = (calendarEntries, dateKey) => (
  (Array.isArray(calendarEntries) ? calendarEntries : []).filter((entry) => (
    entry?.isActive !== false && normalizeDateKey(entry?.date) === dateKey
  ))
);

const getOperationalExceptionDecision = (entries) => {
  const operationalExceptions = entries.filter((entry) => (
    String(entry.type || '').toUpperCase() === 'SCHEDULE_EXCEPTION'
  ));
  if (operationalExceptions.length === 0) return null;

  const exceptionStates = new Set(operationalExceptions.map((entry) => Boolean(entry.isOperational)));
  const isOperational = exceptionStates.size === 1 && exceptionStates.has(true);
  return {
    isOperational,
    decisionSource: 'OPERATIONAL_EXCEPTION',
    closureReasons: isOperational ? [] : operationalExceptions,
  };
};

const getAutomaticHolidayClosures = (holidays, dateKey, agendaConfig) => (
  agendaConfig?.nationalHolidaysClose === true
    ? (Array.isArray(holidays) ? holidays : [])
      .filter((holiday) => holiday.date === dateKey
        && holiday.type === 'NATIONAL_HOLIDAY'
        && holiday.affectsOperation !== false)
      .map((holiday) => ({
        ...holiday,
        id: `national-holiday:${holiday.date}:${holiday.name}`,
        type: 'PUBLIC_HOLIDAY',
        originalType: holiday.type,
        isActive: true,
        isOperational: false,
        professionalId: null,
      }))
    : []
);

const getProfessionalCalendarDecision = (calendarEntries, dateKey, professionalId) => {
  const applicableEntries = getApplicableCalendarEntries(calendarEntries, dateKey, professionalId);
  const scopedEntries = [
    applicableEntries.filter((entry) => entry.professionalId === professionalId && professionalId),
    applicableEntries.filter((entry) => !entry.professionalId),
  ];

  for (const entriesAtScope of scopedEntries) {
    // A Kareh operational exception is an explicit decision that overrides
    // the default closed state derived from an official holiday or closure.
    const operationalExceptionDecision = getOperationalExceptionDecision(entriesAtScope);
    if (operationalExceptionDecision) return operationalExceptionDecision;

    const blockingEntries = entriesAtScope.filter((entry) => (
      ['PUBLIC_HOLIDAY', 'CLINIC_CLOSURE'].includes(String(entry.type || '').toUpperCase())
    ));
    if (blockingEntries.length > 0) {
      return {
        isOperational: false,
        decisionSource: 'CLOSURE_OR_HOLIDAY',
        closureReasons: blockingEntries,
      };
    }
  }

  return { isOperational: true, decisionSource: 'SCHEDULE', closureReasons: [] };
};

export const isCalendarDateOperational = ({
  date,
  professionalId = null,
  calendarEntries = [],
  holidays = [],
  agendaConfig = null,
  blockedDates = [],
} = {}) => getProfessionalCalendarDecision(
  [
    ...(Array.isArray(calendarEntries) ? calendarEntries : []),
    ...getAutomaticHolidayClosures(holidays, normalizeDateKey(date), agendaConfig),
  ],
  normalizeDateKey(date),
  professionalId,
).isOperational
&& !getDateKeySet(blockedDates).has(normalizeDateKey(date));

const summarizeAppointments = (appointments = [], dateKey) => {
  const dayAppointments = appointments.filter((appointment) => (
    normalizeDateKey(appointment?.date || appointment?.appointmentDate || null) === dateKey
    && String(appointment?.status || '').toUpperCase() !== 'CANCELLED'
  ));
  const attendedCount = dayAppointments.filter(
    (appointment) => String(appointment.status || '').toUpperCase() === 'COMPLETED',
  ).length;
  const noShowCount = dayAppointments.filter(
    (appointment) => String(appointment.status || '').toUpperCase() === 'NO_SHOW',
  ).length;

  return {
    occupied: dayAppointments.length,
    reservedCount: dayAppointments.length,
    scheduledCount: dayAppointments.filter(
      (appointment) => String(appointment.status || '').toUpperCase() === 'SCHEDULED',
    ).length,
    attendedCount,
    noShowCount,
    attendanceRate: attendedCount + noShowCount > 0
      ? (attendedCount / (attendedCount + noShowCount)) * 100
      : 0,
  };
};

export const getEffectiveCapacityForDate = ({
  date,
  professionals = [],
  agendaConfig = null,
  appointments = [],
  blockedDates = [],
  calendarEntries = [],
  holidays = [],
} = {}) => {
  const dateObject = toDateObject(date);
  const dateKey = normalizeDateKey(dateObject);
  const slotDurationMinutes = resolveSessionDurationMinutes(agendaConfig);
  const capacityPerSlot = resolveCapacityPerSlot(agendaConfig);
  const blockedDateSet = getDateKeySet(blockedDates);
  const dateCalendarEntries = getCalendarEntriesForDate(calendarEntries, dateKey);
  const automaticHolidayClosures = getAutomaticHolidayClosures(holidays, dateKey, agendaConfig);
  const effectiveCalendarEntries = [...dateCalendarEntries, ...automaticHolidayClosures];
  const capacityByProfessional = [];
  const professionalCapacities = professionals.map((professional) => {
    const schedule = Array.isArray(professional?.workSchedule) ? professional.workSchedule : [];
    const entries = schedule.filter((item) => Number(item.dayOfWeek) === dateObject.getDay());
    const dailySlots = entries.reduce(
      (innerSum, item) => innerSum + getEffectiveSlotsForRange(item.startTime, item.endTime, slotDurationMinutes),
      0,
    );
    const calendarDecision = getProfessionalCalendarDecision(
      effectiveCalendarEntries,
      dateKey,
      professional.id,
    );

    const row = {
      professionalId: professional.id,
      theoreticalSlots: dailySlots,
      theoreticalCapacity: dailySlots * capacityPerSlot,
      slots: calendarDecision.isOperational && !blockedDateSet.has(dateKey) ? dailySlots : 0,
      capacity: calendarDecision.isOperational && !blockedDateSet.has(dateKey) ? dailySlots * capacityPerSlot : 0,
      isOperational: calendarDecision.isOperational && !blockedDateSet.has(dateKey),
      closureReasons: calendarDecision.closureReasons,
    };
    capacityByProfessional.push(row);
    return row;
  });
  const theoreticalSlots = professionalCapacities.reduce((sum, row) => sum + row.theoreticalSlots, 0);
  const theoreticalCapacity = professionalCapacities.reduce((sum, row) => sum + row.theoreticalCapacity, 0);
  const slotsByProfessional = professionalCapacities.reduce((sum, row) => sum + row.slots, 0);
  const calendarCapacity = professionalCapacities.reduce((sum, row) => sum + row.capacity, 0);

  const closureReasons = [];
  if (blockedDateSet.has(dateKey)) {
    closureReasons.push({ type: 'MANUAL_BLOCK', name: 'Bloqueo de fecha', professionalId: null });
  }
  professionalCapacities.forEach((row) => {
    if (row.isOperational) return;
    row.closureReasons.forEach((entry) => closureReasons.push({
      entryId: entry.id || null,
        type: entry.originalType || entry.type,
        name: entry.name,
        source: entry.source || 'AGENDA_CALENDAR',
        jurisdiction: entry.jurisdiction || null,
        professionalId: entry.professionalId || null,
      }));
  });
  if (professionalCapacities.length === 0) {
    const globalDecision = getProfessionalCalendarDecision(effectiveCalendarEntries, dateKey, null);
    globalDecision.closureReasons.forEach((entry) => closureReasons.push({
      entryId: entry.id || null,
      type: entry.originalType || entry.type,
      name: entry.name,
      source: entry.source || 'AGENDA_CALENDAR',
      jurisdiction: entry.jurisdiction || null,
      professionalId: null,
    }));
  }
  const effectiveCapacity = blockedDateSet.has(dateKey) ? 0 : calendarCapacity;
  const closureReasonKeys = new Set(closureReasons.map((reason) => `${reason.entryId || ''}:${reason.type}:${reason.name}:${reason.professionalId || ''}`));
  const uniqueClosureReasons = closureReasons.filter((reason) => {
    const key = `${reason.entryId || ''}:${reason.type}:${reason.name}:${reason.professionalId || ''}`;
    if (!closureReasonKeys.has(key)) return false;
    closureReasonKeys.delete(key);
    return true;
  });
  const appointmentSummary = summarizeAppointments(
    Array.isArray(appointments) ? appointments : [],
    dateKey,
  );
  const globalCalendarDecision = getProfessionalCalendarDecision(effectiveCalendarEntries, dateKey, null);
  const isBlocked = blockedDateSet.has(dateKey)
    || (effectiveCapacity === 0 && uniqueClosureReasons.length > 0);

  return {
    date: dateKey,
    dayOfWeek: dateObject.getDay(),
    slotDurationMinutes,
    capacityPerSlot,
    theoreticalSlots,
    theoreticalCapacity,
    effectiveCapacity,
    slots: slotsByProfessional,
    capacity: effectiveCapacity,
    capacityByProfessional,
    closureReasons: uniqueClosureReasons,
    isOperational: globalCalendarDecision.isOperational && !blockedDateSet.has(dateKey),
    isClosed: isBlocked,
    holidays: Array.isArray(holidays) ? holidays.filter((holiday) => holiday.date === dateKey) : [],
    calendarEntries: dateCalendarEntries,
    ...appointmentSummary,
    available: Math.max(effectiveCapacity - appointmentSummary.occupied, 0),
    occupancyRate: effectiveCapacity > 0 ? (appointmentSummary.occupied / effectiveCapacity) * 100 : 0,
    isBlocked,
  };
};

export const getCapacityForDate = (options = {}) => getEffectiveCapacityForDate(options);

export const getProfessionalCapacityFromSummary = (summary = {}, professionalId) => {
  if (!professionalId) return 0;

  return (Array.isArray(summary.days) ? summary.days : []).reduce((total, day) => (
    total + (day.capacityByProfessional || [])
      .filter((row) => row.professionalId === professionalId)
      .reduce((dayTotal, row) => dayTotal + row.capacity, 0)
  ), 0);
};

/** startDate is the inclusive first day of the seven-day range; it is not normalized. */
export const getCapacityForWeek = ({
  startDate,
  professionals = [],
  agendaConfig = null,
  appointments = [],
  blockedDates = [],
  calendarEntries = [],
  holidays = [],
} = {}) => {
  const weekStart = toDateObject(startDate);
  weekStart.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, index) => {
    const currentDate = new Date(weekStart);
    currentDate.setDate(weekStart.getDate() + index);

    return getCapacityForDate({
      date: currentDate,
      professionals,
      agendaConfig,
      appointments,
      blockedDates,
      calendarEntries,
      holidays,
    });
  });

  const totalCapacity = days.reduce((sum, day) => sum + day.capacity, 0);
  const theoreticalCapacity = days.reduce((sum, day) => sum + day.theoreticalCapacity, 0);
  const totalOccupied = days.reduce((sum, day) => sum + day.occupied, 0);
  const attendedCount = days.reduce((sum, day) => sum + day.attendedCount, 0);
  const noShowCount = days.reduce((sum, day) => sum + day.noShowCount, 0);
  const resolvedCount = attendedCount + noShowCount;
  const totalAvailable = Math.max(totalCapacity - totalOccupied, 0);

  return {
    startDate: normalizeDateKey(weekStart),
    endDate: normalizeDateKey(days[days.length - 1]?.date || weekStart),
    totalCapacity,
    theoreticalCapacity,
    effectiveCapacity: totalCapacity,
    occupied: totalOccupied,
    reservedCount: totalOccupied,
    scheduledCount: days.reduce((sum, day) => sum + day.scheduledCount, 0),
    attendedCount,
    noShowCount,
    attendanceRate: resolvedCount > 0 ? (attendedCount / resolvedCount) * 100 : 0,
    available: totalAvailable,
    occupancyRate: totalCapacity > 0 ? (totalOccupied / totalCapacity) * 100 : 0,
    days,
  };
};

export const getCapacityForMonth = ({
  year,
  month,
  professionals = [],
  agendaConfig = null,
  appointments = [],
  blockedDates = [],
  calendarEntries = [],
  holidays = [],
} = {}) => {
  const yearValue = Number(year);
  const monthValue = Number(month);
  const computedYear = Number.isFinite(yearValue) ? yearValue : new Date().getFullYear();
  const computedMonth = Number.isFinite(monthValue) ? monthValue : new Date().getMonth() + 1;
  const monthStart = new Date(computedYear, computedMonth - 1, 1);
  const lastDay = new Date(computedYear, computedMonth, 0).getDate();
  const days = Array.from({ length: lastDay }, (_, index) => {
    const currentDate = new Date(computedYear, computedMonth - 1, index + 1);
    return getCapacityForDate({
      date: currentDate,
      professionals,
      agendaConfig,
      appointments,
      blockedDates,
      calendarEntries,
      holidays,
    });
  });

  const totalCapacity = days.reduce((sum, day) => sum + day.capacity, 0);
  const theoreticalCapacity = days.reduce((sum, day) => sum + day.theoreticalCapacity, 0);
  const totalOccupied = days.reduce((sum, day) => sum + day.occupied, 0);
  const attendedCount = days.reduce((sum, day) => sum + day.attendedCount, 0);
  const noShowCount = days.reduce((sum, day) => sum + day.noShowCount, 0);
  const resolvedCount = attendedCount + noShowCount;
  const totalAvailable = Math.max(totalCapacity - totalOccupied, 0);

  return {
    year: computedYear,
    month: computedMonth,
    startDate: normalizeDateKey(monthStart),
    endDate: normalizeDateKey(new Date(computedYear, computedMonth - 1, lastDay)),
    totalCapacity,
    theoreticalCapacity,
    effectiveCapacity: totalCapacity,
    occupied: totalOccupied,
    reservedCount: totalOccupied,
    scheduledCount: days.reduce((sum, day) => sum + day.scheduledCount, 0),
    attendedCount,
    noShowCount,
    attendanceRate: resolvedCount > 0 ? (attendedCount / resolvedCount) * 100 : 0,
    available: totalAvailable,
    occupancyRate: totalCapacity > 0 ? (totalOccupied / totalCapacity) * 100 : 0,
    days,
  };
};

export const calculateOperationalCapacity = ({
  professionals = [],
  agendaConfig = null,
  appointments = null,
  occupiedCount = null,
  totalAvailableMinutes = null,
  referenceDate = new Date(),
  calendarEntries = [],
  holidays = [],
} = {}) => {
  const sessionDurationMinutes = resolveSessionDurationMinutes(agendaConfig);
  const capacityPerSlot = resolveCapacityPerSlot(agendaConfig);
  const reference = toDateObject(referenceDate);
  const weekStart = new Date(reference);
  weekStart.setDate(reference.getDate() - reference.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const weekSummary = getCapacityForWeek({
    startDate: weekStart,
    professionals,
    agendaConfig,
    appointments: Array.isArray(appointments) ? appointments : [],
    calendarEntries,
    holidays,
  });
  const monthSummary = getCapacityForMonth({
    year: reference.getFullYear(),
    month: reference.getMonth() + 1,
    professionals,
    agendaConfig,
    appointments: Array.isArray(appointments) ? appointments : [],
    calendarEntries,
    holidays,
  });

  const professionalRows = professionals.map((professional) => {
    const workSchedule = professional.workSchedule || [];
    const minutesByDay = getScheduleMinutesByDay(workSchedule);
    const totalAvailableMinutes = minutesByDay.reduce((sum, item) => sum + item.minutes, 0);
    return {
      id: professional.id,
      fullName: professional.fullName,
      workSchedule,
      minutesByDay,
      totalAvailableMinutes,
      availableHoursWeekly: totalAvailableMinutes / 60,
      weeklyCapacity: getProfessionalCapacityFromSummary(weekSummary, professional.id),
      monthlyCapacity: getProfessionalCapacityFromSummary(monthSummary, professional.id),
    };
  });

  const resolvedTotalAvailableMinutes = totalAvailableMinutes !== null && totalAvailableMinutes !== undefined
    ? Math.max(0, toNumber(totalAvailableMinutes))
    : professionalRows.reduce((sum, professional) => sum + professional.totalAvailableMinutes, 0);
  const resolvedOccupiedCount = occupiedCount !== null && occupiedCount !== undefined
    ? Math.max(0, toNumber(occupiedCount))
    : monthSummary.occupied;

  const weeklyCapacity = weekSummary.totalCapacity;
  const monthlyCapacity = monthSummary.totalCapacity;
  const occupancyRate = monthlyCapacity > 0 ? (resolvedOccupiedCount / monthlyCapacity) * 100 : 0;
  const freeMonthlyCapacity = Math.max(monthlyCapacity - resolvedOccupiedCount, 0);

  return {
    sessionDurationMinutes,
    configuredSlotDuration: sessionDurationMinutes,
    capacityPerSlot,
    totalAvailableMinutes: resolvedTotalAvailableMinutes,
    totalAvailableMinutesWeekly: resolvedTotalAvailableMinutes,
    availableHoursWeekly: resolvedTotalAvailableMinutes / 60,
    weeklyCapacity,
    monthlyCapacity,
    occupiedCount: resolvedOccupiedCount,
    appointmentsCountUsedForOccupancy: resolvedOccupiedCount,
    reservedCount: resolvedOccupiedCount,
    attendedCount: monthSummary.attendedCount,
    noShowCount: monthSummary.noShowCount,
    attendanceRate: monthSummary.attendanceRate,
    freeMonthlyCapacity,
    occupancyRate,
    professionals: professionalRows,
    debug: {
      workScheduleByProfessional: professionalRows.map((professional) => ({
        professionalId: professional.id,
        professionalName: professional.fullName,
        workSchedule: professional.workSchedule,
        minutesByDay: professional.minutesByDay,
        totalAvailableMinutes: professional.totalAvailableMinutes,
      })),
      totalAvailableMinutes: resolvedTotalAvailableMinutes,
      configuredSlotDuration: sessionDurationMinutes,
      sessionDurationMinutes,
      capacityPerSlot,
      weeklyCapacity,
      monthlyCapacity,
      appointmentsCountUsedForOccupancy: resolvedOccupiedCount,
      attendedCount: monthSummary.attendedCount,
      noShowCount: monthSummary.noShowCount,
      attendanceRate: monthSummary.attendanceRate,
      occupancyRate,
    },
  };
};
