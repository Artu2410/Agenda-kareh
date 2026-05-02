// ---------------------------------------------------------
// Obras Sociales Controller (COKIBA)
// ---------------------------------------------------------

// 1. LISTAR TODAS LAS OBRAS SOCIALES
export const getObrasSociales = async (req, res, prisma) => {
  const { estado, search, zona } = req.query;
  const where = {};

  if (estado) {
    where.estado = estado;
  }

  if (search) {
    where.nombreOs = { contains: search, mode: 'insensitive' };
  }

  if (zona === 'san-miguel') {
    where.atendibleSanMiguel = true;
  }

  try {
    const obrasSociales = await prisma.obraSocial.findMany({
      where,
      orderBy: { nombreOs: 'asc' },
    });

    res.status(200).json(obrasSociales);
  } catch (error) {
    console.error('❌ Error fetching obras sociales:', error);
    res.status(500).json({
      error: 'Error al obtener obras sociales',
      message: error.message,
    });
  }
};

// 2. OBTENER UNA OBRA SOCIAL POR ID
export const getObraSocial = async (req, res, prisma) => {
  const { id } = req.params;

  try {
    const obraSocial = await prisma.obraSocial.findUnique({
      where: { id },
    });

    if (!obraSocial) {
      return res.status(404).json({ error: 'Obra social no encontrada' });
    }

    res.status(200).json(obraSocial);
  } catch (error) {
    console.error('❌ Error fetching obra social:', error);
    res.status(500).json({
      error: 'Error al obtener obra social',
      message: error.message,
    });
  }
};

// 3. CREAR OBRA SOCIAL MANUALMENTE
export const createObraSocial = async (req, res, prisma) => {
  const {
    codigoCokiba,
    nombreOs,
    coseguroValor,
    honorarioEstimado,
    plazoPago,
    estado,
    atendibleSanMiguel,
    rawCategoria,
  } = req.body;

  if (!nombreOs) {
    return res.status(400).json({ error: 'El nombre de la obra social es obligatorio' });
  }

  try {
    const obraSocial = await prisma.obraSocial.create({
      data: {
        codigoCokiba: codigoCokiba || nombreOs.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10) + '_' + Date.now().toString(36),
        nombreOs,
        coseguroValor: parseFloat(coseguroValor) || 0,
        honorarioEstimado: parseFloat(honorarioEstimado) || 0,
        plazoPago: parseInt(plazoPago) || 60,
        estado: estado || 'Activa',
        atendibleSanMiguel: atendibleSanMiguel || false,
        rawCategoria: rawCategoria || 'Básica',
        ultimaSync: new Date(),
      },
    });

    res.status(201).json(obraSocial);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe una obra social con ese código COKIBA' });
    }
    console.error('❌ Error creating obra social:', error);
    res.status(500).json({
      error: 'Error al crear obra social',
      message: error.message,
    });
  }
};

// 4. ACTUALIZAR OBRA SOCIAL
export const updateObraSocial = async (req, res, prisma) => {
  const { id } = req.params;
  const {
    nombreOs,
    coseguroValor,
    honorarioEstimado,
    plazoPago,
    estado,
    atendibleSanMiguel,
    rawCategoria,
  } = req.body;

  const data = {};
  if (nombreOs !== undefined) data.nombreOs = nombreOs;
  if (coseguroValor !== undefined) data.coseguroValor = parseFloat(coseguroValor);
  if (honorarioEstimado !== undefined) data.honorarioEstimado = parseFloat(honorarioEstimado);
  if (plazoPago !== undefined) data.plazoPago = parseInt(plazoPago);
  if (estado !== undefined) data.estado = estado;
  if (atendibleSanMiguel !== undefined) data.atendibleSanMiguel = atendibleSanMiguel;
  if (rawCategoria !== undefined) data.rawCategoria = rawCategoria;

  try {
    const updated = await prisma.obraSocial.update({
      where: { id },
      data,
    });

    res.status(200).json(updated);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Obra social no encontrada' });
    }
    console.error('❌ Error updating obra social:', error);
    res.status(500).json({
      error: 'Error al actualizar obra social',
      message: error.message,
    });
  }
};

// 5. ELIMINAR OBRA SOCIAL
export const deleteObraSocial = async (req, res, prisma) => {
  const { id } = req.params;

  try {
    await prisma.obraSocial.delete({
      where: { id },
    });

    res.status(200).json({ message: 'Obra social eliminada con éxito' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Obra social no encontrada' });
    }
    console.error('❌ Error deleting obra social:', error);
    res.status(500).json({
      error: 'Error al eliminar obra social',
      message: error.message,
    });
  }
};

// 6. ESTADÍSTICAS RÁPIDAS
export const getObrasSocialesStats = async (req, res, prisma) => {
  try {
    const [total, activas, sanMiguel] = await Promise.all([
      prisma.obraSocial.count(),
      prisma.obraSocial.count({ where: { estado: 'Activa' } }),
      prisma.obraSocial.count({ where: { atendibleSanMiguel: true } }),
    ]);

    res.status(200).json({ total, activas, sanMiguel });
  } catch (error) {
    console.error('❌ Error fetching OS stats:', error);
    res.status(500).json({
      error: 'Error al obtener estadísticas',
      message: error.message,
    });
  }
};
