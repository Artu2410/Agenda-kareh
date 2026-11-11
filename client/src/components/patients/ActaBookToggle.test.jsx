import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiPatch } = vi.hoisted(() => ({ apiPatch: vi.fn() }));
vi.mock('../../services/api', () => ({ default: { patch: apiPatch } }));

import ActaBookToggle from './ActaBookToggle.jsx';

const pendingPatient = { id: 'p1', fullName: 'Pérez, Ana', actaBookRecordedAt: null, actaBookFolio: null };
const recordedPatient = { ...pendingPatient, actaBookRecordedAt: '2026-11-10T15:00:00.000Z', actaBookFolio: '12' };

describe('ActaBookToggle', () => {
  beforeEach(() => apiPatch.mockReset());

  it('marca al paciente como pasado al libro', async () => {
    apiPatch.mockResolvedValue({ data: { actaBookRecordedAt: '2026-11-11T15:00:00.000Z', actaBookFolio: null } });
    const onChange = vi.fn();

    render(<ActaBookToggle patient={pendingPatient} onChange={onChange} />);
    expect(screen.getByText('Pendiente')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /libro de actas/i }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ actaBookRecordedAt: '2026-11-11T15:00:00.000Z', actaBookFolio: null }));
    expect(apiPatch).toHaveBeenCalledWith('/patients/p1/acta-book', { recorded: true, folio: null });
  });

  it('guarda el folio al salir del campo', async () => {
    apiPatch.mockResolvedValue({ data: { actaBookRecordedAt: recordedPatient.actaBookRecordedAt, actaBookFolio: '13' } });

    render(<ActaBookToggle patient={recordedPatient} />);
    const folio = screen.getByRole('textbox', { name: /folio/i });
    expect(folio).toHaveValue('12');

    fireEvent.change(folio, { target: { value: '13' } });
    fireEvent.blur(folio);

    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/patients/p1/acta-book', { recorded: true, folio: '13' }));
  });

  it('pide confirmación antes de desmarcar', async () => {
    apiPatch.mockResolvedValue({ data: { actaBookRecordedAt: null, actaBookFolio: null } });
    const onRequestUnmark = vi.fn();

    render(<ActaBookToggle patient={recordedPatient} onRequestUnmark={onRequestUnmark} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /libro de actas/i }));

    expect(apiPatch).not.toHaveBeenCalled();
    expect(onRequestUnmark).toHaveBeenCalledTimes(1);

    await onRequestUnmark.mock.calls[0][0]();
    expect(apiPatch).toHaveBeenCalledWith('/patients/p1/acta-book', { recorded: false, folio: null });
  });
});
