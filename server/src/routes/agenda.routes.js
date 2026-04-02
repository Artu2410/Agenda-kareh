import { Router } from 'express';
import {
  getAgendaConfig,
  getAgendaTimers,
  resetAgendaTimer,
  toggleAgendaTimer,
  updateAgendaConfig,
} from '../controllers/agendaController.js';

const createRouter = (prisma) => {
  const router = Router();

  // Obtener configuración de agenda
  router.get('/config', (req, res) => getAgendaConfig(req, res, prisma));

  // Actualizar configuración de agenda
  router.put('/config', (req, res) => updateAgendaConfig(req, res, prisma));

  // Obtener cronómetros del bloque horario activo
  router.get('/timers', (req, res) => getAgendaTimers(req, res, prisma));

  // Iniciar / pausar / reanudar cronómetro
  router.post('/timers/toggle', (req, res) => toggleAgendaTimer(req, res, prisma));

  // Resetear cronómetro al tiempo inicial
  router.post('/timers/reset', (req, res) => resetAgendaTimer(req, res, prisma));

  return router;
};

export default createRouter;
