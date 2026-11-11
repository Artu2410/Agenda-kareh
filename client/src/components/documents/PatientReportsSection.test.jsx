import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiGet, openPrintWindow } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  openPrintWindow: vi.fn(() => true),
}));

vi.mock('../../services/api', () => ({ default: { get: apiGet } }));
vi.mock('../../utils/documents/printDocument', async (importOriginal) => ({
  ...(await importOriginal()),
  openPrintWindow,
}));

import PatientReportsSection from './PatientReportsSection.jsx';

const savedReport = {
  id: 'rep1',
  title: 'Informe Kinésico Respiratorio',
  reportDate: '2026-11-10T00:00:00.000Z',
  professionalName: 'Lic. Romero',
  data: {
    title: 'Informe Kinésico Respiratorio',
    date: '2026-11-10',
    patient: { fullName: 'Pérez, Ana', dni: '30.111.222' },
    diagnosis: 'EPOC',
    techniques: [{ name: 'Kinesioterapia respiratoria', detail: '' }],
    professional: { fullName: 'Lic. Romero', licenseLine: 'MN 18900' },
  },
};

describe('PatientReportsSection', () => {
  beforeEach(() => {
    apiGet.mockReset();
    openPrintWindow.mockClear();
  });

  it('lista los informes guardados del paciente y los reimprime', async () => {
    apiGet.mockResolvedValue({ data: [savedReport] });

    render(<PatientReportsSection patientId="p1" />);

    expect(await screen.findByText('Informe Kinésico Respiratorio')).toBeInTheDocument();
    expect(screen.getByText('10/11/2026 · Lic. Romero')).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith('/reports', { params: { patientId: 'p1' } });

    fireEvent.click(screen.getByRole('button', { name: /reimprimir/i }));

    expect(openPrintWindow).toHaveBeenCalledTimes(1);
    expect(openPrintWindow.mock.calls[0][0]).toContain('Pérez, Ana');
    expect(openPrintWindow.mock.calls[0][0]).toContain('EPOC');
  });

  it('avisa cuando el paciente no tiene informes', async () => {
    apiGet.mockResolvedValue({ data: [] });

    render(<PatientReportsSection patientId="p1" />);

    await waitFor(() => expect(screen.getByText(/todavía no hay informes guardados/i)).toBeInTheDocument());
  });
});
