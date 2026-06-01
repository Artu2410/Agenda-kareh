import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppointmentModal from './AppointmentModal';
import { server } from '../tests/msw/server';
import { getApiUrl } from '../services/apiBase';

const baseAppointment = {
  id: 'apt-1',
  date: '2026-05-27T12:00:00.000Z',
  time: '10:00',
  status: 'SCHEDULED',
  isFirstSession: false,
  diagnosis: 'Rodilla',
  documentsChecklist: { documents: [], additionalInfo: '' },
  authorizationNumber: '',
  authorizationFileUrl: '',
  paidInAdvance: false,
  sessionToken: '',
  patient: {
    fullName: 'Juan Perez',
    dni: '12345678',
    phone: '111',
    birthDate: '1990-01-01',
    healthInsurance: 'OSDE',
    obraSocialId: '',
    treatAsParticular: false,
    affiliateNumber: 'A-123',
    hasCancer: false,
    hasMarcapasos: false,
    usesEA: false,
    usesWheelchair: false,
    isRespiratory: false,
    isIU: false,
  },
  professional: { fullName: 'Dra. Demo' },
};

describe('AppointmentModal', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('guarda evolución con obra social resuelta y token de asistencia', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    const onDelete = vi.fn();
    const onRefresh = vi.fn();
    let capturedPayload = null;

    server.use(
      http.get(getApiUrl('/obras-sociales'), () => HttpResponse.json([
        {
          id: 'osde-1',
          nombreOs: 'OSDE',
          isActive: true,
          requiresAuthorization: false,
          honorarioEstimado: 10000,
          percentageCoinsurance: 10,
          coseguroValor: 500,
          fixedCopay: 200,
          requiredDocuments: { documents: [], additionalInfo: '' },
        },
      ], { status: 200 })),
      http.patch(getApiUrl('/appointments/apt-1/evolution'), async ({ request }) => {
        capturedPayload = await request.json();
        return HttpResponse.json({ success: true }, { status: 200 });
      })
    );

    render(
      <AppointmentModal
        isOpen
        onClose={onClose}
        onSave={onSave}
        onDelete={onDelete}
        onRefresh={onRefresh}
        appointment={baseAppointment}
      />
    );

    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('osde-1'));

    fireEvent.click(screen.getByRole('button', { name: /asistió/i }));
    fireEvent.change(screen.getByPlaceholderText('Ingrese el número de token / validación'), {
      target: { value: 'TOKEN-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(capturedPayload).not.toBeNull());
    expect(capturedPayload.patientData).toMatchObject({
      obraSocialId: 'osde-1',
      healthInsurance: 'OSDE',
      treatAsParticular: false,
      affiliateNumber: 'A-123',
    });
    expect(capturedPayload.sessionToken).toBe('TOKEN-123');
    expect(capturedPayload.status).toBe('COMPLETED');
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('muestra error cuando la evolución falla', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    server.use(
      http.get(getApiUrl('/obras-sociales'), () => HttpResponse.json([
        {
          id: 'osde-1',
          nombreOs: 'OSDE',
          isActive: true,
          requiresAuthorization: false,
          requiredDocuments: { documents: [], additionalInfo: '' },
        },
      ], { status: 200 })),
      http.patch(getApiUrl('/appointments/apt-1/evolution'), () => HttpResponse.json({
        message: 'No se pudo guardar',
      }, { status: 400 }))
    );

    render(
      <AppointmentModal
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onRefresh={vi.fn()}
        appointment={baseAppointment}
      />
    );

    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('osde-1'));
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('No se pudo guardar'));
  });
});
