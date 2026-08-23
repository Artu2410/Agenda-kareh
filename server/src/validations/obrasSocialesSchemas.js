import { z } from 'zod';
import { optionalString, requiredString } from './common.js';

export const createObraSocialBodySchema = z.object({
  nombreOs: requiredString('Nombre de la obra social', { min: 2, max: 150 }),
}).passthrough();

export const updateObraSocialBodySchema = z.object({
  nombreOs: optionalString('Nombre de la obra social', { max: 150 }),
}).passthrough();
