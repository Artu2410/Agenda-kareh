import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAllProfessionals = async (req, res) => {
  try {
    const professionals = await prisma.professional.findMany({
      orderBy: { fullName: 'asc' },
    });
    res.status(200).json(professionals);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching professionals', error: error.message });
  }
};

export const createProfessional = async (req, res) => {
  const { fullName, licenseNumber, specialty } = req.body;
  try {
    const newProfessional = await prisma.professional.create({
      data: {
        fullName,
        licenseNumber,
        specialty,
      },
    });
    res.status(201).json(newProfessional);
  } catch (error) {
    res.status(500).json({ message: 'Error creating professional', error: error.message });
  }
};

export const updateProfessional = async (req, res) => {
  const { id } = req.params;
  const { fullName, licenseNumber, specialty, isActive } = req.body;
  try {
    const updatedProfessional = await prisma.professional.update({
      where: { id },
      data: {
        fullName,
        licenseNumber,
        specialty,
        isActive,
      },
    });
    res.status(200).json(updatedProfessional);
  } catch (error) {
    res.status(500).json({ message: `Error updating professional ${id}`, error: error.message });
  }
};

export const getWorkSchedule = async (req, res) => {
  const { id } = req.params;
  try {
    const workSchedule = await prisma.workSchedule.findMany({
      where: { professionalId: id },
      orderBy: { dayOfWeek: 'asc' },
    });
    res.status(200).json(workSchedule);
  } catch (error) {
    res.status(500).json({ message: `Error fetching work schedule for professional ${id}`, error: error.message });
  }
};

export const upsertWorkSchedule = async (req, res) => {
  const { id } = req.params;
  const { schedules } = req.body; // Expecting an array of schedule objects

  try {
    // Use a transaction to ensure all or nothing
    const result = await prisma.$transaction(async (prisma) => {
      // First, delete existing schedules for the professional
      await prisma.workSchedule.deleteMany({
        where: { professionalId: id },
      });

      // Then, create the new schedules
      const createdSchedules = await prisma.workSchedule.createMany({
        data: schedules.map(schedule => ({
          professionalId: id,
          dayOfWeek: schedule.dayOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        })),
      });

      return createdSchedules;
    });

    res.status(201).json({ message: 'Work schedule updated successfully', count: result.count });
  } catch (error) {
    res.status(500).json({ message: `Error updating work schedule for professional ${id}`, error: error.message });
  }
};
