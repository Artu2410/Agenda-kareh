const COVERAGE_CATEGORIES = new Set(['obra_social', 'prepaga', 'art']);

const normalizeCoverageCategory = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return COVERAGE_CATEGORIES.has(normalized) ? normalized : 'obra_social';
};

const toOptionalInteger = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.trunc(parsed);
};

const normalizeAliases = (value) => {
  const sourceValues = Array.isArray(value)
    ? value
    : String(value || '')
      .split(/[\n,]/g);

  return Array.from(new Set(
    sourceValues
      .map((item) => String(item || '').trim())
      .filter(Boolean),
  ));
};

const normalizeCoveragePayload = (body = {}) => {
  const normalizedName = String(body.name || '').trim();
  const sortOrder = toOptionalInteger(body.sortOrder);

  return {
    name: normalizedName,
    category: normalizeCoverageCategory(body.category),
    aliases: normalizeAliases(body.aliases),
    isActive: body.isActive === undefined ? true : !!body.isActive,
    sortOrder: sortOrder === undefined ? undefined : Math.max(0, sortOrder),
  };
};

export const listWhatsAppCoverages = async (req, res, prisma) => {
  try {
    const includeInactive = String(req.query?.includeInactive || '').trim() === '1'
      || String(req.query?.includeInactive || '').trim().toLowerCase() === 'true';

    const coverages = await prisma.whatsAppCoverage.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });

    return res.json({ coverages });
  } catch (error) {
    console.error('ERROR OBTENIENDO COBERTURAS WHATSAPP:', error);
    return res.status(500).json({ message: 'No se pudieron cargar las coberturas.' });
  }
};

export const createWhatsAppCoverage = async (req, res, prisma) => {
  try {
    const payload = normalizeCoveragePayload(req.body);
    if (!payload.name) {
      return res.status(400).json({ message: 'El nombre es obligatorio.' });
    }

    const existing = await prisma.whatsAppCoverage.findFirst({
      where: {
        name: {
          equals: payload.name,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      return res.status(409).json({ message: 'Ya existe una cobertura con ese nombre.' });
    }

    const lastCoverage = await prisma.whatsAppCoverage.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const created = await prisma.whatsAppCoverage.create({
      data: {
        ...payload,
        sortOrder: payload.sortOrder ?? ((lastCoverage?.sortOrder || 0) + 1),
      },
    });

    return res.status(201).json({ coverage: created });
  } catch (error) {
    console.error('ERROR CREANDO COBERTURA WHATSAPP:', error);
    return res.status(500).json({ message: 'No se pudo crear la cobertura.' });
  }
};

export const updateWhatsAppCoverage = async (req, res, prisma) => {
  const { id } = req.params;

  try {
    const existing = await prisma.whatsAppCoverage.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'Cobertura no encontrada.' });
    }

    const payload = normalizeCoveragePayload(req.body);
    if (!payload.name) {
      return res.status(400).json({ message: 'El nombre es obligatorio.' });
    }

    const nameConflict = await prisma.whatsAppCoverage.findFirst({
      where: {
        name: {
          equals: payload.name,
          mode: 'insensitive',
        },
        id: { not: id },
      },
      select: { id: true },
    });

    if (nameConflict) {
      return res.status(409).json({ message: 'Ya existe otra cobertura con ese nombre.' });
    }

    const updated = await prisma.whatsAppCoverage.update({
      where: { id },
      data: {
        name: payload.name,
        category: payload.category,
        aliases: payload.aliases,
        isActive: payload.isActive,
        sortOrder: payload.sortOrder ?? existing.sortOrder,
      },
    });

    return res.json({ coverage: updated });
  } catch (error) {
    console.error('ERROR ACTUALIZANDO COBERTURA WHATSAPP:', error);
    return res.status(500).json({ message: 'No se pudo actualizar la cobertura.' });
  }
};
