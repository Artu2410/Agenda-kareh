import { Router } from 'express';
import { getAgendaConfig, updateAgendaConfig } from '../controllers/agendaController.js';

const createRouter = (prisma) => {
  const router = Router();

  // Obtener configuración de agenda
  router.get('/config', (req, res) => getAgendaConfig(req, res, prisma));

  // Actualizar configuración de agenda
  router.put('/config', (req, res) => updateAgendaConfig(req, res, prisma));

  return router;
};

export default createRouter;
