// 1. CREAR ENTRADA EN HISTORIA CLÍNICA
export const createClinicalHistory = async (req, res, prisma) => {
  const { 
    patientId, 
    diagnosis, 
    evolution, 
    medicalConditions, 
    attachments 
  } = req.body;

  try {
    // Validar que el paciente existe antes de operar
    const patientExists = await prisma.patient.findUnique({ 
      where: { id: patientId } 
    });
    
    if (!patientExists) {
      return res.status(404).json({ error: "Paciente no encontrado" });
    }

    // Transacción: Actualiza antecedentes del paciente y crea historia
    const result = await prisma.$transaction(async (tx) => {
      
      if (medicalConditions) {
        await tx.patient.update({
          where: { id: patientId },
          data: {
            hasMarcapasos: medicalConditions.hasMarcapasos ?? false,
            hasCancer: medicalConditions.hasCancer ?? false,
            usesEA: medicalConditions.usesEA ?? false,
            medicalNotes: medicalConditions.other || ""
          },
        });
      }

      const history = await tx.clinicalHistory.create({
        data: {
          patientId: patientId, // Aquí ya no hay error porque ambos son String
          diagnosis: diagnosis || '',
          evolution: evolution || '',
          attachments: JSON.stringify(attachments || []),
          date: new Date(),
        },
      });

      return history;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("❌ Error de Prisma:", error);
    res.status(500).json({ 
      error: 'Error interno al guardar', 
      details: error.message 
    });
  }
};

// 2. OBTENER TODO EL HISTORIAL
export const getHistoryByPatient = async (req, res, prisma) => {
  const { patientId } = req.params;
  try {
    const history = await prisma.clinicalHistory.findMany({
      where: { patientId },
      orderBy: { date: 'desc' }
    });

    const formattedHistory = history.map(entry => ({
      ...entry,
      attachments: entry.attachments ? JSON.parse(entry.attachments) : []
    }));

    res.status(200).json(formattedHistory);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el historial' });
  }
};