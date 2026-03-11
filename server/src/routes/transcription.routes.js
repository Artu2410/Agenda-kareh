import { Router } from 'express';
import multer from 'multer';
import { processMedicalRecipe } from '../controllers/transcription.controller.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  '/process',
  upload.single('recipe'),
  processMedicalRecipe
);

export default router;
