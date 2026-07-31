import { z } from 'zod';
import {
  booleanFlag,
  idSchema,
  optionalEmail,
  optionalIdSchema,
  optionalPhone,
  optionalDateInput,
  optionalString,
  requiredString,
} from './common.js';

export const patientBodySchema = z.object({
  fullName: requiredString('Nombre completo', { min: 2, max: 120 }),
  dni: requiredString('DNI', { min: 6, max: 12 }).regex(/^\d{6,12}$/, 'DNI inválido'),
  phone: optionalPhone('Teléfono'),
  email: optionalEmail('Email'),
  address: optionalString('Dirección', { max: 200 }),
  birthDate: optionalDateInput('Fecha de nacimiento'),
  healthInsurance: optionalString('Cobertura', { max: 120 }),
  obraSocialId: optionalIdSchema('Obra social'),
  treatAsParticular: booleanFlag(),
  affiliateNumber: optionalString('Número de afiliado', { max: 60 }),
  emergencyPhone: optionalPhone('Teléfono de emergencia'),
  medicalHistory: optionalString('Antecedentes médicos', { max: 4000 }),
  dniImageUrl: optionalString('Imagen de DNI', { max: 2000 }),
  dniBackImageUrl: optionalString('Imagen trasera de DNI', { max: 2000 }),
  insuranceCardImageUrl: optionalString('Imagen de credencial', { max: 2000 }),
  insuranceCardBackImageUrl: optionalString('Imagen trasera de credencial', { max: 2000 }),
  hasCancer: booleanFlag(),
  hasMarcapasos: booleanFlag(),
  usesEA: booleanFlag(),
  usesWheelchair: booleanFlag(),
  isRespiratory: booleanFlag(),
  isIU: booleanFlag(),
  medicalNotes: optionalString('Notas médicas', { max: 5000 }),
}).strip();

export const createPatientBodySchema = patientBodySchema;
export const updatePatientBodySchema = patientBodySchema.partial();

export const patientIdParamsSchema = z.object({
  id: idSchema('Paciente'),
}).strip();
