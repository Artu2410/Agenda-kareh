import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';
import { createReport, getReport, listReports } from '../controllers/reports.controller.js';

const MAX_REPORT_DATA_CHARS = 100_000;

export const createReportBodySchema = z.object({
  patientId: z.string({ error: 'Paciente requerido' }).trim().min(1, 'Paciente requerido').max(64),
  professionalId: z.union([z.string().max(64), z.null()]).optional(),
  type: z.string({ error: 'Tipo de informe requerido' }).trim().min(1).max(40),
  title: z.string({ error: 'Título requerido' }).trim().min(1).max(120),
  reportDate: z.coerce.date({ error: 'Fecha inválida' }),
  data: z.record(z.string(), z.unknown())
    .refine((value) => JSON.stringify(value).length <= MAX_REPORT_DATA_CHARS, 'El informe es demasiado largo'),
}).strip();

export default function createReportsRoutes(prisma) {
  const router = Router();

  router.get('/', (req, res) => listReports(req, res, prisma));
  router.get('/:id', (req, res) => getReport(req, res, prisma));
  router.post('/', validate({ body: createReportBodySchema }), (req, res) => createReport(req, res, prisma));

  return router;
}
