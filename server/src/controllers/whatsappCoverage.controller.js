const COVERAGE_CATEGORIES = new Set(['obra_social', 'prepaga', 'art']);
const COVERAGE_ORDER_BY = [{ sortOrder: 'asc' }, { name: 'asc' }];

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

const clampCoverageIndex = (value, maxIndex) => {
  if (!Number.isFinite(value)) return maxIndex;
  return Math.min(Math.max(0, value), maxIndex);
};

const reorderCoverageList = (coverages, targetId, desiredIndex) => {
  const currentIndex = coverages.findIndex((coverage) => coverage.id === targetId);
  if (currentIndex === -1) return null;

  const nextCoverages = [...coverages];
  const [selectedCoverage] = nextCoverages.splice(currentIndex, 1);
  const boundedIndex = clampCoverageIndex(desiredIndex, nextCoverages.length);
  nextCoverages.splice(boundedIndex, 0, selectedCoverage);
  return nextCoverages;
};

const persistCoverageOrder = async (tx, orderedCoverages = []) => {
  for (let index = 0; index < orderedCoverages.length; index += 1) {
    const coverage = orderedCoverages[index];
    const nextSortOrder = index + 1;

    if (coverage.sortOrder === nextSortOrder) {
      continue;
    }

    await tx.whatsAppCoverage.update({
      where: { id: coverage.id },
      data: { sortOrder: nextSortOrder },
    });
  }
};

export const listWhatsAppCoverages = async (req, res, prisma) => {
  try {
    const includeInactive = String(req.query?.includeInactive || '').trim() === '1'
      || String(req.query?.includeInactive || '').trim().toLowerCase() === 'true';

    const coverages = await prisma.whatsAppCoverage.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: COVERAGE_ORDER_BY,
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

    const created = await prisma.$transaction(async (tx) => {
      const orderedCoverages = await tx.whatsAppCoverage.findMany({
        orderBy: COVERAGE_ORDER_BY,
        select: { id: true, sortOrder: true },
      });

      const createdCoverage = await tx.whatsAppCoverage.create({
        data: {
          ...payload,
          sortOrder: orderedCoverages.length + 1,
        },
      });

      const desiredIndex = payload.sortOrder === undefined
        ? orderedCoverages.length
        : clampCoverageIndex(payload.sortOrder - 1, orderedCoverages.length);
      const reordered = reorderCoverageList(
        [...orderedCoverages, { id: createdCoverage.id, sortOrder: createdCoverage.sortOrder }],
        createdCoverage.id,
        desiredIndex,
      );

      await persistCoverageOrder(tx, reordered);

      return tx.whatsAppCoverage.findUnique({ where: { id: createdCoverage.id } });
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

    const updated = await prisma.$transaction(async (tx) => {
      const updatedCoverage = await tx.whatsAppCoverage.update({
        where: { id },
        data: {
          name: payload.name,
          category: payload.category,
          aliases: payload.aliases,
          isActive: payload.isActive,
          sortOrder: existing.sortOrder,
        },
      });

      if (payload.sortOrder === undefined || payload.sortOrder === existing.sortOrder) {
        return updatedCoverage;
      }

      const orderedCoverages = await tx.whatsAppCoverage.findMany({
        orderBy: COVERAGE_ORDER_BY,
        select: { id: true, sortOrder: true },
      });

      const reordered = reorderCoverageList(
        orderedCoverages,
        id,
        clampCoverageIndex(payload.sortOrder - 1, orderedCoverages.length - 1),
      );

      await persistCoverageOrder(tx, reordered);

      return tx.whatsAppCoverage.findUnique({ where: { id } });
    });

    return res.json({ coverage: updated });
  } catch (error) {
    console.error('ERROR ACTUALIZANDO COBERTURA WHATSAPP:', error);
    return res.status(500).json({ message: 'No se pudo actualizar la cobertura.' });
  }
};

export const moveWhatsAppCoverage = async (req, res, prisma) => {
  const { id } = req.params;
  const direction = String(req.body?.direction || '').trim().toLowerCase();

  if (!['up', 'down'].includes(direction)) {
    return res.status(400).json({ message: 'Dirección inválida. Usa "up" o "down".' });
  }

  try {
    const movedCoverage = await prisma.$transaction(async (tx) => {
      const orderedCoverages = await tx.whatsAppCoverage.findMany({
        orderBy: COVERAGE_ORDER_BY,
        select: { id: true, sortOrder: true },
      });

      const currentIndex = orderedCoverages.findIndex((coverage) => coverage.id === id);
      if (currentIndex === -1) {
        return null;
      }

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= orderedCoverages.length) {
        return tx.whatsAppCoverage.findUnique({ where: { id } });
      }

      const reordered = [...orderedCoverages];
      [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];

      await persistCoverageOrder(tx, reordered);

      return tx.whatsAppCoverage.findUnique({ where: { id } });
    });

    if (!movedCoverage) {
      return res.status(404).json({ message: 'Cobertura no encontrada.' });
    }

    return res.json({ coverage: movedCoverage });
  } catch (error) {
    console.error('ERROR REORDENANDO COBERTURA WHATSAPP:', error);
    return res.status(500).json({ message: 'No se pudo reordenar la cobertura.' });
  }
};
