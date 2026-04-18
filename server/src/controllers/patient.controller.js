// Helper para parsear fechas evitando corrimientos por zona horaria (mediodía local)
import {
  appointmentBaseSelect,
  patientIdSelect,
  patientSelect,
  patientWithAppointmentCountSelect,
  professionalSelect,
} from '../prisma/selects.js';

const parseDateAvoidTZ = (d) => {
  if (!d) return null;
  try {
    if (typeof d === 'string') {
      const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
      return new Date(d);
    }
    if (d instanceof Date) return d;
    return new Date(d);
  } catch (e) {
    return null;
  }
};

const UNKNOWN_BIRTHDATE = new Date(1900, 0, 1, 12, 0, 0);

const normalizeBirthDateOrUnknown = (d) => {
  if (!d) return UNKNOWN_BIRTHDATE;
  const parsed = parseDateAvoidTZ(d);
  return parsed || UNKNOWN_BIRTHDATE;
};

export const searchPatientByDni = async (req, res, prisma) => {
  const { dni } = req.query;
  if (!dni) return res.status(400).json({ error: 'DNI es requerido' });

  try {
    const patient = await prisma.patient.findUnique({
      where: { dni: dni.toString() },
      select: {
        ...patientSelect,
        appointments: {
          orderBy: { date: 'desc' },
          take: 5,
          select: {
            ...appointmentBaseSelect,
            professional: {
              select: professionalSelect,
            },
          },
        },
      },
    });
    if (!patient) return res.status(200).json(null);
    res.status(200).json(patient);
  } catch (error) {
    console.error('❌ Error en searchPatientByDni:', error);
    res.status(500).json({ error: 'Error al buscar paciente', message: error.message });
  }
};

export const getAllPatients = async (req, res, prisma) => {
  try {
    const patients = await prisma.patient.findMany({
      select: patientWithAppointmentCountSelect,
      orderBy: { fullName: 'asc' }
    });
    res.status(200).json(patients);
  } catch (error) {
    console.error('❌ Error en getAllPatients:', error);
    res.status(500).json({ error: 'Error al obtener los pacientes', message: error.message });
  }
};

export const createPatient = async (req, res, prisma) => {
  const {
    fullName,
    dni,
    phone,
    email,
    address,
    birthDate,
    healthInsurance,
    treatAsParticular,
    affiliateNumber,
    emergencyPhone,
    medicalHistory,
    dniImageUrl,
    dniBackImageUrl,
    insuranceCardImageUrl,
    insuranceCardBackImageUrl,
    hasCancer,
    hasMarcapasos,
    usesEA,
    medicalNotes,
  } = req.body;
  try {
    if (!fullName || !dni) return res.status(400).json({ message: 'Nombre y DNI son requeridos' });

    const existingPatient = await prisma.patient.findUnique({
      where: { dni },
      select: patientIdSelect,
    });
    if (existingPatient) return res.status(400).json({ message: 'El DNI ya existe' });

    const patient = await prisma.patient.create({
      data: {
        fullName, dni, phone, email, address,
        birthDate: normalizeBirthDateOrUnknown(birthDate),
        healthInsurance,
        treatAsParticular: !!treatAsParticular,
        affiliateNumber,
        emergencyPhone,
        medicalHistory,
        dniImageUrl,
        dniBackImageUrl,
        insuranceCardImageUrl,
        insuranceCardBackImageUrl,
        hasCancer: !!hasCancer,
        hasMarcapasos: !!hasMarcapasos,
        usesEA: !!usesEA,
        medicalNotes,
      },
      select: patientWithAppointmentCountSelect,
    });
    res.status(201).json(patient);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear paciente', message: error.message });
  }
};

export const updatePatient = async (req, res, prisma) => {
  const { id } = req.params;
  // EXPANDIR PARA INCLUIR TODOS LOS CAMPOS SINCRONIZABLES
  const { 
    fullName, dni, phone, email, address, birthDate, healthInsurance,
    treatAsParticular, affiliateNumber, emergencyPhone, medicalHistory, hasMarcapasos, usesEA, hasCancer, medicalNotes,
    dniImageUrl, dniBackImageUrl, insuranceCardImageUrl, insuranceCardBackImageUrl,
  } = req.body;

  try {
    if (dni) {
      const existing = await prisma.patient.findUnique({
        where: { dni },
        select: patientIdSelect,
      });
      if (existing && existing.id !== id) return res.status(400).json({ message: 'DNI ya en uso' });
    }
    const patient = await prisma.patient.update({
      where: { id },
      data: {
        fullName, dni, phone, email, address,
        birthDate: birthDate ? normalizeBirthDateOrUnknown(birthDate) : undefined,
        healthInsurance,
        treatAsParticular,
        affiliateNumber,
        emergencyPhone,
        medicalHistory,
        dniImageUrl,
        dniBackImageUrl,
        insuranceCardImageUrl,
        insuranceCardBackImageUrl,
        // AÑADIR CAMPOS MÉDICOS A LA ACTUALIZACIÓN
        hasMarcapasos,
        usesEA,
        hasCancer,
        medicalNotes
      },
      select: patientWithAppointmentCountSelect,
    });
    res.status(200).json(patient);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar', message: error.message });
  }
};

export const deletePatient = async (req, res, prisma) => {
  const { id } = req.params;
  try {
    const appointmentCount = await prisma.appointment.count({ where: { patientId: id } });
    if (appointmentCount > 0) {
      return res.status(400).json({ message: `No se puede eliminar: tiene ${appointmentCount} cita(s)` });
    }
    await prisma.patient.delete({ where: { id } });
    res.status(200).json({ message: 'Eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar', message: error.message });
  }
};

export const getPatientById = async (req, res, prisma) => {
  const { id } = req.params;
  try {
    const patient = await prisma.patient.findUnique({
      where: { id },
      select: {
        ...patientSelect,
        appointments: {
          orderBy: { date: 'desc' },
          select: {
            ...appointmentBaseSelect,
            professional: {
              select: professionalSelect,
            },
          },
        },
      },
    });
    if (!patient) return res.status(404).json({ message: 'No encontrado' });
    res.status(200).json(patient);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener', message: error.message });
  }
};

// --- FUNCIÓN ADICIONAL PARA HISTORIAL (REQUERIDA POR TUS RUTAS) ---
export const getPatientHistoryByDni = async (req, res, prisma) => {
  const { dni } = req.params;
  try {
    const patient = await prisma.patient.findUnique({
      where: { dni: dni.toString() },
      select: {
        ...patientSelect,
        appointments: {
          orderBy: { date: 'desc' },
          select: {
            ...appointmentBaseSelect,
            professional: {
              select: professionalSelect,
            },
          },
        },
      },
    });
    if (!patient) return res.status(404).json({ message: 'Historial no encontrado' });
    res.status(200).json(patient);
  } catch (error) {
    console.error('❌ Error en getPatientHistoryByDni:', error);
    res.status(500).json({ error: 'Error al obtener historial', message: error.message });
  }
};

export const getFutureAppointments = async (req, res, prisma) => {
  const { patientId } = req.params;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const appointments = await prisma.appointment.findMany({
      where: {
        patientId: patientId,
        date: {
          gte: today,
        },
      },
      select: appointmentBaseSelect,
      orderBy: [
        { date: 'asc' },
        { time: 'asc' },
        { slotNumber: 'asc' },
      ],
    });
    res.status(200).json(appointments);
  } catch (error) {
    console.error('❌ Error in getFutureAppointments:', error);
    res.status(500).json({ error: 'Error fetching future appointments', message: error.message });
  }
};

// Devuelve ciclos de sesiones completadas por anio para control de obra social
export const getSessionCycles = async (req, res, prisma) => {
  const { patientId } = req.params;
  try {
    const completedAppointments = await prisma.appointment.findMany({
      where: { patientId, status: 'COMPLETED' },
      orderBy: [{ date: 'asc' }],
      select: { id: true, date: true, diagnosis: true },
    });

    const byYear = {};
    for (const apt of completedAppointments) {
      const year = new Date(apt.date).getFullYear();
      if (!byYear[year]) byYear[year] = [];
      byYear[year].push(apt);
    }

    const result = Object.entries(byYear)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([year, apts]) => {
        const totalCompleted = apts.length;
        const completedCycles = Math.floor(totalCompleted / 10);
        const sessionsInCurrentCycle = totalCompleted % 10;
        return {
          year: Number(year),
          totalCompleted,
          completedCycles,
          sessionsInCurrentCycle,
          cycles: Array.from({ length: completedCycles }, (_, i) => ({
            cycleNumber: i + 1,
            from: apts[i * 10]?.date,
            to: apts[i * 10 + 9]?.date,
          })),
          currentCycleStart: completedCycles * 10 < totalCompleted
            ? apts[completedCycles * 10]?.date
            : null,
        };
      });

    res.status(200).json(result);
  } catch (error) {
    console.error('Error in getSessionCycles:', error);
    res.status(500).json({ error: 'Error fetching session cycles', message: error.message });
  }
};
