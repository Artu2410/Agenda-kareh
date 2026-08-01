import {
  createInMemoryWhatsAppCoverage,
  listInMemoryWhatsAppCoverages,
  updateInMemoryWhatsAppCoverage,
} from '../utils/whatsappCoverageCatalog.js';

export const listWhatsAppCoverages = (req, res) => {
  const includeInactive = String(req.query?.includeInactive || '').trim().toLowerCase();
  const coverages = listInMemoryWhatsAppCoverages({
    includeInactive: includeInactive === '1' || includeInactive === 'true',
  });
  return res.json({ coverages });
};

export const createWhatsAppCoverage = (req, res) => {
  try {
    const coverage = createInMemoryWhatsAppCoverage(req.body || {});
    return res.status(201).json({ coverage });
  } catch (error) {
    const message = error?.message || 'No se pudo crear la cobertura.';
    const status = message === 'Cobertura no encontrada.' ? 404 : 400;
    return res.status(status).json({ message });
  }
};

export const updateWhatsAppCoverage = (req, res) => {
  try {
    const coverage = updateInMemoryWhatsAppCoverage(req.params.id, req.body || {});
    return res.json({ coverage });
  } catch (error) {
    const message = error?.message || 'No se pudo actualizar la cobertura.';
    const status = message === 'Cobertura no encontrada.' ? 404 : 400;
    return res.status(status).json({ message });
  }
};
