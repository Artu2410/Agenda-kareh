import {
  createAgendaCalendarEntry,
  listAgendaCalendarEntries,
  updateAgendaCalendarEntry,
} from '../src/controllers/agendaCalendar.controller.js';

const createResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('agenda calendar entries', () => {
  it('lists active and inactive entries in the requested date range', async () => {
    const entries = [{ id: 'calendar-1', date: '2026-10-12', type: 'CLINIC_CLOSURE' }];
    const prisma = {
      agendaConfig: {
        findFirst: jest.fn().mockResolvedValue({ nationalHolidaysClose: true }),
      },
      agendaCalendarEntry: {
        findMany: jest.fn().mockResolvedValue(entries),
      },
    };
    const req = { query: { from: '2026-10-01', to: '2026-10-31' } };
    const res = createResponse();

    await listAgendaCalendarEntries(req, res, prisma);

    expect(prisma.agendaCalendarEntry.findMany).toHaveBeenCalledWith({
      where: { date: { gte: '2026-10-01', lte: '2026-10-31' } },
      orderBy: [{ date: 'asc' }, { name: 'asc' }],
    });
    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining(entries[0]),
      expect.objectContaining({
        date: '2026-10-12',
        type: 'NATIONAL_HOLIDAY',
        entrySource: 'NATIONAL_HOLIDAY_CALENDAR',
        isOperational: false,
      }),
    ]));
  });

  it('creates a global non-operational holiday from validated input', async () => {
    const created = { id: 'calendar-1', date: '2026-10-12', name: 'Feriado de prueba' };
    const prisma = {
      agendaCalendarEntry: {
        create: jest.fn().mockResolvedValue(created),
      },
    };
    const req = {
      body: {
        date: '2026-10-12',
        name: ' Feriado de prueba ',
        type: 'CLINIC_CLOSURE',
      },
    };
    const res = createResponse();

    await createAgendaCalendarEntry(req, res, prisma);

    expect(prisma.agendaCalendarEntry.create).toHaveBeenCalledWith({
      data: {
        date: '2026-10-12',
        name: 'Feriado de prueba',
        type: 'CLINIC_CLOSURE',
        isActive: true,
        isOperational: false,
        professionalId: null,
      },
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);
  });

  it('rejects operational overrides for entries other than schedule exceptions', async () => {
    const prisma = { agendaCalendarEntry: { create: jest.fn() } };
    const req = {
      body: {
        date: '2026-10-12',
        name: 'Feriado abierto',
        type: 'NATIONAL_HOLIDAY',
        isOperational: true,
      },
    };
    const res = createResponse();

    await createAgendaCalendarEntry(req, res, prisma);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.agendaCalendarEntry.create).not.toHaveBeenCalled();
  });

  it('updates only provided calendar entry fields', async () => {
    const updated = { id: 'calendar-1', isActive: false };
    const prisma = {
      agendaCalendarEntry: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'calendar-1',
          date: '2026-10-12',
          name: 'Día abierto',
          type: 'SCHEDULE_EXCEPTION',
          isActive: true,
          isOperational: false,
          professionalId: null,
        }),
        update: jest.fn().mockResolvedValue(updated),
      },
    };
    const req = { params: { id: 'calendar-1' }, body: { isActive: false } };
    const res = createResponse();

    await updateAgendaCalendarEntry(req, res, prisma);

    expect(prisma.agendaCalendarEntry.update).toHaveBeenCalledWith({
      where: { id: 'calendar-1' },
      data: { isActive: false },
    });
    expect(res.json).toHaveBeenCalledWith(updated);
  });

  it('rejects changing an operational exception into a holiday while retaining its operational flag', async () => {
    const prisma = {
      agendaCalendarEntry: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'calendar-1',
          date: '2026-10-12',
          name: 'Reabre Kareh',
          type: 'SCHEDULE_EXCEPTION',
          isActive: true,
          isOperational: true,
          professionalId: null,
        }),
        update: jest.fn(),
      },
    };
    const req = {
      params: { id: 'calendar-1' },
      body: { type: 'CLINIC_CLOSURE' },
    };
    const res = createResponse();

    await updateAgendaCalendarEntry(req, res, prisma);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.agendaCalendarEntry.update).not.toHaveBeenCalled();
  });
});