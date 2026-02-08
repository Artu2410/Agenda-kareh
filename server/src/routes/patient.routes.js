import { Router } from 'express';
import { 
  searchPatientByDni, 
  getAllPatients, 
  createPatient, 
  updatePatient, 
  deletePatient, 
  getPatientById,
  getPatientHistoryByDni,
  getFutureAppointments
} from '../controllers/patient.controller.js';

export default function createPatientRoutes(prisma) {
  const router = Router();
  
  // Rutas existentes con controladores
  router.get('/all', (req, res) => getAllPatients(req, res, prisma));
  router.get('/search', (req, res) => searchPatientByDni(req, res, prisma));
  router.get('/:dni/history', (req, res) => getPatientHistoryByDni(req, res, prisma));
  router.get('/:patientId/future-appointments', (req, res) => getFutureAppointments(req, res, prisma));
  router.get('/:id', (req, res) => getPatientById(req, res, prisma));
  router.post('/', (req, res) => createPatient(req, res, prisma));
  router.delete('/:id', (req, res) => deletePatient(req, res, prisma));

  // PUT: Actualización completa del paciente (Sincronizado con ClinicalHistoryPage)
  router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { 
      fullName, dni, birthDate, phone, address, 
      healthInsurance, affiliateNumber, 
      hasMarcapasos, hasCancer, usesEA 
    } = req.body;

    // Normalize birthDate to avoid timezone shifts
    const normalizeBirth = (d) => {
      if (!d) return null;
      try {
        if (typeof d === 'string') {
          const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
          return new Date(d);
        }
        if (d instanceof Date) return d;
        return new Date(d);
      } catch (e) { return null; }
    };

    try {
      const updated = await prisma.patient.update({
        where: { id: id },
        data: {
          fullName,
          dni,
          birthDate: birthDate ? normalizeBirth(birthDate) : null,
          phone,
          address,
          healthInsurance,
          affiliateNumber,
          hasMarcapasos: !!hasMarcapasos,
          hasCancer: !!hasCancer,
          usesEA: !!usesEA
        }
      });
      res.json(updated);
    } catch (error) {
      console.error("ERROR ACTUALIZANDO PACIENTE:", error);
      if (error.code === 'P2025') {
        return res.status(404).json({ message: 'Paciente no encontrado' });
      }
      res.status(500).json({ message: 'Error interno al actualizar paciente' });
    }
  });

  // Mantengo PATCH por si lo usas en otras partes para actualizaciones parciales
  router.patch('/:id', (req, res) => updatePatient(req, res, prisma));

  return router;
}