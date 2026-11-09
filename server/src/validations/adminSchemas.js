import { z } from 'zod';

/**
 * Validación de forma (tipos y largos) para rutas que antes no validaban nada:
 * usuarios, profesionales, cronogramas, historia clínica y facturación.
 *
 * Criterio: rechazar con 400 lo que hoy terminaba en un 500 de Prisma (un objeto
 * donde va un id, una fecha imposible, textos gigantes), SIN cambiar el
 * comportamiento de payloads válidos:
 * - Los objetos son "loose": los campos que no se listan pasan igual.
 * - "" y null se respetan tal cual (para que el front pueda vaciar un campo).
 */

const text = (max = 255) => z.union([z.string().max(max, `Máximo ${max} caracteres`), z.null()]).optional();
const requiredText = (field, max = 255) => z.string({ error: `${field} es obligatorio` })
  .trim()
  .min(1, `${field} es obligatorio`)
  .max(max, `Máximo ${max} caracteres`);
const id = () => z.union([z.string().max(64, 'ID inválido'), z.null()]).optional();
const bool = () => z.union([z.boolean(), z.null()]).optional();
const amount = () => z.union([z.number().finite(), z.string().max(30), z.null()]).optional();

const isParsableDate = (value) => value === undefined || value === null || value === ''
  || !Number.isNaN(new Date(value).getTime());
const dateish = () => z.union([z.string().max(40), z.null()]).optional()
  .refine(isParsableDate, 'Fecha inválida');

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const time = (field) => z.string().regex(TIME_REGEX, `${field} inválido (HH:MM)`);

export const idParamsSchema = z.object({
  id: z.string().trim().min(1, 'ID requerido').max(64, 'ID inválido'),
}).loose();

// ---------- Usuarios ----------
export const createUserBodySchema = z.object({
  email: z.string().trim().email('Email inválido').max(254),
  fullName: requiredText('Nombre', 150),
  role: z.string().max(30).optional(),
  professionalId: id(),
  isActive: bool(),
}).loose();

export const updateUserBodySchema = z.object({
  email: z.string().trim().email('Email inválido').max(254).optional(),
  fullName: text(150),
  role: z.string().max(30).optional(),
  professionalId: id(),
  isActive: bool(),
}).loose();

export const updateUserRoleBodySchema = z.object({
  role: z.string({ error: 'Rol requerido' }).min(1, 'Rol requerido').max(30),
  professionalId: id(),
}).loose();

// ---------- Profesionales ----------
const IMAGE_FIELDS = [
  'dniImageUrl', 'dniBackImageUrl', 'licenseMNImageUrl', 'licenseMNBackImageUrl',
  'licenseMPImageUrl', 'licenseMPBackImageUrl', 'degreeImageUrl', 'degreeBackImageUrl',
  'providerRegistryImageUrl', 'malpracticeInsuranceImageUrl',
];
const imageFields = Object.fromEntries(IMAGE_FIELDS.map((field) => [field, text(2000)]));

const professionalShape = {
  fullName: text(150),
  licenseNumber: text(50),
  licenseNumberMP: text(50),
  specialty: text(150),
  type: text(10),
  isActive: bool(),
  isArchived: bool(),
  dni: text(20),
  phone: text(40),
  birthDate: dateish(),
  address: text(255),
  emergencyPhone: text(40),
  medicalHistory: text(10000),
  ...imageFields,
};

export const createProfessionalBodySchema = z.object({
  ...professionalShape,
  fullName: requiredText('Nombre completo', 150),
  licenseNumber: requiredText('Matrícula MN', 50),
}).loose();

export const updateProfessionalBodySchema = z.object(professionalShape).loose();

export const archiveProfessionalBodySchema = z.object({
  isArchived: z.boolean({ error: 'isArchived debe ser verdadero o falso' }),
}).loose();

export const workScheduleBodySchema = z.object({
  schedules: z.array(
    z.object({
      dayOfWeek: z.coerce.number().int().min(0, 'Día inválido').max(6, 'Día inválido'),
      startTime: time('Hora de inicio'),
      endTime: time('Hora de fin'),
    }).loose()
      .refine((item) => item.startTime < item.endTime, 'La hora de fin debe ser posterior al inicio'),
    { error: 'schedules debe ser una lista' },
  ).max(7, 'Máximo 7 días')
    .refine(
      (items) => new Set(items.map((item) => item.dayOfWeek)).size === items.length,
      'Hay días repetidos',
    ),
}).loose();

// ---------- Historia clínica ----------
const attachmentsField = z.union([
  z.string().max(5_000_000),
  z.array(z.object({}).loose()).max(100, 'Máximo 100 adjuntos'),
  z.null(),
]).optional();

const medicalConditionsField = z.union([
  z.object({
    hasMarcapasos: z.any().optional(),
    hasCancer: z.any().optional(),
    usesEA: z.any().optional(),
  }).loose(),
  z.null(),
]).optional();

export const createClinicalHistoryBodySchema = z.object({
  patientId: z.string({ error: 'El ID del paciente es requerido' }).trim().min(1, 'El ID del paciente es requerido').max(64),
  professionalId: id(),
  diagnosis: text(2000),
  evolution: text(100_000),
  attachments: attachmentsField,
  medicalConditions: medicalConditionsField,
  createdAt: dateish(),
}).loose();

export const updateClinicalHistoryBodySchema = z.object({
  diagnosis: text(2000),
  evolution: text(100_000),
  attachments: attachmentsField,
  createdAt: dateish(),
}).loose();

// ---------- Facturación ----------
const invoiceItemSchema = z.object({
  description: text(500),
  quantity: amount(),
  unitAmount: amount(),
  totalAmount: amount(),
  appointmentId: id(),
  patientId: id(),
  professionalId: id(),
  serviceDate: dateish(),
}).loose();

const invoiceShape = {
  payerType: text(30),
  payerName: text(200),
  obraSocialId: id(),
  patientId: id(),
  invoiceNumber: text(60),
  issueDate: dateish(),
  dueDate: dateish(),
  expectedPaymentDate: dateish(),
  serviceMonth: text(20),
  status: text(30),
  notes: text(5000),
  description: text(500),
  totalAmount: amount(),
  items: z.array(invoiceItemSchema).max(1000, 'Demasiados ítems').optional(),
};

export const createInvoiceBodySchema = z.object(invoiceShape).loose();
export const updateInvoiceBodySchema = z.object(invoiceShape).loose();

export const addPaymentBodySchema = z.object({
  amount: z.union([z.number().finite(), z.string().max(30)], { error: 'Monto requerido' }),
  paymentMethod: text(60),
  account: text(60),
  paymentDate: dateish(),
  notes: text(2000),
}).loose();
