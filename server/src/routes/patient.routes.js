import { Router } from 'express';
import { 
  searchPatientByDni, 
  getAllPatients, 
  createPatient, 
  updatePatient, 
  deletePatient, 
  getPatientById,
  getPatientHistoryByDni,
  getFutureAppointments,
  getSessionCycles
} from '../controllers/patient.controller.js';
import { validateBody } from '../middlewares/validate.js';
import { createPatientSchema } from '../schemas/patient.schema.js';

export default function createPatientRoutes(prisma) {
  const router = Router();
  
  // Rutas GET
  router.get('/all', (req, res) => getAllPatients(req, res, prisma));
  router.get('/search', (req, res) => searchPatientByDni(req, res, prisma));
  router.get('/:dni/history', (req, res) => getPatientHistoryByDni(req, res, prisma));
  router.get('/:patientId/future-appointments', (req, res) => getFutureAppointments(req, res, prisma));
  router.get('/:patientId/session-cycles', (req, res) => getSessionCycles(req, res, prisma));
  router.get('/:id', (req, res) => getPatientById(req, res, prisma));
  
  // Rutas POST/DELETE
  router.post('/', validateBody(createPatientSchema), (req, res) => createPatient(req, res, prisma));
  router.delete('/:id', (req, res) => deletePatient(req, res, prisma));
  router.put('/:id', (req, res) => updatePatient(req, res, prisma));
  router.patch('/:id', (req, res) => updatePatient(req, res, prisma));

  return router;
}
