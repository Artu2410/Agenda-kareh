import express from 'express';
import {
  getAllProfessionals,
  createProfessional,
  updateProfessional,
  getWorkSchedule,
  upsertWorkSchedule,
} from '../controllers/professionalController.js';

const router = express.Router();

router.get('/', getAllProfessionals);
router.post('/', createProfessional);
router.put('/:id', updateProfessional);

router.get('/:id/work-schedule', getWorkSchedule);
router.post('/:id/work-schedule', upsertWorkSchedule);

export default router;
