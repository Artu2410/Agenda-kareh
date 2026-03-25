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

export default function createProfessionalRoutes(prisma) {
  const router = express.Router();

  router.get('/', (req, res) => getAllProfessionals(req, res, prisma));
  router.post('/', (req, res) => createProfessional(req, res, prisma));
  router.put('/:id', (req, res) => updateProfessional(req, res, prisma));
  router.patch('/:id/archive', (req, res) => archiveProfessional(req, res, prisma));
  router.delete('/:id', (req, res) => deleteProfessional(req, res, prisma));

  router.get('/:id/work-schedule', (req, res) => getWorkSchedule(req, res, prisma));
  router.post('/:id/work-schedule', (req, res) => upsertWorkSchedule(req, res, prisma));

  return router;
}
