import express from 'express';
import {
  getAllProfessionals,
  createProfessional,
  updateProfessional,
  getWorkSchedule,
  upsertWorkSchedule,
  archiveProfessional,
  deleteProfessional,
} from '../controllers/professionalController.js';
import { checkRole } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import {
  archiveProfessionalBodySchema,
  createProfessionalBodySchema,
  idParamsSchema,
  updateProfessionalBodySchema,
  workScheduleBodySchema,
} from '../validations/adminSchemas.js';

export default function createProfessionalRoutes(prisma) {
  const router = express.Router();

  router.get('/', (req, res) => getAllProfessionals(req, res, prisma));
  router.post('/', checkRole('SUPER_USER', 'ADMIN'), validate({ body: createProfessionalBodySchema }), (req, res) => createProfessional(req, res, prisma));
  router.put('/:id', checkRole('SUPER_USER', 'ADMIN'), validate({ params: idParamsSchema, body: updateProfessionalBodySchema }), (req, res) => updateProfessional(req, res, prisma));
  router.patch('/:id/archive', checkRole('SUPER_USER', 'ADMIN'), validate({ params: idParamsSchema, body: archiveProfessionalBodySchema }), (req, res) => archiveProfessional(req, res, prisma));
  router.delete('/:id', checkRole('SUPER_USER', 'ADMIN'), (req, res) => deleteProfessional(req, res, prisma));

  router.get('/:id/work-schedule', (req, res) => getWorkSchedule(req, res, prisma));
  router.post('/:id/work-schedule', checkRole('SUPER_USER', 'ADMIN'), validate({ params: idParamsSchema, body: workScheduleBodySchema }), (req, res) => upsertWorkSchedule(req, res, prisma));

  return router;
}
