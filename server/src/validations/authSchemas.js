import { z } from 'zod';
import { requiredEmail, requiredString } from './common.js';

export const requestOtpBodySchema = z.object({
  email: requiredEmail(),
}).strip();

export const verifyOtpBodySchema = z.object({
  email: requiredEmail(),
  otp: requiredString('OTP', { min: 6, max: 6 }).regex(/^\d{6}$/, 'OTP inválido'),
}).strip();
