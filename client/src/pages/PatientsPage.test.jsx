import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import PatientsPage from './PatientsPage';
import { server } from '../tests/msw/server';
import { getApiUrl } from '../services/apiBase';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

describe('PatientsPage', () => {
  it('carga pacientes, filtra por búsqueda y abre el alta', async () => {
    server.use(
      http.get(getApiUrl('/patients/all'), () => HttpResponse.json([
        { id: 'patient-1', fullName: 'Ana Perez', dni: '12345678', healthInsurance: 'OSDE' },
        { id: 'patient-2', fullName: 'Bruno Diaz', dni: '87654321', healthInsurance: 'Particular' },
      ])),
      http.get(getApiUrl('/obras-sociales'), () => HttpResponse.json([])),
    );

    render(<PatientsPage />);

    await waitFor(() => expect(screen.getAllByText('Ana Perez').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Bruno Diaz').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre, DNI u obra social...'), {
      target: { value: 'Bruno' },
    });

    expect(screen.queryByText('Ana Perez')).not.toBeInTheDocument();
    expect(screen.getAllByText('Bruno Diaz').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /nuevo paciente/i }));
    expect(screen.getByRole('heading', { name: 'Nuevo Paciente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar paciente' })).toBeInTheDocument();
  });
});
