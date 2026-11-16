import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AppointmentCycleHistory from './AppointmentCycleHistory';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const cycles = [{
  cycleNumber: 1,
  state: 'IN_PROGRESS',
  from: '2026-11-05T12:00:00.000Z',
  to: '2026-11-10T12:00:00.000Z',
  totalSessions: 2,
  attended: 1,
  pending: 1,
  sessions: [
    { id: 'a1', date: '2026-11-05T12:00:00.000Z', time: '18:00', status: 'COMPLETED', sessionNumber: 1, sessionToken: 'TK-1' },
    { id: 'a2', date: '2026-11-10T12:00:00.000Z', time: '18:00', status: 'SCHEDULED', sessionNumber: 2, sessionToken: null },
  ],
}];

describe('AppointmentCycleHistory tokens', () => {
  it('shows the tokens of the cycle and saves a new one from the session row', async () => {
    const onSaveToken = vi.fn().mockResolvedValue(undefined);
    render(<AppointmentCycleHistory cycles={cycles} onSaveToken={onSaveToken} />);

    expect(screen.getByText(/1\/2 tokens/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ciclo 1/i }));
    expect(screen.getByText('TK-1')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Cargar token'));
    fireEvent.change(screen.getByLabelText('Token de la sesión 2'), { target: { value: 'TK-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar token' }));

    await waitFor(() => expect(onSaveToken).toHaveBeenCalledWith('a2', 'TK-2'));
  });
});
