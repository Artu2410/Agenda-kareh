import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiGet, apiDelete, printPatientReceipt } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiDelete: vi.fn(),
  printPatientReceipt: vi.fn(() => true),
}));

vi.mock('../../services/api', () => ({ default: { get: apiGet, delete: apiDelete } }));
vi.mock('./printReceipt', () => ({ printPatientReceipt }));

import PatientReceiptsSection from './PatientReceiptsSection.jsx';

const receipt = {
  id: 'r1',
  displayNumber: '0001-00000042',
  issueDate: '2026-11-10T12:00:00.000Z',
  description: 'Sesiones de kinesiología',
  patientName: 'Pérez, Ana',
  amount: 15000.5,
};

describe('PatientReceiptsSection', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiDelete.mockReset();
    printPatientReceipt.mockClear();
  });

  it('muestra solo los comprobantes del paciente y permite reimprimir', async () => {
    apiGet.mockResolvedValue({ data: [receipt] });

    render(<PatientReceiptsSection patientId="p1" />);

    expect(await screen.findByText('Sesiones de kinesiología')).toBeInTheDocument();
    expect(screen.getByText(/0001-00000042/)).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith('/receipts', { params: { patientId: 'p1', limit: 200 } });

    fireEvent.click(screen.getByRole('button', { name: /reimprimir comprobante/i }));
    expect(printPatientReceipt).toHaveBeenCalledWith(receipt);
  });

  it('avisa cuando el paciente no tiene comprobantes', async () => {
    apiGet.mockResolvedValue({ data: [] });

    render(<PatientReceiptsSection patientId="p1" />);

    expect(await screen.findByText(/todavía no se emitieron comprobantes/i)).toBeInTheDocument();
  });

  it('no ofrece eliminar comprobantes que el servidor marca como no eliminables', async () => {
    apiGet.mockResolvedValue({ data: [{ ...receipt, canDelete: false }] });

    render(<PatientReceiptsSection patientId="p1" />);

    expect(await screen.findByText('Sesiones de kinesiología')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /eliminar comprobante/i })).not.toBeInTheDocument();
  });

  it('elimina un comprobante después de confirmar', async () => {
    apiGet.mockResolvedValue({ data: [{ ...receipt, canDelete: true }] });
    apiDelete.mockResolvedValue({});

    render(<PatientReceiptsSection patientId="p1" />);
    fireEvent.click(await screen.findByRole('button', { name: /eliminar comprobante/i }));

    expect(apiDelete).not.toHaveBeenCalled();
    const dialog = await screen.findByText(/se eliminará el comprobante/i);
    const modal = dialog.closest('[role="dialog"]') || document.body;
    fireEvent.click(within(modal).getByRole('button', { name: /^eliminar$/i }));

    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/receipts/r1'));
    await waitFor(() => expect(screen.queryByText('Sesiones de kinesiología')).not.toBeInTheDocument());
  });
});
