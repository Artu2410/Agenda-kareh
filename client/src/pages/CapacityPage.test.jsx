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
        currentWeek: {
          capacity: 195,
          standardCapacity: 250,
          closures: [{ date: '2026-11-23', lostCapacity: 55, reasons: ['Feriado'] }],
        },
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
    expect(screen.queryByText(/turnos máximos por semana/)).toBeNull();
    expect(screen.getByText(/Esta semana .*: 195, 1 día\(s\) cerrado\(s\) · semana estándar: 250/)).toBeTruthy();
    expect(screen.getAllByText('15', { selector: 'p' })).toHaveLength(2);
    expect(screen.getByText('1.105')).toBeTruthy();
    expect(screen.getAllByText('1,3%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Turnos asistidos')).toBeTruthy();
    expect(screen.getByText('Turnos reservados')).toBeTruthy();
  });

  it('shows the reconciled month and never presents hiring without need data', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        currentMonth: {
          monthlyCapacity: 945,
          occupiedCount: 133,
          completedCount: 89,
          freeMonthlyCapacity: 812,
          occupancyRate: 14.1,
          isPartial: true,
          asOf: '2026-11-22',
          breakdown: {
            capacity: 945, attended: 89, noShow: 6, pendingPast: 10, upcoming: 28, otherStatus: 0, reserved: 133, free: 812, cancelled: 7,
          },
        },
        currentWeek: { capacity: 195, standardCapacity: 250, closures: [] },
        futureCoverage: { window: { occupancyRate: null } },
        operationalStatus: { key: 'AVAILABLE_CAPACITY', label: 'Capacidad disponible', tone: 'success' },
        bottleneck: { key: 'DEMAND', label: 'Falta demanda' },
        alerts: {
          admin: {
            status: 'INSUFFICIENT_DATA',
            recommended: false,
            label: 'Datos insuficientes para recomendar contratación',
            suggestedSupport: 'Automatización (recordatorios y confirmaciones)',
            criteria: [{ key: 'whatsapp', label: 'Consultas de WhatsApp por semana', measured: false, met: false }],
          },
        },
        monthlyTrend: [],
        professionals: [],
      },
    });

    render(<CapacityPage />);

    const reconciliation = await screen.findByLabelText('Conciliación de capacidad del mes');
    expect(reconciliation.textContent).toContain('Pasados sin cerrar10');
    expect(reconciliation.textContent).toContain('= Reservados133');
    expect(screen.getAllByText('Datos insuficientes para recomendar contratación').length).toBeGreaterThan(0);
    expect(screen.queryByText('Administrativo recomendado')).toBeNull();
    expect(screen.getByText('No disponible')).toBeTruthy();
    expect(screen.getByText('10 turnos pasados sin cerrar')).toBeTruthy();
  });

  it('recorre la saturación semana por semana con pacientes citados por día', async () => {
    const week = (offset, start, end, patients) => ({
      weekStart: start, weekEnd: end, offset, isCurrent: offset === 0, isFuture: offset > 0,
      capacity: 250, reserved: patients, patients, occupancyRate: patients / 2.5, closedDays: [], saturatedSlotCount: 0,
      topSlots: [{ dayOfWeek: 2, time: '17:30', reserved: patients, capacity: 5, occupancyRate: 40, saturated: false }],
      days: [{ dayOfWeek: 2, date: start.replace(/..$/, '17'), capacity: 20, reserved: patients, patients, occupancyRate: 20 }],
    });
    api.get.mockResolvedValueOnce({
      data: {
        currentMonth: {}, currentWeek: {}, futureCoverage: {}, bottleneck: {}, alerts: {}, monthlyTrend: [], professionals: [],
        weeklySaturation: [week(-1, '2026-11-08', '2026-11-14', 3), week(0, '2026-11-15', '2026-11-21', 7)],
      },
    });

    render(<CapacityPage />);

    expect(await screen.findByText('15/11 – 21/11')).toBeTruthy();
    expect(screen.getByText('Semana actual')).toBeTruthy();
    expect(screen.getByText('7 pacientes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Semana anterior' }));
    expect(screen.getByText('08/11 – 14/11')).toBeTruthy();
    expect(screen.getByText('3 pacientes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(screen.getByText('15/11 – 21/11')).toBeTruthy();
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
