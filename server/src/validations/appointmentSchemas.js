import { z } from 'zod';
import {
  booleanFlag,
  dateOnlySchema,
  dayOfWeekSchema,
  documentsChecklistSchema,
  idSchema,
  optionalDateInput,
  optionalIdSchema,
  optionalPhone,
  optionalString,
  timeSchema,
} from './common.js';
import { createPatientBodySchema, updatePatientBodySchema } from './patientSchemas.js';

const appointmentStatusSchema = z.enum([
  'SCHEDULED',
  'PENDING_AUTHORIZATION',
  'AUTHORIZED',
  'REJECTED',
  'COMPLETED',
  'NO_SHOW',
  'CANCELLED',
]);

const authorizationStatusSchema = z.enum([
  'NOT_REQUIRED',
  'PENDING',
  'AUTHORIZED',
  'REJECTED',
]);

const appointmentPatientDataSchema = createPatientBodySchema;

export const appointmentIdParamsSchema = z.object({
  id: idSchema('Turno'),
}).strip();

export const patientIdRouteParamsSchema = z.object({
  patientId: idSchema('Paciente'),
}).strip();

export const appointmentWeekQuerySchema = z.object({
  startDate: dateOnlySchema('Fecha inicial'),
  endDate: dateOnlySchema('Fecha final'),
  professionalId: optionalIdSchema('Profesional'),
}).strip();

export const createAppointmentBodySchema = z.object({
  patientId: optionalIdSchema('Paciente'),
  patientData: appointmentPatientDataSchema.optional(),
  professionalId: optionalIdSchema('Profesional'),
  date: dateOnlySchema('Fecha'),
  time: timeSchema('Horario'),
  diagnosis: optionalString('Diagnóstico', { max: 300 }),
  sessionCount: z.coerce.number().int().min(1, 'Cantidad de sesiones inválida').max(60, 'Cantidad de sesiones inválida').optional(),
  selectedDays: z.array(dayOfWeekSchema).max(7, 'Demasiados días seleccionados').optional(),
  phone: optionalPhone('Teléfono'),
  birthDate: optionalDateInput('Fecha de nacimiento'),
  status: appointmentStatusSchema.optional(),
  documentsChecklist: documentsChecklistSchema.optional(),
  authorizationNumber: optionalString('Número de autorización', { max: 120 }),
  authorizationFileUrl: optionalString('Archivo de autorización', { max: 2000 }),
  paidInAdvance: booleanFlag(),
  sessionToken: optionalString('Token de sesión', { max: 120 }),
}).strip().superRefine((data, ctx) => {
  if (!data.patientId && !data.patientData) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['patientId'],
      message: 'Debes enviar patientId o patientData',
    });
  }
});

export const updateAppointmentBodySchema = z.object({
  patientId: idSchema('Paciente'),
  phone: optionalPhone('Teléfono'),
  birthDate: optionalDateInput('Fecha de nacimiento'),
  affiliateNumber: optionalString('Número de afiliado', { max: 60 }),
  date: dateOnlySchema('Fecha').optional(),
  time: timeSchema('Horario').optional(),
  documentsChecklist: documentsChecklistSchema.optional(),
  authorizationNumber: optionalString('Número de autorización', { max: 120 }),
  authorizationFileUrl: optionalString('Archivo de autorización', { max: 2000 }),
  paidInAdvance: booleanFlag(),
  sessionToken: optionalString('Token de sesión', { max: 120 }),
  status: appointmentStatusSchema.optional(),
  authorizationStatus: authorizationStatusSchema.optional(),
}).strip();

export const updateAppointmentEvolutionBodySchema = z.object({
  diagnosis: optionalString('Diagnóstico', { max: 300 }),
  status: appointmentStatusSchema.optional(),
  patientData: updatePatientBodySchema.optional(),
  evolution: optionalString('Evolución', { max: 5000 }),
  isFirstSession: booleanFlag(),
  documentsChecklist: documentsChecklistSchema.optional(),
  authorizationNumber: optionalString('Número de autorización', { max: 120 }),
  authorizationFileUrl: optionalString('Archivo de autorización', { max: 2000 }),
  paidInAdvance: booleanFlag(),
  sessionToken: optionalString('Token de sesión', { max: 120 }),
  authorizationStatus: authorizationStatusSchema.optional(),
}).strip();
