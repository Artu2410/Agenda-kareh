import { createInternalError } from '../errors/AppError.js';
import { isCalendarDateOperational } from '../domain/metrics/capacity.service.js';
import { getHolidaysForDateRange } from '../services/holidayCalendar.service.js';

const CALENDAR_ENTRY_TYPES = new Set([
  'CLINIC_CLOSURE',
  'SCHEDULE_EXCEPTION',
]);

const isDateKey = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
};

const validateCalendarEntryInput = (input = {}, { partial = false } = {}) => {
  const data = {};

  if (!partial || input.date !== undefined) {
    if (!isDateKey(input.date)) return { error: 'date debe ser una fecha válida con formato YYYY-MM-DD.' };
    data.date = input.date;
  }

  if (!partial || input.name !== undefined) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name || name.length > 120) return { error: 'name es obligatorio y debe tener como máximo 120 caracteres.' };
    data.name = name;
  }

  if (!partial || input.type !== undefined) {
    const type = String(input.type || '').toUpperCase();
    if (!CALENDAR_ENTRY_TYPES.has(type)) return { error: 'type debe ser CLINIC_CLOSURE o SCHEDULE_EXCEPTION.' };
    data.type = type;
  }

  for (const field of ['isActive', 'isOperational']) {
    if (input[field] !== undefined) {
      if (typeof input[field] !== 'boolean') return { error: `${field} debe ser booleano.` };
      data[field] = input[field];
    }
  }

  if (input.professionalId !== undefined) {
    if (input.professionalId !== null && typeof input.professionalId !== 'string') {
      return { error: 'professionalId debe ser una cadena o null.' };
    }
    data.professionalId = input.professionalId || null;
  }

  const resolvedType = data.type || input.type;
  const resolvedOperational = data.isOperational ?? input.isOperational;
  if (resolvedOperational === true && resolvedType !== 'SCHEDULE_EXCEPTION') {
    return { error: 'Solo una SCHEDULE_EXCEPTION puede habilitar operación.' };
  }

  return { data };
};

const validateProfessionalScope = async (prisma, professionalId) => {
  if (!professionalId || !prisma.professional?.findUnique) return true;
  const professional = await prisma.professional.findUnique({
    where: { id: professionalId },
    select: { id: true },
  });
  return Boolean(professional);
};

export const listAgendaCalendarEntries = async (req, res, prisma) => {
  const { from, to, professionalId = null } = req.query || {};
  if ((from && !isDateKey(from)) || (to && !isDateKey(to))) {
    return res.status(400).json({ message: 'from y to deben tener formato YYYY-MM-DD.' });
  }
  if (from && to && from > to) {
    return res.status(400).json({ message: 'from no puede ser posterior a to.' });
  }

  const where = {};
  if (from || to) {
    where.date = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  try {
    const [entries, agendaConfig] = await Promise.all([
      prisma.agendaCalendarEntry.findMany({
      where,
      orderBy: [{ date: 'asc' }, { name: 'asc' }],
      }),
      prisma.agendaConfig?.findFirst ? prisma.agendaConfig.findFirst() : Promise.resolve(null),
    ]);
    const startDate = from || `${new Date().getFullYear()}-01-01`;
    const endDate = to || `${new Date().getFullYear() + 1}-12-31`;
    const nationalHolidaysClose = agendaConfig?.nationalHolidaysClose !== false;
    const holidays = (await getHolidaysForDateRange(startDate, endDate, { nationalHolidaysClose })).map((holiday) => ({
      ...holiday,
      id: `national-holiday:${holiday.date}:${holiday.name}`,
      isActive: true,
      isOperational: !holiday.affectsOperation,
      professionalId: null,
      entrySource: 'NATIONAL_HOLIDAY_CALENDAR',
    }));
    const allEntries = [...entries, ...holidays].sort((left, right) => (
      left.date.localeCompare(right.date) || left.name.localeCompare(right.name)
    ));
    const entriesByDate = new Map();
    allEntries.forEach((entry) => {
      const dateEntries = entriesByDate.get(entry.date) || [];
      dateEntries.push(entry);
      entriesByDate.set(entry.date, dateEntries);
    });
    return res.status(200).json(allEntries.map((entry) => {
      const dateEntries = entriesByDate.get(entry.date) || [];
      const isOperationalForScope = isCalendarDateOperational({
        date: entry.date,
        professionalId,
        calendarEntries: dateEntries,
        holidays: dateEntries.filter((dateEntry) => dateEntry.entrySource === 'NATIONAL_HOLIDAY_CALENDAR'),
        agendaConfig: { nationalHolidaysClose },
      });
      return {
        ...entry,
        isOperationalForScope,
        isClosedForScope: !isOperationalForScope,
      };
    }));
  } catch (error) {
    throw createInternalError(error, 'Error al obtener excepciones de agenda');
  }
};

export const createAgendaCalendarEntry = async (req, res, prisma) => {
  const validation = validateCalendarEntryInput(req.body);
  if (validation.error) return res.status(400).json({ message: validation.error });

  try {
    if (!(await validateProfessionalScope(prisma, validation.data.professionalId))) {
      return res.status(400).json({ message: 'El profesional indicado no existe.' });
    }

    const entry = await prisma.agendaCalendarEntry.create({
      data: {
        isActive: true,
        isOperational: false,
        professionalId: null,
        ...validation.data,
      },
    });
    return res.status(201).json(entry);
  } catch (error) {
    throw createInternalError(error, 'Error al crear excepción de agenda');
  }
};

export const updateAgendaCalendarEntry = async (req, res, prisma) => {
  const validation = validateCalendarEntryInput(req.body, { partial: true });
  if (validation.error) return res.status(400).json({ message: validation.error });
  if (Object.keys(validation.data).length === 0) {
    return res.status(400).json({ message: 'Debe enviarse al menos un campo para actualizar.' });
  }

  try {
    const existingEntry = await prisma.agendaCalendarEntry.findUnique({
      where: { id: req.params.id },
    });
    if (!existingEntry) return res.status(404).json({ message: 'La excepción de agenda no existe.' });

    const mergedValidation = validateCalendarEntryInput({ ...existingEntry, ...validation.data });
    if (mergedValidation.error) return res.status(400).json({ message: mergedValidation.error });

    if (!(await validateProfessionalScope(prisma, validation.data.professionalId))) {
      return res.status(400).json({ message: 'El profesional indicado no existe.' });
    }

    const entry = await prisma.agendaCalendarEntry.update({
      where: { id: req.params.id },
      data: validation.data,
    });
    return res.status(200).json(entry);
  } catch (error) {
    throw createInternalError(error, 'Error al actualizar excepción de agenda');
  }
};

export const deleteAgendaCalendarEntry = async (req, res, prisma) => {
  try {
    await prisma.agendaCalendarEntry.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (error) {
    throw createInternalError(error, 'Error al eliminar excepción de agenda');
  }
};
