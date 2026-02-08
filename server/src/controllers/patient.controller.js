// Helper para parsear fechas evitando corrimientos por zona horaria (mediodía local)
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

export const searchPatientByDni = async (req, res, prisma) => {
  const { dni } = req.query;
  if (!dni) return res.status(400).json({ error: 'DNI es requerido' });

  try {
    const patient = await prisma.patient.findUnique({
      where: { dni: dni.toString() },
      include: {
        appointments: {
          orderBy: { date: 'desc' },
          take: 5,
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
      include: {
        _count: { select: { appointments: true } },
      },
      orderBy: { fullName: 'asc' }
    });
    res.status(200).json(patients);
  } catch (error) {
    console.error('❌ Error en getAllPatients:', error);
    res.status(500).json({ error: 'Error al obtener los pacientes', message: error.message });
  }
};

export const createPatient = async (req, res, prisma) => {
  const { fullName, dni, phone, email, address, birthDate, healthInsurance } = req.body;
  try {
    if (!fullName || !dni) return res.status(400).json({ message: 'Nombre y DNI son requeridos' });

    const existingPatient = await prisma.patient.findUnique({ where: { dni } });
    if (existingPatient) return res.status(400).json({ message: 'El DNI ya existe' });

    const patient = await prisma.patient.create({
      data: {
        fullName, dni, phone, email, address,
        birthDate: birthDate ? parseDateAvoidTZ(birthDate) : null,
        healthInsurance,
      },
      include: { _count: { select: { appointments: true } } },
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
    hasMarcapasos, usesEA, hasCancer, medicalNotes 
  } = req.body;

  try {
    if (dni) {
      const existing = await prisma.patient.findUnique({ where: { dni } });
      if (existing && existing.id !== id) return res.status(400).json({ message: 'DNI ya en uso' });
    }
    const patient = await prisma.patient.update({
      where: { id },
      data: {
        fullName, dni, phone, email, address,
        birthDate: birthDate ? parseDateAvoidTZ(birthDate) : undefined,
        healthInsurance,
        // AÑADIR CAMPOS MÉDICOS A LA ACTUALIZACIÓN
        hasMarcapasos,
        usesEA,
        hasCancer,
        medicalNotes
      },
      include: { _count: { select: { appointments: true } } },
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
      include: {
        appointments: {
          orderBy: { date: 'desc' },
          include: { professional: true },
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
      include: {
        appointments: {
          orderBy: { date: 'desc' },
          include: { professional: true },
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
      orderBy: {
        date: 'asc',
      },
    });
    res.status(200).json(appointments);
  } catch (error) {
    console.error('❌ Error in getFutureAppointments:', error);
    res.status(500).json({ error: 'Error fetching future appointments', message: error.message });
  }
};