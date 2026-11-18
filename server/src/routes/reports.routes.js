import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';
import {
  createReport,
  getReport,
  listReports,
  spellcheckReport,
  updateReport,
} from '../controllers/reports.controller.js';

const MAX_REPORT_DATA_CHARS = 100_000;
const MAX_SPELLCHECK_FIELDS = 60;
const MAX_SPELLCHECK_CHARS = 20_000;

const reportFields = {
  professionalId: z.union([z.string().max(64), z.null()]).optional(),
  type: z.string({ error: 'Tipo de informe requerido' }).trim().min(1).max(40),
  title: z.string({ error: 'Título requerido' }).trim().min(1).max(120),
  reportDate: z.coerce.date({ error: 'Fecha inválida' }),
  data: z.record(z.string(), z.unknown())
    .refine((value) => JSON.stringify(value).length <= MAX_REPORT_DATA_CHARS, 'El informe es demasiado largo'),
};

export const createReportBodySchema = z.object({
  patientId: z.string({ error: 'Paciente requerido' }).trim().min(1, 'Paciente requerido').max(64),
  ...reportFields,
}).strip();

export const updateReportBodySchema = z.object(reportFields).strip();

export const spellcheckBodySchema = z.object({
  texts: z.record(z.string().max(80), z.string().max(MAX_SPELLCHECK_CHARS))
    .refine((value) => Object.keys(value).length <= MAX_SPELLCHECK_FIELDS, 'Demasiados campos para corregir')
    .refine((value) => Object.values(value).join('').length <= MAX_SPELLCHECK_CHARS, 'El texto es demasiado largo para corregir'),
}).strip();

export default function createReportsRoutes(prisma, { correctSpelling } = {}) {
  const router = Router();

  router.get('/', (req, res) => listReports(req, res, prisma));
  router.post('/spellcheck', validate({ body: spellcheckBodySchema }), (req, res) => (
    spellcheckReport(req, res, correctSpelling ? { correct: correctSpelling } : undefined)
  ));
  router.get('/:id', (req, res) => getReport(req, res, prisma));
  router.post('/', validate({ body: createReportBodySchema }), (req, res) => createReport(req, res, prisma));
  router.put('/:id', validate({ body: updateReportBodySchema }), (req, res) => updateReport(req, res, prisma));

  return router;
}
