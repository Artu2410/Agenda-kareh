import { Router } from 'express';
import multer from 'multer';
import { processMedicalRecipe } from '../controllers/transcription.controller.js';

export default function createTranscriptionRoutes() {
  const router = Router();
  const MAX_TRANSCRIPTION_MB = Number(process.env.TRANSCRIPTION_MAX_MB || 8);
  const MAX_TRANSCRIPTION_BYTES = MAX_TRANSCRIPTION_MB * 1024 * 1024;
  const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_TRANSCRIPTION_BYTES },
    fileFilter: (req, file, cb) => {
      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        return cb(new Error('Tipo de archivo no permitido'));
      }
      return cb(null, true);
    },
  });

  router.post('/process', upload.single('recipe'), processMedicalRecipe);

  router.use((err, req, res, next) => {
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: `Archivo demasiado grande. Máximo ${MAX_TRANSCRIPTION_MB}MB.` });
    }
    if (err?.message === 'Tipo de archivo no permitido') {
      return res.status(400).json({ message: 'Tipo de archivo no permitido. Solo imágenes JPG/PNG/WebP.' });
    }
    if (err) {
      return res.status(400).json({ message: err.message || 'Archivo inválido' });
    }
    return next();
  });

  return router;
}
