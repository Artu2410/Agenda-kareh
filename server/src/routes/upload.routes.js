import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { uploadBufferToStorage } from '../services/storage.js';

const MAX_UPLOAD_MB = Number(process.env.UPLOAD_MAX_MB || 25);
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Tipo de archivo no permitido'));
    }
    return cb(null, true);
  },
});

const buildKey = ({ originalname, mimetype, patientId, entryId }) => {
  const extFromName = path.extname(originalname || '').toLowerCase();
  const fallbackExt = mimetype === 'application/pdf' ? '.pdf' : '.jpg';
  const ext = extFromName || fallbackExt;

  const parts = ['clinical-history'];
  if (patientId) parts.push(patientId);
  if (entryId) parts.push(entryId);

  return `${parts.join('/')}/${Date.now()}-${crypto.randomUUID()}${ext}`;
};

export default function createUploadRoutes() {
  const router = Router();

  router.post('/', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Archivo requerido' });
      }

      const key = buildKey({
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        patientId: req.body?.patientId,
        entryId: req.body?.entryId,
      });

      const url = await uploadBufferToStorage({
        buffer: req.file.buffer,
        key,
        contentType: req.file.mimetype || 'application/octet-stream',
      });

      return res.status(201).json({
        url,
        name: req.file.originalname,
        type: req.file.mimetype,
        size: req.file.size,
      });
    } catch (error) {
      console.error('ERROR AL SUBIR ARCHIVO:', error);
      if (error?.message === 'Storage no configurado') {
        return res.status(503).json({
          message: 'Storage no configurado. Revisar variables de entorno.',
          detail: error.message,
        });
      }
      return res.status(500).json({
        message: 'Error al subir archivo',
        detail: error?.message,
      });
    }
  });

  router.use((err, req, res, next) => {
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: `Archivo demasiado grande. Máximo ${MAX_UPLOAD_MB}MB.` });
    }
    if (err?.message === 'Tipo de archivo no permitido') {
      return res.status(400).json({ message: 'Tipo de archivo no permitido. Solo imágenes o PDF.' });
    }
    if (err) {
      return res.status(400).json({ message: err.message || 'Archivo inválido' });
    }
    next();
  });

  return router;
}
