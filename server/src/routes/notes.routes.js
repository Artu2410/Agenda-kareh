import { Router } from 'express';
import { listNotes, syncNotes } from '../controllers/notes.controller.js';

const createRouter = (prisma) => {
  const router = Router();

  router.get('/', (req, res) => listNotes(req, res, prisma));
  router.put('/sync', (req, res) => syncNotes(req, res, prisma));

  return router;
};

export default createRouter;
