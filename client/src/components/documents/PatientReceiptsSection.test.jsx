import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiGet, printPatientReceipt } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  printPatientReceipt: vi.fn(() => true),
}));

vi.mock('../../services/api', () => ({ default: { get: apiGet } }));
vi.mock('./printReceipt', () => ({ printPatientReceipt }));

import PatientReceiptsSection from './PatientReceiptsSection.jsx';

const receipt = {
  id: 'r1',
  displayNumber: '0001-00000042',
  issueDate: '2026-11-10T12:00:00.000Z',
  description: 'Sesiones de kinesiología',
  amount: 15000.5,
};

describe('PatientReceiptsSection', () => {
  beforeEach(() => {
    apiGet.mockReset();
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
});
