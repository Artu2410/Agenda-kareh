import { Router } from 'express';
import { listNotes, syncNotes } from '../controllers/notes.controller.js';
import { checkRole } from '../middlewares/authMiddleware.js';

const createRouter = (prisma) => {
  const router = Router();

  router.get('/', checkRole('SUPER_USER', 'ADMIN'), (req, res) => listNotes(req, res, prisma));
  router.put('/sync', checkRole('SUPER_USER', 'ADMIN'), (req, res) => syncNotes(req, res, prisma));

  return router;
};

export default createRouter;
