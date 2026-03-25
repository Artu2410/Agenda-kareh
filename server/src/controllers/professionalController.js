import { getCache, setCache, delCache } from '../services/cache.js';
import {
  professionalSelect,
  professionalWithScheduleSelect,
  workScheduleSelect,
} from '../prisma/selects.js';

const PROFESSIONALS_CACHE_KEY = 'professionals:all';
const PROFESSIONALS_CACHE_TTL_MS = 60_000; // 1 min

const parseOptionalDate = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildProfessionalPayload = (payload) => ({
  fullName: payload.fullName,
  licenseNumber: payload.licenseNumber,
  licenseNumberMP: payload.licenseNumberMP,
  specialty: payload.specialty,
  type: payload.type,
  isActive: payload.isActive,
  isArchived: payload.isArchived,
  dni: payload.dni,
  phone: payload.phone,
  birthDate: parseOptionalDate(payload.birthDate),
  address: payload.address,
  emergencyPhone: payload.emergencyPhone,
  medicalHistory: payload.medicalHistory,
  dniImageUrl: payload.dniImageUrl,
  dniBackImageUrl: payload.dniBackImageUrl,
  licenseMNImageUrl: payload.licenseMNImageUrl,
  licenseMNBackImageUrl: payload.licenseMNBackImageUrl,
  licenseMPImageUrl: payload.licenseMPImageUrl,
  licenseMPBackImageUrl: payload.licenseMPBackImageUrl,
  degreeImageUrl: payload.degreeImageUrl,
  degreeBackImageUrl: payload.degreeBackImageUrl,
  providerRegistryImageUrl: payload.providerRegistryImageUrl,
  malpracticeInsuranceImageUrl: payload.malpracticeInsuranceImageUrl,
});

const omitUndefined = (payload) => Object.fromEntries(
  Object.entries(payload).filter(([, value]) => value !== undefined)
);

export const getAllProfessionals = async (req, res, prisma) => {
  try {
    const cached = getCache(PROFESSIONALS_CACHE_KEY);
    if (cached) {
      return res.status(200).json(cached);
    }

    const professionals = await prisma.professional.findMany({
      orderBy: { fullName: 'asc' },
      select: professionalWithScheduleSelect,
    });

    setCache(PROFESSIONALS_CACHE_KEY, professionals, PROFESSIONALS_CACHE_TTL_MS);
    res.status(200).json(professionals);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching professionals', error: error.message });
  }
};

export const createProfessional = async (req, res, prisma) => {
  const { fullName, licenseNumber } = req.body;
  try {
    if (!fullName || !licenseNumber) {
      return res.status(400).json({ message: 'Nombre completo y matrícula MN son requeridos' });
    }

    const newProfessional = await prisma.professional.create({
      data: {
        ...omitUndefined(buildProfessionalPayload(req.body)),
        type: req.body.type || 'MN',
      },
      select: professionalSelect,
    });

    delCache(PROFESSIONALS_CACHE_KEY);
    res.status(201).json(newProfessional);
  } catch (error) {
    res.status(500).json({ message: 'Error creating professional', error: error.message });
  }
};

export const updateProfessional = async (req, res, prisma) => {
  const { id } = req.params;
  try {
    const updatedProfessional = await prisma.professional.update({
      where: { id },
      data: omitUndefined(buildProfessionalPayload(req.body)),
      select: professionalSelect,
    });

    delCache(PROFESSIONALS_CACHE_KEY);
    res.status(200).json(updatedProfessional);
  } catch (error) {
    res.status(500).json({ message: `Error updating professional ${id}`, error: error.message });
  }
};

export const getWorkSchedule = async (req, res, prisma) => {
  const { id } = req.params;
  try {
    const workSchedule = await prisma.workSchedule.findMany({
      where: { professionalId: id },
      select: workScheduleSelect,
      orderBy: { dayOfWeek: 'asc' },
    });
    res.status(200).json(workSchedule);
  } catch (error) {
    res.status(500).json({ message: `Error fetching work schedule for professional ${id}`, error: error.message });
  }
};

export const archiveProfessional = async (req, res, prisma) => {
  const { id } = req.params;
  const { isArchived } = req.body;
  try {
    const updatedProfessional = await prisma.professional.update({
      where: { id },
      data: {
        isArchived,
        isActive: !isArchived, // Si se archiva, se desactiva automáticamente
      },
      select: professionalSelect,
    });

    delCache(PROFESSIONALS_CACHE_KEY);
    res.status(200).json(updatedProfessional);
  } catch (error) {
    res.status(500).json({ message: `Error archiving professional ${id}`, error: error.message });
  }
};

export const deleteProfessional = async (req, res, prisma) => {
  const { id } = req.params;
  try {
    // Verificar si tiene relaciones activas
    const professional = await prisma.professional.findUnique({
      where: { id },
      select: {
        id: true,
        appointments: {
          where: { status: { not: 'CANCELLED' } },
          take: 1,
          select: { id: true },
        },
        clinicalHistories: {
          take: 1,
          select: { id: true },
        },
        workSchedule: {
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!professional) {
      return res.status(404).json({ message: 'Profesional no encontrado' });
    }

    if (professional.appointments.length > 0) {
      return res.status(400).json({
        message: 'No se puede eliminar el profesional porque tiene turnos activos'
      });
    }

    if (professional.clinicalHistories.length > 0) {
      return res.status(400).json({
        message: 'No se puede eliminar el profesional porque tiene historias clínicas registradas'
      });
    }

    // Eliminar horarios de trabajo primero
    await prisma.workSchedule.deleteMany({
      where: { professionalId: id },
    });

    // Eliminar profesional
    await prisma.professional.delete({
      where: { id },
    });

    delCache(PROFESSIONALS_CACHE_KEY);
    res.status(200).json({ message: 'Profesional eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ message: `Error deleting professional ${id}`, error: error.message });
  }
};

export const upsertWorkSchedule = async (req, res, prisma) => {
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
