import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiGet, apiPost, apiPut, openPrintWindow } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  openPrintWindow: vi.fn(() => true),
}));

vi.mock('../../services/api', () => ({ default: { get: apiGet, post: apiPost, put: apiPut } }));
vi.mock('../../services/session', () => ({ getStoredUser: () => ({}) }));
vi.mock('../toastHelpers', () => ({ showErrorToast: vi.fn(), showSuccessToast: vi.fn() }));
vi.mock('../../utils/documents/printDocument', async (importOriginal) => ({
  ...(await importOriginal()),
  openPrintWindow,
}));

import KinesicReportModal from './KinesicReportModal.jsx';

const patient = { id: 'p1', fullName: 'Pérez, Ana', dni: '30111222', clinicalRecordNumber: 12 };

const savedReport = {
  id: 'rep1',
  patientId: 'p1',
  professionalId: 'pr1',
  type: 'fkt',
  title: 'Informe Kinésico',
  reportDate: '2026-11-10T00:00:00.000Z',
  data: {
    title: 'Informe Kinésico',
    date: '2026-11-10',
    diagnosis: 'Lumbalgia',
    physician: 'Dr. Gómez',
    anamnesis: 'dolor lumbar dsde hace tres mese',
    sessions: '10',
    metricsIn: [{ label: 'Nivel del Dolor (EVA)', suffix: '/ 10', value: '8' }],
    metricsOut: [{ label: 'Nivel del Dolor (EVA)', suffix: '/ 10', value: '2' }],
    techniques: [{ name: 'Magnetoterapia (MGT)', detail: 'mejoria notable' }],
    dischargeStatus: 'Buena evolución',
    plan: 'Continuar ejercicios',
  },
};

describe('KinesicReportModal en modo edición', () => {
  beforeEach(() => {
    apiGet.mockReset().mockResolvedValue({ data: [{ id: 'pr1', fullName: 'Lic. Romero', licenseNumber: '18900' }] });
    apiPost.mockReset();
    apiPut.mockReset();
    openPrintWindow.mockClear();
  });

  it('carga el informe guardado y guarda los cambios sin crear uno nuevo', async () => {
    apiPut.mockResolvedValue({ data: { ...savedReport } });
    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(<KinesicReportModal patient={patient} report={savedReport} onClose={onClose} onSaved={onSaved} />);

    expect(screen.getByText('Editar informe kinésico')).toBeInTheDocument();
    expect(screen.getByDisplayValue('dolor lumbar dsde hace tres mese')).toBeInTheDocument();
    expect(screen.getByDisplayValue('8')).toBeInTheDocument();
    await screen.findByRole('option', { name: 'Lic. Romero' });

    fireEvent.change(screen.getByDisplayValue('Lumbalgia'), { target: { value: 'Lumbalgia crónica' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(apiPut).toHaveBeenCalledTimes(1));
    const [url, body] = apiPut.mock.calls[0];
    expect(url).toBe('/reports/rep1');
    expect(body.data.diagnosis).toBe('Lumbalgia crónica');
    expect(body.data.metricsIn[0].value).toBe('8');
    expect(body.professionalId).toBe('pr1');
    expect(apiPost).not.toHaveBeenCalled();
    expect(openPrintWindow).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalled();
  });

  it('corrige la ortografía de los textos del informe', async () => {
    apiPost.mockResolvedValue({
      data: {
        texts: {
          anamnesis: 'Dolor lumbar desde hace tres meses.',
          'technique.0.detail': 'Mejoría notable.',
        },
      },
    });

    render(<KinesicReportModal patient={patient} report={savedReport} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /corregir ortografía/i }));

    expect(await screen.findByDisplayValue('Dolor lumbar desde hace tres meses.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Mejoría notable.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Lumbalgia')).toBeInTheDocument();

    const [url, body] = apiPost.mock.calls[0];
    expect(url).toBe('/reports/spellcheck');
    expect(body.texts).toMatchObject({
      diagnosis: 'Lumbalgia',
      anamnesis: 'dolor lumbar dsde hace tres mese',
      'technique.0.name': 'Magnetoterapia (MGT)',
    });
  });
});
