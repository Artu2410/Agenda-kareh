import { claimSlotNumber, lockScheduleKeys } from '../src/controllers/AppointmentController.js';

const buildTx = (rows) => ({
  appointment: {
    findMany: jest.fn().mockResolvedValue(rows),
    update: jest.fn().mockResolvedValue({}),
  },
});

const base = { date: new Date('2026-12-01T12:00:00'), time: '10:00', professionalId: 'pr1', capacityPerSlot: 3 };

describe('claimSlotNumber', () => {
  it('elige el primer número libre', async () => {
    const tx = buildTx([{ id: 'a', slotNumber: 1, status: 'SCHEDULED' }]);
    await expect(claimSlotNumber(tx, base)).resolves.toBe(2);
    expect(tx.appointment.update).not.toHaveBeenCalled();
  });

  it('devuelve null cuando el horario está lleno', async () => {
    const tx = buildTx([1, 2, 3].map((n) => ({ id: `a${n}`, slotNumber: n, status: 'SCHEDULED' })));
    await expect(claimSlotNumber(tx, base)).resolves.toBeNull();
  });

  it('reutiliza el número de un turno cancelado estacionándolo en negativo', async () => {
    const tx = buildTx([
      { id: 'c1', slotNumber: 1, status: 'CANCELLED' },
      { id: 'c0', slotNumber: -1, status: 'CANCELLED' },
    ]);
    await expect(claimSlotNumber(tx, base)).resolves.toBe(1);
    expect(tx.appointment.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { slotNumber: -2 },
      select: { id: true },
    });
  });

  it('al reprogramar excluye el propio turno de la búsqueda', async () => {
    const tx = buildTx([]);
    await claimSlotNumber(tx, { ...base, excludeId: 'self' });
    expect(tx.appointment.findMany.mock.calls[0][0].where.id).toEqual({ not: 'self' });
  });
});

describe('lockScheduleKeys', () => {
  it('toma un bloqueo por clave, sin repetir y en orden estable', async () => {
    const calls = [];
    const tx = { $queryRaw: jest.fn(async (strings, key) => { calls.push(key); return [{ locked: 1 }]; }) };
    await lockScheduleKeys(tx, ['b', null, 'a', 'b']);
    expect(calls).toEqual(['a', 'b']);
  });

  it('no falla si el cliente no soporta SQL crudo (mocks)', async () => {
    await expect(lockScheduleKeys({}, ['a'])).resolves.toBeUndefined();
  });
});
