import { Router } from 'express';
import {
  getObrasSociales,
  getObrasSocialesStatus,
  syncObrasSociales,
  getObraSocial,
  createObraSocial,
  updateObraSocial,
  deleteObraSocial,
  getObrasSocialesStats,
} from '../controllers/obrasSociales.controller.js';
import { checkRole } from '../middlewares/authMiddleware.js';

const createRouter = (prisma) => {
  const router = Router();

  // GET: /api/obras-sociales/stats (Estadísticas rápidas)
  router.get('/stats', (req, res) => getObrasSocialesStats(req, res, prisma));

  // GET: /api/obras-sociales/status (Estado de sincronización / configuración)
  router.get('/status', (req, res) => getObrasSocialesStatus(req, res, prisma));

  // POST: /api/obras-sociales/sync (Sincronizar con COKIBA)
  router.post('/sync', checkRole('ADMIN'), (req, res) => syncObrasSociales(req, res, prisma));

  // GET: /api/obras-sociales (Listar con filtros opcionales: estado, search, zona)
  router.get('/', (req, res) => getObrasSociales(req, res, prisma));

  // GET: /api/obras-sociales/:id (Obtener una OS por ID)
  router.get('/:id', (req, res) => getObraSocial(req, res, prisma));

  // POST: /api/obras-sociales (Crear manualmente)
  router.post('/', (req, res) => createObraSocial(req, res, prisma));

  // PUT: /api/obras-sociales/:id (Actualizar)
  router.put('/:id', (req, res) => updateObraSocial(req, res, prisma));

  // DELETE: /api/obras-sociales/:id (Eliminar)
  router.delete('/:id', (req, res) => deleteObraSocial(req, res, prisma));

  return router;
};

export default createRouter;
