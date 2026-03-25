export const getAgendaConfig = async (req, res, prisma) => {
  try {
    // Asumimos que hay una sola config global
    const config = await prisma.agendaConfig.findFirst();
    if (!config) {
      // Crear config por defecto si no existe
      const defaultConfig = await prisma.agendaConfig.create({
        data: {
          weekdayStartTime: '08:00',
          weekdayEndTime: '18:00',
          saturdayEnabled: false,
          saturdayStartTime: null,
          saturdayEndTime: null,
          slotDuration: 30,
          capacityPerSlot: 5,
        },
      });
      return res.status(200).json(defaultConfig);
    }
    res.status(200).json(config);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching agenda config', error: error.message });
  }
};

export const updateAgendaConfig = async (req, res, prisma) => {
  const {
    weekdayStartTime,
    weekdayEndTime,
    saturdayEnabled,
    saturdayStartTime,
    saturdayEndTime,
    slotDuration,
    capacityPerSlot,
  } = req.body;

  try {
    // Asumimos que hay una sola config global
    const existingConfig = await prisma.agendaConfig.findFirst();
    if (!existingConfig) {
      const newConfig = await prisma.agendaConfig.create({
        data: {
          weekdayStartTime: weekdayStartTime || '08:00',
          weekdayEndTime: weekdayEndTime || '18:00',
          saturdayEnabled: saturdayEnabled ?? false,
          saturdayStartTime,
          saturdayEndTime,
          slotDuration: slotDuration || 30,
          capacityPerSlot: capacityPerSlot || 5,
        },
      });
      return res.status(201).json(newConfig);
    }

    const updatedConfig = await prisma.agendaConfig.update({
      where: { id: existingConfig.id },
      data: {
        weekdayStartTime,
        weekdayEndTime,
        saturdayEnabled,
        saturdayStartTime,
        saturdayEndTime,
        slotDuration,
        capacityPerSlot,
      },
    });
    res.status(200).json(updatedConfig);
  } catch (error) {
    res.status(500).json({ message: 'Error updating agenda config', error: error.message });
  }
};
