import { startOfWeek, endOfWeek, parseISO } from 'date-fns';

// 1. OBTENER TURNOS DE LA SEMANA
export const getWeekAppointments = async (req, res, prisma) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ message: "Fechas requeridas" });
    
    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T23:59:59Z');
    
    const appointments = await prisma.appointment.findMany({
      where: { date: { gte: start, lte: end } },
      include: { patient: true },
      orderBy: [{ date: 'asc' }, { time: 'asc' }]
    });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: "Error al cargar agenda", error: error.message });
  }
};

// 2. CREAR CITA (CON LÓGICA DE INGRESO Y SLOTS)
export const createAppointment = async (req, res, prisma) => {
  const { patientData, date, time, diagnosis, sessionCount, selectedDays } = req.body;
  if (!patientData || !date || !time) return res.status(400).json({ message: "Datos faltantes" });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const patient = await tx.patient.upsert({
        where: { dni: String(patientData.dni) },
        update: { 
          fullName: patientData.fullName, 
          healthInsurance: patientData.healthInsurance, 
          hasMarcapasos: patientData.hasMarcapasos ?? false, 
          usesEA: patientData.usesEA ?? false 
        },
        create: { 
          dni: String(patientData.dni), 
          fullName: patientData.fullName, 
          healthInsurance: patientData.healthInsurance || 'Particular', 
          hasMarcapasos: patientData.hasMarcapasos ?? false, 
          usesEA: patientData.usesEA ?? false, 
          birthDate: new Date() 
        }
      });

      const prof = await tx.professional.findFirst() || await tx.professional.create({
        data: { fullName: 'Kinesiólogo Principal', licenseNumber: 'MN-1', specialty: 'Kinesiología' }
      });

      const appointmentsCreated = [];
      const numSessions = Math.max(1, parseInt(sessionCount) || 1);
      const [year, month, day] = date.split('-').map(Number);
      let currentDate = new Date(year, month - 1, day, 12, 0, 0);
      const daysToUse = (selectedDays && selectedDays.length > 0) ? selectedDays : [currentDate.getDay()];
      
      let sessionsCreated = 0;
      let loopSafety = 0;
      while (sessionsCreated < numSessions && loopSafety < 150) {
        loopSafety++;
        if (daysToUse.includes(currentDate.getDay())) {
          const occupied = await tx.appointment.findMany({
            where: { 
              date: new Date(currentDate.setHours(12,0,0,0)), 
              time, 
              status: { not: 'CANCELLED' } 
            },
            select: { slotNumber: true }
          });
          const occupiedNumbers = occupied.map(s => s.slotNumber);
          let nextSlot = [1, 2, 3, 4, 5].find(n => !occupiedNumbers.includes(n));

          if (nextSlot) {
            const newApt = await tx.appointment.create({
              data: {
                date: new Date(currentDate),
                time,
                slotNumber: nextSlot,
                diagnosis: diagnosis ? diagnosis.toUpperCase() : null,
                isFirstSession: (sessionsCreated === 0),
                sessionNumber: sessionsCreated + 1,
                patientId: patient.id,
                professionalId: prof.id,
                status: 'SCHEDULED'
              },
              include: { patient: true }
            });
            appointmentsCreated.push(newApt);
            sessionsCreated++;
          }
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      return appointmentsCreated;
    });
    res.status(201).json({ success: true, appointments: result });
  } catch (error) {
    res.status(500).json({ message: "Error al crear", error: error.message });
  }
};

// 3. ACTUALIZAR EVOLUCIÓN, PACIENTE E HISTORIA CLÍNICA (SINCRONIZACIÓN TOTAL)
export const updateEvolution = async (req, res, prisma) => {
  const { id } = req.params;
  const { diagnosis, status, patientData, evolution } = req.body;

  if (!diagnosis && !status && !patientData && !evolution) {
    return res.status(400).json({ message: "No hay datos para actualizar." });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const currentApt = await tx.appointment.findUnique({
        where: { id },
        select: { patientId: true, professionalId: true, diagnosis: true },
      });

      if (!currentApt) throw new Error("Cita no encontrada");

      const updatedApt = await tx.appointment.update({
        where: { id },
        data: {
          ...(diagnosis !== undefined && { diagnosis: diagnosis.toUpperCase() }),
          ...(status !== undefined && { status }),
        },
        include: { patient: true },
      });

      let evolutionForHistory = evolution || '';

      if (patientData) {
        // CORRECCIÓN: Aceptar todos los campos de paciente que vienen del modal
        await tx.patient.update({
          where: { id: currentApt.patientId },
          data: {
            fullName: patientData.fullName || undefined,
            healthInsurance: patientData.healthInsurance || undefined,
            phone: patientData.phone || undefined,
            birthDate: patientData.birthDate ? new Date(patientData.birthDate) : undefined,
            hasCancer: patientData.hasCancer ?? undefined,
            hasMarcapasos: patientData.hasMarcapasos ?? undefined,
            usesEA: patientData.usesEA ?? undefined,
          },
        });

        // Generar nota de sincronización si se actualizaron los booleanos
        const syncNote = `[Sincronización de antecedentes: Oncológico: ${patientData.hasCancer ? "SI" : "NO"}, Marcapasos: ${patientData.hasMarcapasos ? "SI" : "NO"}, EA: ${patientData.usesEA ? "SI" : "NO"}]`;
        evolutionForHistory = evolution ? `${evolution}\n${syncNote}` : syncNote;
      }
      
      if (evolutionForHistory.trim() !== '' || diagnosis) {
        await tx.clinicalHistory.create({
          data: {
            patientId: currentApt.patientId,
            professionalId: currentApt.professionalId,
            diagnosis: diagnosis || currentApt.diagnosis || "EVOLUCIÓN",
            evolution: evolutionForHistory,
            date: new Date(),
          },
        });
      }

      return updatedApt;
    });

    res.json({ success: true, appointment: result });
  } catch (error) {
    console.error("❌ Error en sincronización:", error);
    res.status(500).json({ message: "Error al guardar cambios", error: error.message });
  }
};

// 4. ELIMINAR CITA
export const deleteAppointment = async (req, res, prisma) => {
  try {
    await prisma.appointment.delete({ where: { id: req.params.id } });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar" });
  }
};

// 5. CANCELAR FUTUROS
export const cancelFutureAppointments = async (req, res, prisma) => {
  try {
    const { patientId } = req.params;
    const { fromDate } = req.body;
    const result = await prisma.appointment.deleteMany({
      where: {
        patientId,
        date: { gt: new Date(fromDate) },
        status: { not: 'COMPLETED' }
      }
    });
    res.json({ success: true, count: result.count });
  } catch (error) {
    res.status(500).json({ message: "Error al cancelar" });
  }
};

// 6. OBTENER SESIONES PARA TICKET
export const getAppointmentBatch = async (req, res, prisma) => {
  const { id } = req.params;
  try {
    const ref = await prisma.appointment.findUnique({ where: { id } });
    if (!ref) return res.status(404).json({ message: "Turno no encontrado" });

    const batch = await prisma.appointment.findMany({
      where: {
        patientId: ref.patientId,
        date: { gte: ref.date },
        status: { not: 'CANCELLED' }
      },
      orderBy: { date: 'asc' },
      take: 10
    });
    res.json(batch);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener sesiones para ticket" });
  }
};