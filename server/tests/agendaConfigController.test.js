import { getAgendaConfig, updateAgendaConfig } from '../src/controllers/agendaController.js';

const createResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('national holiday agenda policy', () => {
  it('defaults new agenda configuration to closing national public holidays', async () => {
    const config = { nationalHolidaysClose: true };
    const prisma = {
      agendaConfig: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(config),
      },
    };
    const res = createResponse();

    await getAgendaConfig({}, res, prisma);

    expect(prisma.agendaConfig.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ nationalHolidaysClose: true }),
    });
    expect(res.json).toHaveBeenCalledWith(config);
  });

  it('persists an explicit change to the holiday closure policy', async () => {
    const existing = { id: 'config-1', nationalHolidaysClose: true };
    const updated = { ...existing, nationalHolidaysClose: false };
    const prisma = {
      agendaConfig: {
        findFirst: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockResolvedValue(updated),
      },
    };
    const res = createResponse();

    await updateAgendaConfig({ body: { nationalHolidaysClose: false } }, res, prisma);

    expect(prisma.agendaConfig.update).toHaveBeenCalledWith({
      where: { id: 'config-1' },
      data: { nationalHolidaysClose: false },
    });
    expect(res.json).toHaveBeenCalledWith(updated);
  });
});
