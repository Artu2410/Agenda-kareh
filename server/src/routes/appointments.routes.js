import { Router } from 'express';
import {
  getWeekAppointments,
  createAppointment, 
  updateAppointment,
  deleteAppointment, 
  updateEvolution, 
  cancelFutureAppointments,
  getAppointmentBatch,
  getAppointmentAuthorizations,
  reviewAppointmentAuthorization
} from '../controllers/AppointmentController.js';
import { checkRole } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import {
  appointmentIdParamsSchema,
  appointmentWeekQuerySchema,
  createAppointmentBodySchema,
  updateAppointmentBodySchema,
  updateAppointmentEvolutionBodySchema,
} from '../validations/appointmentSchemas.js';

const createRouter = (prisma) => {
  const router = Router();

  // 1. Obtener turnos de la semana
  router.get('/week', validate({ query: appointmentWeekQuerySchema }), (req, res) => getWeekAppointments(req, res, prisma));

  // 2. Ticket: Obtener lote de 10 sesiones
  router.get('/:id/batch', (req, res) => getAppointmentBatch(req, res, prisma));

  // 2a. Autorizaciones pendientes / resueltas
  router.get('/authorizations/list', checkRole('SUPER_USER', 'ADMIN'), (req, res) => getAppointmentAuthorizations(req, res, prisma));
  router.patch('/:id/authorization', checkRole('SUPER_USER', 'ADMIN'), (req, res) => reviewAppointmentAuthorization(req, res, prisma));

  // 3. Crear citas (Ciclo completo)
  router.post('/', validate({ body: createAppointmentBodySchema }), (req, res) => createAppointment(req, res, prisma));

  // 4. Actualizar cita y datos del paciente
  router.put('/:id', validate({ params: appointmentIdParamsSchema, body: updateAppointmentBodySchema }), (req, res) => updateAppointment(req, res, prisma));

  // 5. Actualizar evolución (Sincronización total con Paciente e Historia)
  router.patch('/:id/evolution', validate({ params: appointmentIdParamsSchema, body: updateAppointmentEvolutionBodySchema }), (req, res) => updateEvolution(req, res, prisma));

  // 6. Eliminar cita única
  router.delete('/:id', (req, res) => deleteAppointment(req, res, prisma));

  // 7. Cancelar sesiones futuras de un paciente
  router.post('/patients/:patientId/cancel-future', (req, res) => cancelFutureAppointments(req, res, prisma));

  return router;
};

export default createRouter;
