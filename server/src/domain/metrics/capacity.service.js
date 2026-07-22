export const MONTHLY_WEEK_FACTOR = 4.33;

const DEFAULT_AGENDA_CONFIG = {
  slotDuration: 30,
  timerDurationMinutes: 25,
  capacityPerSlot: 1,
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
  const config = agendaConfig || DEFAULT_AGENDA_CONFIG;
  return Math.max(1, Number(config.slotDuration || config.timerDurationMinutes || 30));
};

const resolveCapacityPerSlot = (agendaConfig = null) => {
  const config = agendaConfig || DEFAULT_AGENDA_CONFIG;
  return Math.max(1, Number(config.capacityPerSlot || 1));
};

const countActiveAppointments = (appointments = []) => (
  appointments.filter((appointment) => appointment.status !== 'CANCELLED').length
);

export const calculateOperationalCapacity = ({
  professionals = [],
  agendaConfig = null,
  appointments = null,
  occupiedCount = null,
  totalAvailableMinutes = null,
} = {}) => {
  const sessionDurationMinutes = resolveSessionDurationMinutes(agendaConfig);
  const capacityPerSlot = resolveCapacityPerSlot(agendaConfig);
  const professionalRows = professionals.map((professional) => {
    const workSchedule = professional.workSchedule || [];
    const minutesByDay = getScheduleMinutesByDay(workSchedule);
    const totalAvailableMinutes = minutesByDay.reduce((sum, item) => sum + item.minutes, 0);
    const weeklyCapacity = sessionDurationMinutes > 0
      ? totalAvailableMinutes / sessionDurationMinutes
      : 0;
    const monthlyCapacity = weeklyCapacity * MONTHLY_WEEK_FACTOR;

    return {
      id: professional.id,
      fullName: professional.fullName,
      workSchedule,
      minutesByDay,
      totalAvailableMinutes,
      availableHoursWeekly: totalAvailableMinutes / 60,
      weeklyCapacity,
      monthlyCapacity,
    };
  });

  const resolvedTotalAvailableMinutes = totalAvailableMinutes !== null && totalAvailableMinutes !== undefined
    ? Math.max(0, toNumber(totalAvailableMinutes))
    : professionalRows.reduce(
      (sum, professional) => sum + professional.totalAvailableMinutes,
      0
    );
  const weeklyCapacity = sessionDurationMinutes > 0
    ? resolvedTotalAvailableMinutes / sessionDurationMinutes
    : 0;
  const monthlyCapacity = weeklyCapacity * MONTHLY_WEEK_FACTOR;
  const resolvedOccupiedCount = occupiedCount !== null && occupiedCount !== undefined
    ? Math.max(0, toNumber(occupiedCount))
    : countActiveAppointments(Array.isArray(appointments) ? appointments : []);
  const occupancyRate = monthlyCapacity > 0
    ? (resolvedOccupiedCount / monthlyCapacity) * 100
    : 0;
  const freeMonthlyCapacity = Math.max(monthlyCapacity - resolvedOccupiedCount, 0);

  return {
    sessionDurationMinutes,
    configuredSlotDuration: sessionDurationMinutes,
    capacityPerSlot,
    monthlyWeekFactor: MONTHLY_WEEK_FACTOR,
    totalAvailableMinutes: resolvedTotalAvailableMinutes,
    totalAvailableMinutesWeekly: resolvedTotalAvailableMinutes,
    availableHoursWeekly: resolvedTotalAvailableMinutes / 60,
    weeklyCapacity,
    monthlyCapacity,
    occupiedCount: resolvedOccupiedCount,
    appointmentsCountUsedForOccupancy: resolvedOccupiedCount,
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
      occupancyRate,
    },
  };
};
