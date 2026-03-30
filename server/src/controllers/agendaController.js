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
