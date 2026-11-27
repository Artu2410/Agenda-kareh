import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiPost, printPatientReceipt } = vi.hoisted(() => ({
  apiPost: vi.fn(),
  printPatientReceipt: vi.fn(() => true),
}));

vi.mock('../../services/api', () => ({ default: { post: apiPost, get: vi.fn() } }));
vi.mock('./printReceipt', () => ({ printPatientReceipt }));
vi.mock('../toastHelpers', () => ({ showErrorToast: vi.fn(), showSuccessToast: vi.fn() }));

import PatientReceiptModal from './PatientReceiptModal.jsx';

const patient = { id: 'p1', fullName: 'Pérez, Ana', dni: '30111222', healthInsurance: 'Particular', appointments: [] };

describe('PatientReceiptModal', () => {
  beforeEach(() => {
    apiPost.mockReset();
    printPatientReceipt.mockClear();
  });

  it('calcula el total con precio por sesión × cantidad y lo envía', async () => {
    apiPost.mockResolvedValue({ data: { displayNumber: '0001-00000001', quantity: 10, unitPrice: 22000, amount: 220000 } });
    render(<PatientReceiptModal patient={patient} onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/10 sesiones/i), { target: { value: 'Sesiones de kinesiología' } });
    fireEvent.change(screen.getByLabelText('Precio por sesión'), { target: { value: '22.000' } });
    fireEvent.change(screen.getByLabelText('Cantidad de sesiones'), { target: { value: '10' } });

    expect(screen.getByTestId('receipt-total')).toHaveTextContent(/220\.000/);

    fireEvent.click(screen.getByRole('button', { name: /emitir e imprimir/i }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/receipts', expect.objectContaining({
      patientId: 'p1',
      unitPrice: 22000,
      quantity: 10,
    })));
    expect(printPatientReceipt).toHaveBeenCalled();
  });

  it('no emite con una cantidad inválida', async () => {
    render(<PatientReceiptModal patient={patient} onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/10 sesiones/i), { target: { value: 'x' } });
    fireEvent.change(screen.getByLabelText('Precio por sesión'), { target: { value: '22000' } });
    fireEvent.change(screen.getByLabelText('Cantidad de sesiones'), { target: { value: '0' } });

    expect(screen.getByText('Cantidad inválida')).toBeInTheDocument();
    expect(screen.getByTestId('receipt-total')).toHaveTextContent('—');
    fireEvent.click(screen.getByRole('button', { name: /emitir e imprimir/i }));
    await new Promise((resolve) => { setTimeout(resolve, 50); });
    expect(apiPost).not.toHaveBeenCalled();
  });
});
