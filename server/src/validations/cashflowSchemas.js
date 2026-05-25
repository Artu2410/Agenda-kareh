import { z } from 'zod';
import {
  dateOnlySchema,
  idSchema,
  optionalString,
  requiredString,
} from './common.js';

const flowTypeSchema = z.enum(['INCOME', 'EXPENSE', 'TRANSFER']);
const accountSchema = z.enum(['CASH', 'MERCADO_PAGO']);

const cashflowBaseBodySchema = z.object({
  amount: z.coerce.number().positive('El monto debe ser mayor a cero'),
  category: optionalString('Categoría', { max: 80 }),
  concept: requiredString('Concepto', { min: 1, max: 160 }),
  paymentMethod: optionalString('Método de pago', { max: 80 }),
  date: dateOnlySchema('Fecha').optional(),
  account: accountSchema.optional(),
  destinationAccount: accountSchema.optional(),
}).strip();

export const createCashflowBodySchema = cashflowBaseBodySchema.extend({
  type: flowTypeSchema,
}).superRefine((data, ctx) => {
  if (data.type === 'TRANSFER') {
    if (!data.account) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['account'],
        message: 'Cuenta origen requerida',
      });
    }

    if (!data.destinationAccount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['destinationAccount'],
        message: 'Cuenta destino requerida',
      });
    }

    if (data.account && data.destinationAccount && data.account === data.destinationAccount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['destinationAccount'],
        message: 'La cuenta destino debe ser distinta',
      });
    }

    return;
  }

  if (!data.paymentMethod) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['paymentMethod'],
      message: 'Método de pago requerido',
    });
  }
});

export const createTypedCashflowBodySchema = cashflowBaseBodySchema.extend({
  paymentMethod: requiredString('Método de pago', { min: 1, max: 80 }),
});

export const cashflowIdParamsSchema = z.object({
  id: idSchema('Movimiento'),
}).strip();
