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
  
  // Rutas GET
  router.get('/all', (req, res) => getAllPatients(req, res, prisma));
  router.get('/search', (req, res) => searchPatientByDni(req, res, prisma));
  router.get('/:dni/history', (req, res) => getPatientHistoryByDni(req, res, prisma));
  router.get('/:patientId/future-appointments', (req, res) => getFutureAppointments(req, res, prisma));
  router.get('/:id', (req, res) => getPatientById(req, res, prisma));
  
  // Rutas POST/DELETE
  router.post('/', (req, res) => createPatient(req, res, prisma));
  router.delete('/:id', (req, res) => deletePatient(req, res, prisma));

  // PUT: Actualización completa
  router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { 
      fullName, dni, birthDate, phone, address, 
      healthInsurance, affiliateNumber, 
      hasMarcapasos, hasCancer, usesEA 
    } = req.body;

    const normalizeBirth = (d) => {
      if (!d) return null;
      try {
        const date = new Date(d);
        return isNaN(date.getTime()) ? null : date;
      } catch (e) { return null; }
    };

    try {
      const updated = await prisma.patient.update({
        where: { id: id },
        data: {
          fullName,
          dni,
          birthDate: normalizeBirth(birthDate),
          phone,
          address,
          healthInsurance,
          affiliateNumber,
          hasMarcapasos: hasMarcapasos === true || hasMarcapasos === 'true',
          hasCancer: hasCancer === true || hasCancer === 'true',
          usesEA: usesEA === true || usesEA === 'true'
        }
      });
      res.json(updated);
    } catch (error) {
      console.error("ERROR ACTUALIZANDO PACIENTE:", error);
      if (error.code === 'P2025') return res.status(404).json({ message: 'Paciente no encontrado' });
      res.status(500).json({ message: 'Error interno al actualizar paciente' });
    }
  });

  router.patch('/:id', (req, res) => updatePatient(req, res, prisma));

  return router;
}