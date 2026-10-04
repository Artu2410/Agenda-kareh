import { Router } from 'express';
import {
  getAgendaConfig,
  getAgendaTimers,
  toggleAgendaTimer,
  resetAgendaTimer,
  updateAgendaConfig,
} from '../controllers/agendaController.js';
import {
  createAgendaCalendarEntry,
  deleteAgendaCalendarEntry,
  listAgendaCalendarEntries,
  updateAgendaCalendarEntry,
} from '../controllers/agendaCalendar.controller.js';
import { checkRole } from '../middlewares/authMiddleware.js';

const createRouter = (prisma) => {
  const router = Router();

  // Obtener configuración de agenda
  router.get('/config', (req, res) => getAgendaConfig(req, res, prisma));

  // Actualizar configuración de agenda
  router.put('/config', checkRole('SUPER_USER', 'ADMIN'), (req, res) => updateAgendaConfig(req, res, prisma));

  router.get('/calendar-entries', (req, res) => listAgendaCalendarEntries(req, res, prisma));
  router.post('/calendar-entries', checkRole('SUPER_USER', 'ADMIN'), (req, res) => createAgendaCalendarEntry(req, res, prisma));
  router.put('/calendar-entries/:id', checkRole('SUPER_USER', 'ADMIN'), (req, res) => updateAgendaCalendarEntry(req, res, prisma));
  router.delete('/calendar-entries/:id', checkRole('SUPER_USER', 'ADMIN'), (req, res) => deleteAgendaCalendarEntry(req, res, prisma));

  // Obtener cronómetros del bloque horario activo
  router.get('/timers', (req, res) => getAgendaTimers(req, res, prisma));

  // Iniciar / pausar / reanudar cronómetro
  router.post('/timers/toggle', (req, res) => toggleAgendaTimer(req, res, prisma));

  // Reiniciar cronómetro
  router.post('/timers/reset', (req, res) => resetAgendaTimer(req, res, prisma));

  return router;
};

export default createRouter;
