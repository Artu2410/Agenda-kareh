import { hasValidFileSignature } from '../utils/fileUrlSigning.js';

/**
 * Acceso a /uploads:
 * - GET/HEAD con firma válida (?exp=&sig=, generada por la API) → se sirve.
 * - Cualquier otro caso → requiere sesión (cookie, Bearer o ?token= en rutas de archivos).
 */
export const createFileAccessMiddleware = ({ handler, authMiddleware }) => (req, res, next) => {
  if ((req.method === 'GET' || req.method === 'HEAD') && hasValidFileSignature(req)) {
    return handler(req, res, next);
  }

  return authMiddleware(req, res, () => handler(req, res, next));
};
