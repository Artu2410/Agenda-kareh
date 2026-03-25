import Joi from 'joi';
import { ValidationError } from '../errors/AppError.js';

const appointmentSchema = Joi.object({
  date: Joi.date().iso().min('now').required().messages({
    'date.iso': 'La fecha debe estar en formato ISO 8601 (YYYY-MM-DD).',
    'date.min': 'La fecha no puede ser en el pasado.',
    'any.required': 'La fecha es obligatoria.',
  }),
  time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
    'string.pattern.base': 'La hora debe estar en formato HH:mm.',
    'any.required': 'La hora es obligatoria.',
  }),
  slotNumber: Joi.number().integer().min(1).max(5).required().messages({
    'number.base': 'El número de slot debe ser un número.',
    'number.integer': 'El número de slot debe ser un entero.',
    'number.min': 'El número de slot debe ser al menos 1.',
    'number.max': 'El número de slot no puede ser mayor que 5.',
    'any.required': 'El número de slot es obligatorio.',
  }),
  dni: Joi.string().pattern(/^\d{7,10}$/).required().messages({
    'string.pattern.base': 'El DNI debe ser una cadena numérica de entre 7 y 10 caracteres.',
    'any.required': 'El DNI es obligatorio.',
  }),
  email: Joi.string().email().messages({
    'string.email': 'El email debe tener un formato válido.',
  }),
  fullName: Joi.string().required().messages({
    'any.required': 'El nombre completo es obligatorio.',
  }),
  phone: Joi.string().required().messages({
    'any.required': 'El teléfono es obligatorio.',
  }),
  professionalId: Joi.string().uuid().required().messages({
    'string.uuid': 'El ID del profesional debe ser un UUID válido.',
    'any.required': 'El ID del profesional es obligatorio.',
  }),
  // Otros campos que pueda tener una cita y que necesiten validación
});

export const validateAppointment = (req, res, next) => {
  const { error } = appointmentSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map(err => err.message);
    return next(new ValidationError(errors.join(', ')));
  }
  next();
};
