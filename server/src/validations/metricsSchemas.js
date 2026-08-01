import { z } from 'zod';

const parseOptionalString = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  return String(value).trim();
};

export const metricsQuerySchema = z.object({
  period: z.enum(['week', 'month', 'year']).optional(),
  month: z.preprocess(parseOptionalString, z.string().regex(/^\d{1,2}$/, 'Mes inválido').optional()),
  year: z.preprocess(parseOptionalString, z.string().regex(/^\d{4}$/, 'Año inválido').optional()),
  timezone: z.preprocess(parseOptionalString, z.string().max(100, 'Zona horaria inválida').optional()),
}).superRefine((value, ctx) => {
  const hasMonth = value.month !== undefined;
  const hasYear = value.year !== undefined;

  if (hasMonth !== hasYear) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['month'],
      message: 'Si se envía month o year, ambos deben enviarse para filtrar por periodo.',
    });
  }
});
