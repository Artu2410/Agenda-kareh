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

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Obra Social' })).toHaveValue('osde-1'));

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

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Obra Social' })).toHaveValue('osde-1'));
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

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Obra Social' })).toHaveValue('osde-1'));

    ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'].forEach((label) => {
      const button = screen.getByRole('button', { name: label });
      expect(button.className).toContain('min-h-11');
      expect(button.className).toContain('w-full');
      expect(button.className).toContain('px-2');
      expect(button.className).toContain('py-3');
    });
  });
});

describe('AppointmentModal · Nuevo Turno y ficha del paciente', () => {
  const existingPatient = {
    id: 'pat-9',
    dni: '30111222',
    fullName: 'Gomez Ana Maria',
    phone: '1155550000',
    birthDate: '1980-03-15T00:00:00.000Z',
    healthInsurance: '',
    obraSocialId: '',
    treatAsParticular: false,
    affiliateNumber: '',
    address: 'Av. Siempre Viva 742',
    locality: 'Moreno, Buenos Aires',
    email: 'ana@example.com',
    emergencyPhone: '1144443333',
    cudNumber: '',
    hasCancer: true,
  };

  const useNewTurnHandlers = ({ onCreate } = {}) => server.use(
    http.get(getApiUrl('/obras-sociales'), () => HttpResponse.json([])),
    http.get(getApiUrl('/patients/search'), ({ request }) => {
      const dni = new URL(request.url).searchParams.get('dni');
      return HttpResponse.json(dni === existingPatient.dni ? existingPatient : null);
    }),
    http.get(getApiUrl('/patients/pat-9/session-cycles'), () => HttpResponse.json({ cycles: [], years: [] })),
    http.post(getApiUrl('/appointments'), async ({ request }) => {
      onCreate?.(await request.json());
      return HttpResponse.json({ appointments: [] }, { status: 201 });
    }),
  );

  const renderNewTurn = () => render(
    <AppointmentModal
      isOpen
      onClose={vi.fn()}
      onSave={vi.fn()}
      onDelete={vi.fn()}
      onRefresh={vi.fn()}
      selectedSlot={{ date: '2026-05-27', time: '10:00' }}
      professional={{ id: 'pro-1', fullName: 'Dra. Demo' }}
    />
  );

  const typeDni = (value) => fireEvent.change(screen.getByLabelText('DNI del Paciente'), { target: { value } });

  it('ordena el formulario en los bloques pedidos', () => {
    useNewTurnHandlers();
    renderNewTurn();

    const titles = screen.getAllByRole('region').map((node) => node.getAttribute('aria-label'));
    expect(titles).toEqual([
      'Horario y paciente',
      'Datos personales y cobertura',
      'Ficha del paciente',
      'Sesiones y planificación',
      'Información clínica',
      'Documentación',
    ]);
    expect(screen.getByText('Guardá el turno para poder adjuntar DNI, credencial y CUD.')).toBeInTheDocument();
    expect(screen.getByText('Usa la cobertura cargada')).toBeInTheDocument();
  });

  it('paciente existente: trae domicilio, contacto, condiciones y edad desde la ficha', async () => {
    useNewTurnHandlers();
    renderNewTurn();

    typeDni('30111222');

    expect(await screen.findByText(/paciente existente/i, {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByLabelText('Dirección')).toHaveValue('Av. Siempre Viva 742');
    expect(screen.getByLabelText('Localidad')).toHaveValue('Moreno, Buenos Aires');
    expect(screen.getByLabelText('Email')).toHaveValue('ana@example.com');
    expect(screen.getByLabelText('Teléfono')).toHaveValue('1155550000');
    expect(screen.getByLabelText('Teléfono de emergencia')).toHaveValue('1144443333');
    expect(screen.getByLabelText('Apellido')).toHaveValue('Gomez');
    expect(screen.getByLabelText('Fecha de Nacimiento')).toHaveValue('1980-03-15');
    expect(screen.getByText(/\d+ años/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /oncológico/i })).toBeChecked();
  });

  it('no borra lo ya tipeado cuando la ficha tiene ese dato vacío', async () => {
    useNewTurnHandlers();
    renderNewTurn();

    fireEvent.change(screen.getByLabelText('Número de CUD'), { target: { value: 'CUD-77' } });
    typeDni('30111222');

    expect(await screen.findByText(/paciente existente/i, {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByLabelText('Número de CUD')).toHaveValue('CUD-77');
    expect(screen.getByLabelText('Dirección')).toHaveValue('Av. Siempre Viva 742');
  });

  it('paciente nuevo después de uno existente: no arrastra la ficha anterior', async () => {
    useNewTurnHandlers();
    renderNewTurn();

    typeDni('30111222');
    expect(await screen.findByText(/paciente existente/i, {}, { timeout: 2000 })).toBeInTheDocument();

    typeDni('40999888');
    expect(await screen.findByText(/paciente nuevo/i, {}, { timeout: 2000 })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Dirección')).toHaveValue(''));
    expect(screen.getByLabelText('Apellido')).toHaveValue('');
    expect(screen.getByLabelText('DNI del Paciente')).toHaveValue('40999888');
  });

  it('alta de paciente nuevo: envía la ficha completa con el turno', async () => {
    let createdPayload = null;
    useNewTurnHandlers({ onCreate: (payload) => { createdPayload = payload; } });
    renderNewTurn();

    typeDni('40999888');
    expect(await screen.findByText(/paciente nuevo/i, {}, { timeout: 2000 })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Lopez' } });
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByLabelText('Dirección'), { target: { value: 'Calle 1 123' } });
    fireEvent.change(screen.getByLabelText('Localidad'), { target: { value: 'Merlo' } });
    fireEvent.change(screen.getByLabelText('Número de CUD'), { target: { value: 'CUD-1' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar y agendar/i }));

    await waitFor(() => expect(createdPayload).not.toBeNull());
    expect(createdPayload.patientData).toMatchObject({
      dni: '40999888',
      fullName: 'Lopez Juan',
      address: 'Calle 1 123',
      locality: 'Merlo',
      cudNumber: 'CUD-1',
    });
    expect(createdPayload.isFirstSession).toBe(true);
    expect(createdPayload.professionalId).toBe('pro-1');
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

  it('deja editar el último turno y no muestra fechas que el paciente todavía no reservó', async () => {
    useDefaultHandlers();
    renderModal();

    expect(await screen.findByRole('button', { name: /editar sesión futura/i })).toBeInTheDocument();
    expect(screen.queryByText(/a programar/i)).not.toBeInTheDocument();
  });

  it('muestra en cuántas sesiones quedó un ciclo abandonado y sus fechas', async () => {
    useDefaultHandlers();
    renderModal();

    expect(await screen.findByText(/abandonó · 3 de 3 sesiones asistidas/i)).toBeInTheDocument();
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

  it('marca a mano que el paciente abandonó el tratamiento', async () => {
    let capturedPayload = null;
    useDefaultHandlers([
      http.patch(getApiUrl('/appointments/apt-1/evolution'), async ({ request }) => {
        capturedPayload = await request.json();
        return HttpResponse.json({ success: true });
      }),
    ]);
    renderModal();

    const toggle = await screen.findByRole('button', { name: /paciente abandonó tratamiento/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(capturedPayload).not.toBeNull());
    expect(capturedPayload.treatmentAbandoned).toBe(true);
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
