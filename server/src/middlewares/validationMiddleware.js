import Joi from 'joi';
import { ValidationError } from '../errors/AppError.js';

const createAppointmentSchema = Joi.object({
    patient: Joi.object({
        fullName: Joi.string().required(),
        dni: Joi.string().pattern(/^[0-9]+$/).required(),
        phone: Joi.string().required(),
        hasCancer: Joi.boolean().required(),
        hasPacemaker: Joi.boolean().required(),
        bypass: Joi.boolean().required(),
        rehab: Joi.string().required(),
        address: Joi.string().required(),
        birthDate: Joi.string().required(),
        socialWork: Joi.string().required()
    }).required(),
    appointment: Joi.object({
        date: Joi.date().iso().required(),
        time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
        professionalId: Joi.string().required(),
        slotNumber: Joi.number().integer().min(1).max(5).required(),
    }).required(),
    appointmentType: Joi.string().valid('individual', 'package').required(),
    sessions: Joi.when('appointmentType', {
        is: 'package',
        then: Joi.array().items(Joi.object({
            date: Joi.date().iso().required(),
            time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
            slotNumber: Joi.number().integer().min(1).max(5).required(),
        })).length(10).required(),
        otherwise: Joi.forbidden()
    }),
    diagnosis: Joi.string().when('appointmentType', {
      is: 'package',
      then: Joi.string().required(),
      otherwise: Joi.optional()
    })
});

export const validateCreateAppointment = (req, res, next) => {
  const { error } = createAppointmentSchema.validate(req.body);
  if (error) {
    throw new ValidationError(error.details[0].message);
  }
  next();
};
