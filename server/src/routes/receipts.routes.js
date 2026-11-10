import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';
import { createReceipt, listReceipts } from '../controllers/receipts.controller.js';

export const createReceiptBodySchema = z.object({
  patientId: z.string({ error: 'Paciente requerido' }).trim().min(1, 'Paciente requerido').max(64),
  professionalId: z.union([z.string().max(64), z.null()]).optional(),
  description: z.string({ error: 'La descripción es obligatoria' })
    .trim()
    .min(1, 'La descripción es obligatoria')
    .max(500, 'Máximo 500 caracteres'),
  amount: z.coerce.number({ error: 'Monto inválido' })
    .finite('Monto inválido')
    .positive('El monto debe ser mayor a 0')
    .max(999_999_999, 'Monto demasiado alto')
    .transform((value) => Math.round(value * 100) / 100),
}).strip();

export default function createReceiptsRoutes(prisma) {
  const router = Router();

  router.get('/', (req, res) => listReceipts(req, res, prisma));
  router.post('/', validate({ body: createReceiptBodySchema }), (req, res) => createReceipt(req, res, prisma));

  return router;
}
