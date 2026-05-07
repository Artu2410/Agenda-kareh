const DEFAULT_SCHEDULE_BY_DAY = new Map([
  [1, [{ startTime: '14:00', endTime: '19:00' }]],
  [2, [{ startTime: '17:30', endTime: '19:00' }]],
  [3, [{ startTime: '17:30', endTime: '19:00' }]],
  [4, [{ startTime: '17:30', endTime: '19:00' }]],
  [5, [{ startTime: '14:00', endTime: '19:00' }]],
  [6, [{ startTime: '08:00', endTime: '12:00' }]],
]);

const padNumber = (value) => String(value).padStart(2, '0');

const formatLocalDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
};

const parseTimeToMinutes = (value) => {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  return (hours * 60) + minutes;
};

const formatMinutesToTime = (value) => {
  const totalMinutes = Number(value);
  if (!Number.isFinite(totalMinutes)) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${padNumber(hours)}:${padNumber(minutes)}`;
};

const buildLocalDateTime = (date, time) => {
  const minutes = parseTimeToMinutes(time);
  if (!(date instanceof Date) || Number.isNaN(date.getTime()) || minutes === null) return null;
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Math.floor(minutes / 60),
    minutes % 60,
    0,
    0,
  );
};

const getDaySchedules = (professional, dayOfWeek, useFallbackSchedule) => {
  const schedules = Array.isArray(professional?.workSchedule) ? professional.workSchedule : [];
  const matchingSchedules = schedules.filter((item) => Number(item?.dayOfWeek) === Number(dayOfWeek));
  if (matchingSchedules.length > 0) {
    return matchingSchedules;
  }

  if (!useFallbackSchedule) {
    return [];
  }

  return DEFAULT_SCHEDULE_BY_DAY.get(Number(dayOfWeek)) || [];
};

const buildCandidateKey = (dateKey, time) => `${dateKey}|${time}`;
const buildOccupancyKey = (professionalId, dateKey, time) => `${professionalId}|${dateKey}|${time}`;
const RESPIRATORY_SERVICE_KIND = 'respiratorio';

const isRespiratoryServiceKind = (value) => String(value || '').trim().toLowerCase() === RESPIRATORY_SERVICE_KIND;

const isRespiratoryFollowUpAppointment = (appointment) => (
  appointment?.patient?.isRespiratory === true
  && [2, 3].includes(Number(appointment?.sessionNumber))
);

const getRespiratoryIntakeFitRank = (appointments = []) => {
  if (!appointments.length) {
    return 0;
  }

  return appointments.every(isRespiratoryFollowUpAppointment) ? 1 : null;
};

export const getSuggestedWhatsAppSlots = async ({
  prisma,
  maxSlots = 2,
  horizonDays = 10,
  minLeadMinutes = 120,
  minDaysAhead = 1,
  preferLowerOccupancy = true,
  serviceKind = null,
} = {}) => {
  const agendaConfig = await prisma.agendaConfig.findFirst();
  const slotDuration = Math.max(1, Number(agendaConfig?.slotDuration) || 30);
  const capacityPerSlot = Math.max(1, Number(agendaConfig?.capacityPerSlot) || 5);
  const isRespiratoryIntake = isRespiratoryServiceKind(serviceKind);

  const professionals = await prisma.professional.findMany({
    where: {
      isActive: true,
      isArchived: false,
    },
    select: {
      id: true,
      fullName: true,
      workSchedule: {
        select: {
          dayOfWeek: true,
          startTime: true,
          endTime: true,
        },
        orderBy: [
          { dayOfWeek: 'asc' },
          { startTime: 'asc' },
        ],
      },
    },
    orderBy: { fullName: 'asc' },
  });

  if (!professionals.length) {
    return [];
  }

  const useFallbackSchedule = !professionals.some((professional) => (
    Array.isArray(professional.workSchedule) && professional.workSchedule.length > 0
  ));

  const now = new Date();
  const leadTimeMs = Math.max(0, Number(minLeadMinutes) || 0) * 60 * 1000;
  const normalizedMinDaysAhead = Math.max(1, Number(minDaysAhead) || 1);
  const normalizedHorizonDays = Math.max(normalizedMinDaysAhead, Number(horizonDays) || normalizedMinDaysAhead);
  const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const firstEligibleDate = new Date(windowStart);
  firstEligibleDate.setDate(firstEligibleDate.getDate() + normalizedMinDaysAhead);
  const windowEnd = new Date(windowStart);
  windowEnd.setDate(windowEnd.getDate() + normalizedHorizonDays);
  windowEnd.setHours(23, 59, 59, 999);

  const appointments = await prisma.appointment.findMany({
    where: {
      date: {
        gte: firstEligibleDate,
        lte: windowEnd,
      },
      professionalId: { in: professionals.map((professional) => professional.id) },
      status: { not: 'CANCELLED' },
    },
    select: {
      date: true,
      time: true,
      professionalId: true,
      sessionNumber: true,
      patient: {
        select: {
          isRespiratory: true,
        },
      },
    },
  });

  const occupancyBySlot = new Map();
  const appointmentsBySlot = new Map();
  appointments.forEach((appointment) => {
    const dateKey = formatLocalDateKey(appointment.date);
    if (!dateKey || !appointment.time || !appointment.professionalId) return;
    const slotKey = buildOccupancyKey(appointment.professionalId, dateKey, appointment.time);
    occupancyBySlot.set(slotKey, (occupancyBySlot.get(slotKey) || 0) + 1);
    appointmentsBySlot.set(slotKey, [...(appointmentsBySlot.get(slotKey) || []), appointment]);
  });

  const candidateByTime = new Map();

  for (let dayOffset = normalizedMinDaysAhead; dayOffset <= normalizedHorizonDays; dayOffset += 1) {
    const currentDate = new Date(windowStart);
    currentDate.setDate(windowStart.getDate() + dayOffset);
    const dateKey = formatLocalDateKey(currentDate);
    if (!dateKey) continue;

    for (const professional of professionals) {
      const schedules = getDaySchedules(professional, currentDate.getDay(), useFallbackSchedule);
      if (!schedules.length) continue;

      for (const schedule of schedules) {
        const startMinutes = parseTimeToMinutes(schedule.startTime);
        const endMinutes = parseTimeToMinutes(schedule.endTime);
        if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) continue;

        for (let minutes = startMinutes; minutes < endMinutes; minutes += slotDuration) {
          const time = formatMinutesToTime(minutes);
          const startsAt = buildLocalDateTime(currentDate, time);
          if (!time || !startsAt) continue;
          if ((startsAt.getTime() - now.getTime()) < leadTimeMs) continue;

          const occupancy = occupancyBySlot.get(buildOccupancyKey(professional.id, dateKey, time)) || 0;
          if (occupancy >= capacityPerSlot) continue;

          const occupancyKey = buildOccupancyKey(professional.id, dateKey, time);
          const slotAppointments = appointmentsBySlot.get(occupancyKey) || [];
          const respiratoryIntakeFitRank = isRespiratoryIntake
            ? getRespiratoryIntakeFitRank(slotAppointments)
            : 0;
          if (isRespiratoryIntake && respiratoryIntakeFitRank === null) continue;

          const candidateKey = buildCandidateKey(dateKey, time);
          const nextCandidate = {
            date: dateKey,
            time,
            startsAt,
            professionalId: professional.id,
            professionalName: professional.fullName,
            occupancy,
            remainingCapacity: capacityPerSlot - occupancy,
            respiratoryIntakeFitRank,
          };

          const currentCandidate = candidateByTime.get(candidateKey);
          const shouldReplaceCurrentCandidate = !currentCandidate
            || (
              isRespiratoryIntake
              && (
                nextCandidate.respiratoryIntakeFitRank < currentCandidate.respiratoryIntakeFitRank
                || (
                  nextCandidate.respiratoryIntakeFitRank === currentCandidate.respiratoryIntakeFitRank
                  && nextCandidate.occupancy < currentCandidate.occupancy
                )
              )
            )
            || (!isRespiratoryIntake && nextCandidate.occupancy < currentCandidate.occupancy);

          if (shouldReplaceCurrentCandidate) {
            candidateByTime.set(candidateKey, nextCandidate);
          }
        }
      }
    }
  }

  return Array.from(candidateByTime.values())
    .sort((left, right) => {
      if (isRespiratoryIntake && left.respiratoryIntakeFitRank !== right.respiratoryIntakeFitRank) {
        return left.respiratoryIntakeFitRank - right.respiratoryIntakeFitRank;
      }

      const timeDiff = left.startsAt.getTime() - right.startsAt.getTime();
      if (!preferLowerOccupancy || timeDiff !== 0) {
        return timeDiff || left.occupancy - right.occupancy;
      }

      return left.occupancy - right.occupancy || timeDiff;
    })
    .slice(0, Math.max(1, Number(maxSlots) || 1));
};
