import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';
import { createReceipt, deleteReceipt, listReceipts } from '../controllers/receipts.controller.js';

const moneySchema = z.coerce.number({ error: 'Monto inválido' })
  .finite('Monto inválido')
  .positive('El monto debe ser mayor a 0')
  .max(999_999_999, 'Monto demasiado alto')
  .transform((value) => Math.round(value * 100) / 100);

export const createReceiptBodySchema = z.object({
  patientId: z.string({ error: 'Paciente requerido' }).trim().min(1, 'Paciente requerido').max(64),
  professionalId: z.union([z.string().max(64), z.null()]).optional(),
  description: z.string({ error: 'La descripción es obligatoria' })
    .trim()
    .min(1, 'La descripción es obligatoria')
    .max(500, 'Máximo 500 caracteres'),
  // Precio de cada sesión × cantidad = total. "amount" solo (sin unitario) se sigue
  // aceptando como 1 × monto, para no romper clientes viejos.
  unitPrice: moneySchema.optional(),
  quantity: z.coerce.number({ error: 'Cantidad inválida' })
    .int('La cantidad debe ser un número entero')
    .min(1, 'La cantidad debe ser al menos 1')
    .max(999, 'Cantidad demasiado alta')
    .default(1),
  amount: moneySchema.optional(),
  // Fecha que figura en el comprobante (YYYY-MM-DD). Si no viene, hoy.
  issueDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
    .refine((value) => {
      const date = new Date(`${value}T12:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }, 'Fecha inválida')
    // Desde el año 2000 hasta un año adelante: evita errores de tipeo como 0202 o 2062.
    .refine((value) => {
      const maxDate = new Date();
      maxDate.setUTCFullYear(maxDate.getUTCFullYear() + 1);
      return value >= '2000-01-01' && value <= maxDate.toISOString().slice(0, 10);
    }, 'La fecha debe estar entre el año 2000 y un año adelante')
    .optional(),
}).strip()
  .refine((body) => body.unitPrice !== undefined || body.amount !== undefined, {
    message: 'Ingresá el precio de la sesión',
    path: ['unitPrice'],
  })
  .transform((body) => {
    const unitPrice = body.unitPrice ?? Math.round((body.amount / body.quantity) * 100) / 100;
    const amount = body.unitPrice !== undefined
      ? Math.round(body.unitPrice * body.quantity * 100) / 100
      : body.amount;
    return { ...body, unitPrice, amount };
  })
  .refine((body) => body.amount <= 999_999_999, { message: 'Monto demasiado alto', path: ['amount'] });

export const receiptIdParamsSchema = z.object({
  id: z.string().trim().min(1).max(64),
}).strip();

export default function createReceiptsRoutes(prisma) {
  const router = Router();

  router.get('/', (req, res) => listReceipts(req, res, prisma));
  router.post('/', validate({ body: createReceiptBodySchema }), (req, res) => createReceipt(req, res, prisma));
  router.delete('/:id', validate({ params: receiptIdParamsSchema }), (req, res) => deleteReceipt(req, res, prisma));

  return router;
}
