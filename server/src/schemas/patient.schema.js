import Joi from 'joi';

export const createPatientSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(120).required(),
  dni: Joi.string().trim().pattern(/^\d{6,12}$/).required(),
  phone: Joi.string().trim().max(30).allow('', null),
  email: Joi.string().trim().email().allow('', null),
  address: Joi.string().trim().max(200).allow('', null),
  birthDate: Joi.alternatives().try(Joi.date().iso(), Joi.string().allow('')).allow(null),
  healthInsurance: Joi.string().trim().max(120).allow('', null),
  affiliateNumber: Joi.string().trim().max(50).allow('', null),
}).unknown(true);
