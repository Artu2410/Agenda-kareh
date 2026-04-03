const DEFAULT_AGENDA_CONFIG = {
  weekdayStartTime: '08:00',
  weekdayEndTime: '18:00',
  saturdayEnabled: false,
  saturdayStartTime: null,
  saturdayEndTime: null,
  slotDuration: 30,
  capacityPerSlot: 5,
  timerDurationMinutes: 25,
  timerDurations: [],
};

const TIMER_STATUSES = {
  IDLE: 'idle',
  ACTIVE: 'active',
  PAUSED: 'paused',
  FINISHED: 'finished',
};

const normalizeTimerDate = (value) => (
  /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim()) ? String(value).trim() : null
);

const normalizeSlotTime = (value) => (
  /^\d{2}:\d{2}$/.test(String(value || '').trim()) ? String(value).trim() : null
);

const toPositiveInteger = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.trunc(parsed));
};

const normalizeTimerRecord = (record, defaultDurationSeconds, now = new Date()) => {
  const durationSeconds = Math.max(1, toPositiveInteger(record?.durationSeconds, defaultDurationSeconds));
  const endsAt = record?.endsAt ? new Date(record.endsAt) : null;
  const finishedAt = record?.finishedAt ? new Date(record.finishedAt) : null;
  const updatedAt = record?.updatedAt ? new Date(record.updatedAt) : null;
  const status = String(record?.status || TIMER_STATUSES.IDLE);

  if (status === TIMER_STATUSES.ACTIVE && endsAt && !Number.isNaN(endsAt.getTime())) {
    const remainingSeconds = Math.ceil((endsAt.getTime() - now.getTime()) / 1000);
    if (remainingSeconds > 0) {
      return {
        ...record,
        durationSeconds,
        remainingSeconds,
        status: TIMER_STATUSES.ACTIVE,
        endsAt,
        finishedAt: null,
        updatedAt,
      };
    }

    const normalizedFinishedAt = finishedAt && !Number.isNaN(finishedAt.getTime()) ? finishedAt : endsAt;
    const overtimeSeconds = Math.max(0, Math.floor((now.getTime() - normalizedFinishedAt.getTime()) / 1000));
    return {
      ...record,
      durationSeconds,
      remainingSeconds: overtimeSeconds === 0 ? 0 : -overtimeSeconds,
      status: TIMER_STATUSES.FINISHED,
      endsAt: null,
      finishedAt: normalizedFinishedAt,
      updatedAt,
    };
  }

  if (status === TIMER_STATUSES.FINISHED) {
    const normalizedFinishedAt = finishedAt && !Number.isNaN(finishedAt.getTime()) ? finishedAt : updatedAt || now;
    const overtimeSeconds = Math.max(0, Math.floor((now.getTime() - normalizedFinishedAt.getTime()) / 1000));
    return {
      ...record,
      durationSeconds,
      remainingSeconds: overtimeSeconds === 0 ? 0 : -overtimeSeconds,
      status: TIMER_STATUSES.FINISHED,
      endsAt: null,
      finishedAt: normalizedFinishedAt,
      updatedAt,
    };
  }

  if (status === TIMER_STATUSES.PAUSED) {
    return {
      ...record,
      durationSeconds,
      remainingSeconds: Math.max(0, toPositiveInteger(record?.remainingSeconds, durationSeconds)),
      status: TIMER_STATUSES.PAUSED,
      endsAt: null,
      finishedAt: null,
      updatedAt,
    };
  }

  return {
    ...record,
    durationSeconds,
    remainingSeconds: durationSeconds,
    status: TIMER_STATUSES.IDLE,
    endsAt: null,
    finishedAt: null,
    updatedAt,
  };
};

const serializeTimerRecord = (record) => ({
  id: record?.id || null,
  timerDate: record?.timerDate || null,
  slotTime: record?.slotTime || null,
  slotNumber: Number(record?.slotNumber) || 0,
  status: record?.status || TIMER_STATUSES.IDLE,
  durationSeconds: Math.max(1, toPositiveInteger(record?.durationSeconds, 1)),
  remainingSeconds: Number.isFinite(Number(record?.remainingSeconds)) ? Math.trunc(Number(record.remainingSeconds)) : 0,
  endsAt: record?.endsAt ? new Date(record.endsAt).toISOString() : null,
  finishedAt: record?.finishedAt ? new Date(record.finishedAt).toISOString() : null,
  updatedAt: record?.updatedAt ? new Date(record.updatedAt).toISOString() : null,
});

const toOptionalInteger = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.trunc(parsed);
};

const buildAgendaConfigData = (input = {}) => {
  const data = {};

  if (input.weekdayStartTime !== undefined) data.weekdayStartTime = input.weekdayStartTime;
  if (input.weekdayEndTime !== undefined) data.weekdayEndTime = input.weekdayEndTime;
  if (input.saturdayEnabled !== undefined) data.saturdayEnabled = input.saturdayEnabled;
  if (input.saturdayStartTime !== undefined) data.saturdayStartTime = input.saturdayStartTime;
  if (input.saturdayEndTime !== undefined) data.saturdayEndTime = input.saturdayEndTime;

  const slotDuration = toOptionalInteger(input.slotDuration);
  if (slotDuration !== undefined) data.slotDuration = Math.max(1, slotDuration);

  const capacityPerSlot = toOptionalInteger(input.capacityPerSlot);
  if (capacityPerSlot !== undefined) data.capacityPerSlot = Math.max(1, capacityPerSlot);

  const timerDurationMinutes = toOptionalInteger(input.timerDurationMinutes);
  if (timerDurationMinutes !== undefined) data.timerDurationMinutes = Math.max(1, timerDurationMinutes);

  if (input.timerDurations !== undefined) {
    const rawDurations = Array.isArray(input.timerDurations) ? input.timerDurations : [];
    data.timerDurations = rawDurations
      .map((value) => toOptionalInteger(value))
      .filter((value) => value !== undefined)
      .map((value) => Math.max(1, value));
  }

  return data;
};

export const getAgendaConfig = async (req, res, prisma) => {
  try {
    // Asumimos que hay una sola config global
    const config = await prisma.agendaConfig.findFirst();
    if (!config) {
      // Crear config por defecto si no existe
      const defaultConfig = await prisma.agendaConfig.create({
        data: DEFAULT_AGENDA_CONFIG,
      });
      return res.status(200).json(defaultConfig);
    }
    res.status(200).json(config);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching agenda config', error: error.message });
  }
};

export const updateAgendaConfig = async (req, res, prisma) => {
  try {
    const updates = buildAgendaConfigData(req.body);

    // Asumimos que hay una sola config global
    const existingConfig = await prisma.agendaConfig.findFirst();
    if (!existingConfig) {
      const newConfig = await prisma.agendaConfig.create({
        data: {
          ...DEFAULT_AGENDA_CONFIG,
          ...updates,
        },
      });
      return res.status(201).json(newConfig);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(200).json(existingConfig);
    }

    const updatedConfig = await prisma.agendaConfig.update({
      where: { id: existingConfig.id },
      data: updates,
    });
    res.status(200).json(updatedConfig);
  } catch (error) {
    res.status(500).json({ message: 'Error updating agenda config', error: error.message });
  }
};

export const getAgendaTimers = async (req, res, prisma) => {
  const timerDate = normalizeTimerDate(req.query?.timerDate);
  const slotTime = normalizeSlotTime(req.query?.slotTime);

  if (!timerDate || !slotTime) {
    return res.status(400).json({ message: 'timerDate y slotTime son requeridos.' });
  }

  try {
    const now = new Date();
    const rows = await prisma.agendaTimerState.findMany({
      where: { timerDate, slotTime },
      orderBy: { slotNumber: 'asc' },
    });

    const timers = rows.map((row) => serializeTimerRecord(
      normalizeTimerRecord(row, row.durationSeconds, now),
    ));

    return res.json({ timers });
  } catch (error) {
    console.error('ERROR OBTENIENDO CRONOMETROS:', error);
    return res.status(500).json({ message: 'No se pudieron cargar los cronómetros.' });
  }
};

export const toggleAgendaTimer = async (req, res, prisma) => {
  const timerDate = normalizeTimerDate(req.body?.timerDate);
  const slotTime = normalizeSlotTime(req.body?.slotTime);
  const slotNumber = Math.max(1, toPositiveInteger(req.body?.slotNumber, 0));
  const defaultDurationSeconds = Math.max(1, toPositiveInteger(req.body?.defaultDurationSeconds, 0));

  if (!timerDate || !slotTime || !slotNumber || !defaultDurationSeconds) {
    return res.status(400).json({ message: 'timerDate, slotTime, slotNumber y defaultDurationSeconds son requeridos.' });
  }

  try {
    const now = new Date();
    const existing = await prisma.agendaTimerState.findUnique({
      where: {
        timerDate_slotTime_slotNumber: {
          timerDate,
          slotTime,
          slotNumber,
        },
      },
    });

    const normalizedExisting = normalizeTimerRecord(existing, defaultDurationSeconds, now);
    let nextData;

    if (normalizedExisting.status === TIMER_STATUSES.ACTIVE) {
      nextData = {
        timerDate,
        slotTime,
        slotNumber,
        status: TIMER_STATUSES.PAUSED,
        durationSeconds: normalizedExisting.durationSeconds,
        remainingSeconds: Math.max(0, normalizedExisting.remainingSeconds),
        endsAt: null,
        finishedAt: null,
      };
    } else {
      const restartDurationSeconds = normalizedExisting.status === TIMER_STATUSES.PAUSED
        ? Math.max(1, normalizedExisting.remainingSeconds)
        : defaultDurationSeconds;

      nextData = {
        timerDate,
        slotTime,
        slotNumber,
        status: TIMER_STATUSES.ACTIVE,
        durationSeconds: defaultDurationSeconds,
        remainingSeconds: restartDurationSeconds,
        endsAt: new Date(now.getTime() + (restartDurationSeconds * 1000)),
        finishedAt: null,
      };
    }

    const saved = await prisma.agendaTimerState.upsert({
      where: {
        timerDate_slotTime_slotNumber: {
          timerDate,
          slotTime,
          slotNumber,
        },
      },
      update: nextData,
      create: nextData,
    });

    const timer = serializeTimerRecord(normalizeTimerRecord(saved, defaultDurationSeconds, now));
    return res.json({ timer });
  } catch (error) {
    console.error('ERROR ACTUALIZANDO CRONOMETRO:', error);
    return res.status(500).json({ message: 'No se pudo actualizar el cronómetro.' });
  }
};
