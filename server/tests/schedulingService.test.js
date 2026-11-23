import { resequencePatientAppointments } from '../src/domain/appointments/scheduling.service.js';

const buildTx = (appointments) => ({
  appointment: {
    findMany: jest.fn().mockResolvedValue(appointments),
    update: jest.fn().mockResolvedValue({}),
  },
});

const apt = (id, sessionNumber, isFirstSession = false) => ({ id, sessionNumber, isFirstSession, date: new Date() });

describe('resequencePatientAppointments', () => {
  it('no escribe nada si la numeración ya es correcta', async () => {
    const tx = buildTx([apt('a1', 1, true), apt('a2', 2), apt('a3', 3)]);
    await resequencePatientAppointments(tx, 'p1');
    expect(tx.appointment.update).not.toHaveBeenCalled();
  });

  it('actualiza solo los turnos desfasados', async () => {
    // Se borró la sesión 2: la 3 pasa a ser la 2.
    const tx = buildTx([apt('a1', 1, true), apt('a3', 3)]);
    await resequencePatientAppointments(tx, 'p1');
    expect(tx.appointment.update).toHaveBeenCalledTimes(1);
    expect(tx.appointment.update).toHaveBeenCalledWith({
      where: { id: 'a3' },
      data: { sessionNumber: 2, isFirstSession: false },
      select: { id: true },
    });
  });

  it('abre un ciclo nuevo después de 10 sesiones y respeta un ingreso marcado', async () => {
    const list = Array.from({ length: 12 }, (_, i) => apt(`a${i + 1}`, 0));
    list[11].isFirstSession = true;
    const tx = buildTx(list);
    await resequencePatientAppointments(tx, 'p1');
    const numbers = Object.fromEntries(tx.appointment.update.mock.calls.map(([call]) => [call.where.id, call.data]));
    expect(numbers.a1).toEqual({ sessionNumber: 1, isFirstSession: true });
    expect(numbers.a10).toEqual({ sessionNumber: 10, isFirstSession: false });
    expect(numbers.a11).toEqual({ sessionNumber: 1, isFirstSession: true });
    expect(numbers.a12).toEqual({ sessionNumber: 1, isFirstSession: true });
  });
});
