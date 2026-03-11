import { Router } from 'express';
import multer from 'multer';
import { processMedicalRecipe } from '../controllers/transcription.controller.js';

export default function createTranscriptionRoutes() {
  const router = Router();
  const upload = multer({ storage: multer.memoryStorage() });

  router.post('/process', upload.single('recipe'), processMedicalRecipe);

  return router;
}
