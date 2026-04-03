import { Router } from 'express';
import multer from 'multer';
import {
  listConversations,
  listMessages,
  markConversationRead,
  deleteConversation,
  sendConversationMessage,
  sendWelcomeTemplate,
} from '../controllers/whatsapp.controller.js';
import {
  createWhatsAppCoverage,
  listWhatsAppCoverages,
  updateWhatsAppCoverage,
} from '../controllers/whatsappCoverage.controller.js';

export default function createWhatsAppRoutes(prisma) {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedMimeTypes = new Set([
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
      ]);

      if (!allowedMimeTypes.has(file.mimetype)) {
        return cb(new Error('Tipo de archivo no permitido'));
      }

      return cb(null, true);
    },
  });

  router.get('/conversations', (req, res) => listConversations(req, res, prisma));
  router.get('/coverages', (req, res) => listWhatsAppCoverages(req, res, prisma));
  router.post('/coverages', (req, res) => createWhatsAppCoverage(req, res, prisma));
  router.put('/coverages/:id', (req, res) => updateWhatsAppCoverage(req, res, prisma));
  router.get('/conversations/:id/messages', (req, res) => listMessages(req, res, prisma));
  router.post('/conversations/:id/messages', upload.single('file'), (req, res) => sendConversationMessage(req, res, prisma));
  router.post('/conversations/:id/send-welcome', (req, res) => sendWelcomeTemplate(req, res, prisma));
  router.post('/conversations/:id/read', (req, res) => markConversationRead(req, res, prisma));
  router.delete('/conversations/:id', (req, res) => deleteConversation(req, res, prisma));

  router.use((err, req, res, next) => {
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'Archivo demasiado grande. Máximo 25MB.' });
    }
    if (err?.message === 'Tipo de archivo no permitido') {
      return res.status(400).json({ message: 'Tipo de archivo no permitido.' });
    }
    if (err) {
      return res.status(400).json({ message: err.message || 'Archivo inválido' });
    }
    return next();
  });

  return router;
}
