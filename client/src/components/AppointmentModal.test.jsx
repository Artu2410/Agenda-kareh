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

  it('mantiene uniformes los botones de días semanales', async () => {
    server.use(
      http.get(getApiUrl('/obras-sociales'), () => HttpResponse.json([{
        id: 'osde-1',
        nombreOs: 'OSDE',
        isActive: true,
        requiresAuthorization: false,
        requiredDocuments: { documents: [], additionalInfo: '' },
      }], { status: 200 }))
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

    ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'].forEach((label) => {
      const button = screen.getByRole('button', { name: label });
      expect(button.className).toContain('min-h-11');
      expect(button.className).toContain('w-full');
      expect(button.className).toContain('px-2');
      expect(button.className).toContain('py-3');
    });
  });
});

describe('AppointmentModal · último turno, token y ciclos', () => {
  const appointmentWithPatient = {
    ...baseAppointment,
    patientId: 'pat-1',
    professionalId: 'pro-1',
    sessionToken: 'TOK-VIEJO',
  };
  const lastFutureAppointment = {
    id: 'apt-1',
    date: '2026-05-27T12:00:00.000Z',
    time: '10:00',
    sessionNumber: 3,
  };

  const useDefaultHandlers = (overrides = []) => server.use(
    http.get(getApiUrl('/obras-sociales'), () => HttpResponse.json([], { status: 200 })),
    http.get(getApiUrl('/patients/pat-1/future-appointments'), () => HttpResponse.json([lastFutureAppointment])),
    http.get(getApiUrl('/patients/pat-1/session-cycles'), () => HttpResponse.json({
      cycles: [
        {
          cycleNumber: 1,
          state: 'INTERRUPTED',
          from: '2026-03-02T12:00:00.000Z',
          to: '2026-03-06T12:00:00.000Z',
          totalSessions: 3,
          attended: 3,
          noShow: 0,
          pending: 0,
          unmarked: 0,
          sessions: [
            { id: 's1', date: '2026-03-02T12:00:00.000Z', time: '10:00', status: 'COMPLETED', sessionNumber: 1 },
            { id: 's2', date: '2026-03-04T12:00:00.000Z', time: '10:00', status: 'COMPLETED', sessionNumber: 2 },
            { id: 's3', date: '2026-03-06T12:00:00.000Z', time: '10:00', status: 'COMPLETED', sessionNumber: 3 },
          ],
        },
      ],
      years: [{ year: 2026, totalCompleted: 3 }],
    })),
    ...overrides,
  );

  const renderModal = () => render(
    <AppointmentModal
      isOpen
      onClose={vi.fn()}
      onSave={vi.fn()}
      onDelete={vi.fn()}
      onRefresh={vi.fn()}
      appointment={appointmentWithPatient}
    />
  );

  it('deja editar el último turno aunque se muestre la vista previa de sesiones a programar', async () => {
    useDefaultHandlers();
    renderModal();

    expect(await screen.findByRole('button', { name: /editar sesión futura/i })).toBeInTheDocument();
    expect(screen.getByText(/a programar/i)).toBeInTheDocument();
  });

  it('muestra en cuántas sesiones quedó un ciclo cortado y sus fechas', async () => {
    useDefaultHandlers();
    renderModal();

    expect(await screen.findByText(/quedó en 3 de 10 sesiones/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ciclo 1/i }));
    expect(screen.getAllByText(/asistió/i).length).toBeGreaterThanOrEqual(3);
  });

  it('permite borrar el token del turno', async () => {
    let capturedPayload = null;
    useDefaultHandlers([
      http.patch(getApiUrl('/appointments/apt-1/evolution'), async ({ request }) => {
        capturedPayload = await request.json();
        return HttpResponse.json({ success: true });
      }),
    ]);
    renderModal();

    const tokenInput = await screen.findByPlaceholderText('Ingrese el número de token / validación');
    await waitFor(() => expect(tokenInput).toHaveValue('TOK-VIEJO'));
    fireEvent.change(tokenInput, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(capturedPayload).not.toBeNull());
    expect(capturedPayload.sessionToken).toBe('');
  });

  it('una sesión agregada no hereda el token del turno', async () => {
    let createdPayload = null;
    useDefaultHandlers([
      http.post(getApiUrl('/appointments'), async ({ request }) => {
        createdPayload = await request.json();
        return HttpResponse.json({ appointments: [] }, { status: 201 });
      }),
    ]);
    renderModal();

    fireEvent.click(await screen.findByTitle('Agregar sesión individual'));
    fireEvent.click(screen.getByRole('button', { name: /^agendar$/i }));

    await waitFor(() => expect(createdPayload).not.toBeNull());
    expect(createdPayload).not.toHaveProperty('sessionToken');
  });
});
