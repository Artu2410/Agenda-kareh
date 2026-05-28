import { z } from 'zod';

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const SIMPLE_ID_REGEX = /^[a-z0-9_-]{10,}$/i;
const PHONE_REGEX = /^[+()0-9\s-]{6,30}$/;

const trimString = (value) => (typeof value === 'string' ? value.trim() : value);
const emptyToUndefined = (value) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

const isValidDateOnly = (value) => {
  if (!DATE_ONLY_REGEX.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  return (
    date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
  );
};

const isValidDateInput = (value) => {
  if (typeof value !== 'string' || value.trim() === '') return false;
  if (DATE_ONLY_REGEX.test(value)) return isValidDateOnly(value);

  return !Number.isNaN(new Date(value).getTime());
};

export const requiredString = (field, { min = 1, max = 255 } = {}) => (
  z.string()
    .trim()
    .min(min, `${field} es obligatorio`)
    .max(max, `${field} es demasiado largo`)
);

export const optionalString = (field, { max = 255 } = {}) => (
  z.preprocess(
    emptyToUndefined,
    z.string()
      .max(max, `${field} es demasiado largo`)
      .optional(),
  )
);

export const idSchema = (field = 'ID') => (
  z.preprocess(
    trimString,
    z.string()
      .min(1, `${field} es obligatorio`)
      .regex(SIMPLE_ID_REGEX, `${field} inválido`),
  )
);

export const optionalIdSchema = (field = 'ID') => (
  z.preprocess(
    emptyToUndefined,
    z.string()
      .regex(SIMPLE_ID_REGEX, `${field} inválido`)
      .optional(),
  )
);

export const requiredEmail = (field = 'Email') => (
  z.preprocess(
    trimString,
    z.string()
      .min(1, `${field} es obligatorio`)
      .email(`${field} inválido`)
      .transform((value) => value.toLowerCase()),
  )
);

export const optionalEmail = (field = 'Email') => (
  z.preprocess(
    emptyToUndefined,
    z.string()
      .email(`${field} inválido`)
      .transform((value) => value.toLowerCase())
      .optional(),
  )
);

export const optionalPhone = (field = 'Teléfono') => (
  z.preprocess(
    emptyToUndefined,
    z.string()
      .regex(PHONE_REGEX, `${field} inválido`)
      .max(30, `${field} es demasiado largo`)
      .optional(),
  )
);

export const dateOnlySchema = (field = 'Fecha') => (
  z.preprocess(
    trimString,
    z.string()
      .regex(DATE_ONLY_REGEX, `${field} debe tener formato YYYY-MM-DD`)
      .refine(isValidDateOnly, `${field} inválida`),
  )
);

export const optionalDateInput = (field = 'Fecha') => (
  z.preprocess(
    emptyToUndefined,
    z.string()
      .refine(isValidDateInput, `${field} inválida`)
      .optional(),
  )
);

export const timeSchema = (field = 'Horario') => (
  z.preprocess(
    trimString,
    z.string().regex(TIME_REGEX, `${field} inválido`),
  )
);

export const dayOfWeekSchema = z.number().int().min(0, 'Día inválido').max(6, 'Día inválido');

export const urlLikeString = (field = 'URL') => optionalString(field, { max: 2000 });

const checklistDocumentSchema = z.object({
  name: requiredString('Nombre del documento', { max: 255 }),
  mandatory: z.boolean().optional(),
  presented: z.boolean().optional(),
  fileUrl: urlLikeString('Archivo del documento'),
  fileName: optionalString('Nombre del archivo', { max: 255 }),
  presentedAt: optionalDateInput('Fecha de presentación'),
  validityDays: z.coerce.number().int().min(0, 'Validez inválida').optional(),
  reusedFromAppointmentId: optionalIdSchema('Turno de origen'),
}).strip();

export const documentsChecklistSchema = z.object({
  documents: z.array(checklistDocumentSchema).max(50, 'Demasiados documentos').optional(),
  additionalInfo: optionalString('Información adicional', { max: 2000 }),
}).strip();

export const booleanFlag = () => z.boolean().optional();
