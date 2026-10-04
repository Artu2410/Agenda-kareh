import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../services/api';
import CapacityPage from './CapacityPage';
import { getHistoricalAxisMax } from '../utils/capacityChart';

vi.mock('../services/api', () => ({
  default: { get: vi.fn() },
}));

vi.mock('../components/toastHelpers', () => ({
  showErrorToast: vi.fn(),
}));

describe('CapacityPage', () => {
  beforeEach(() => {
    api.get.mockResolvedValue({
      data: {
        currentMonth: {
          monthlyCapacity: 1120,
          weeklyCapacity: 250,
          completedCount: 15,
          occupiedCount: 15,
          freeMonthlyCapacity: 1105,
          occupancyRate: (15 / 1120) * 100,
          activePatients: 8,
          level: { label: 'Infrautilizado', tone: 'neutral' },
        },
        currentWeek: { capacity: 250 },
        futureCoverage: {},
        bottleneck: { key: 'DEMAND', label: 'Falta demanda' },
        alerts: {},
        monthlyTrend: Array.from({ length: 12 }, (_, index) => ({
          monthKey: `2026-${String(index + 1).padStart(2, '0')}`,
          month: `MES ${index + 1}`,
          label: `Mes ${index + 1} 2026`,
          capacity: 1000,
          occupiedCount: index + 1,
          attendedCount: index,
          occupancyRate: index / 10,
        })),
        professionals: [],
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('derives a readable left axis maximum from numeric historical capacities', () => {
    expect(getHistoricalAxisMax([
      { effectiveCapacity: 1120 },
      { effectiveCapacity: 1065 },
    ])).toBe(1200);
  });

  it('renders capacity and occupancy from the /capacity response without client-side recalculation', async () => {
    render(<CapacityPage />);

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/capacity'));
    expect(await screen.findByText('1.120')).toBeTruthy();
    expect(screen.getByText('250 turnos máximos por semana')).toBeTruthy();
    expect(screen.getAllByText('15', { selector: 'p' })).toHaveLength(2);
    expect(screen.getByText('1.105')).toBeTruthy();
    expect(screen.getByText('1,3%')).toBeTruthy();
    expect(screen.getByText('Turnos asistidos')).toBeTruthy();
    expect(screen.getAllByText('Turnos ocupados').length).toBeGreaterThan(0);
  });

  it('shows the complete annual monthly breakdown and can narrow the chart to six months', async () => {
    render(<CapacityPage />);

    expect(await screen.findByText('Detalle mensual')).toBeTruthy();
    expect(screen.getByText('Mes 1 2026')).toBeTruthy();
    expect(screen.getByText('Mes 12 2026')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Todo el año' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Últimos 6 meses' }));

    expect(screen.getByRole('button', { name: 'Últimos 6 meses' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('supports the legacy capacity response used by an older production backend', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        currentMonth: {
          monthlyCapacity: 216.5,
          appointmentCount: 109,
          completedCount: 15,
          freeMonthlyCapacity: 107.5,
          occupancyRate: 50.3,
          level: { label: 'Saludable', tone: 'success' },
        },
        currentWeek: { capacity: 50 },
        futureCoverage: {},
        bottleneck: {},
        alerts: {},
        monthlyTrend: [{
          monthKey: '2026-10',
          month: 'OCT 26',
          label: 'octubre 2026',
          capacity: 216.5,
          completedCount: 109,
          occupancyRate: 50.3,
        }],
        professionals: [{
          id: 'prof-1',
          fullName: 'Katia Alumine Romero',
          workSchedule: [],
          monthlyCapacity: 216.5,
          completedCount: 109,
          monthlyAppointmentCount: 109,
          occupancyRate: 50.3,
          level: { label: 'Saludable', tone: 'success' },
        }],
      },
    });

    render(<CapacityPage />);

    expect((await screen.findAllByText('109', { selector: 'p' })).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Turnos ocupados').length).toBeGreaterThan(0);
    expect(screen.getByText('octubre 2026')).toBeTruthy();
  });
});
