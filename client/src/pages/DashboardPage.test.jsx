import { render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import DashboardPage from './DashboardPage';
import { server } from '../tests/msw/server';
import { getApiUrl } from '../services/apiBase';

const metricsResponse = {
  weekly: {
    total: 3,
    scheduled: 2,
    completed: 1,
    noShow: 0,
    resolved: 1,
    respiratory: 0,
    iu: 0,
    percentage: 33.3,
    attendanceRate: 100,
  },
  monthly: {
    current: 12,
    previous: 9,
    scheduled: 8,
    completed: 3,
    noShow: 1,
    resolved: 4,
    attendanceRate: 75,
    change: 33.3,
    changeLabel: '+33.3%',
    label: 'Mayo 2026',
    insuranceBreakdown: [
      { name: 'PARTICULAR', count: 6 },
      { name: 'OSDE', count: 4 },
      { name: 'IOMA', count: 2 },
    ],
    respiratory: 0,
    iu: 0,
  },
  annual: {
    patientCount: 18,
    appointmentCount: 48,
    completedCount: 30,
    noShowCount: 3,
  },
  monthlyTrend: [
    {
      monthKey: '2026-04',
      month: 'ABR 26',
      label: 'Abril 2026',
      appointmentCount: 9,
      completedCount: 5,
      noShowCount: 1,
      scheduledCount: 3,
      resolvedCount: 6,
      attendanceRate: 83.3,
      insuranceBreakdown: [{ name: 'PARTICULAR', count: 5 }],
    },
    {
      monthKey: '2026-05',
      month: 'MAY 26',
      label: 'Mayo 2026',
      appointmentCount: 12,
      completedCount: 3,
      noShowCount: 1,
      scheduledCount: 8,
      resolvedCount: 4,
      attendanceRate: 75,
      insuranceBreakdown: [{ name: 'PARTICULAR', count: 6 }],
    },
  ],
  futureAgenda: {
    farthestDate: '2026-08-05T12:00:00.000Z',
    farthestLabel: 'miércoles 5 de agosto de 2026',
    appointmentCount: 6,
    patientCount: 4,
    activePatients: {
      total: 4,
      new: 2,
      recurrent: 2,
    },
    coverageByMonth: [
      {
        monthKey: '2026-05',
        month: 'MAY 26',
        label: 'Mayo 2026',
        appointmentCount: 1,
        patientCount: 1,
      },
      {
        monthKey: '2026-06',
        month: 'JUN 26',
        label: 'Junio 2026',
        appointmentCount: 2,
        patientCount: 2,
      },
      {
        monthKey: '2026-07',
        month: 'JUL 26',
        label: 'Julio 2026',
        appointmentCount: 2,
        patientCount: 1,
      },
      {
        monthKey: '2026-08',
        month: 'AGO 26',
        label: 'Agosto 2026',
        appointmentCount: 1,
        patientCount: 1,
      },
    ],
  },
};

describe('DashboardPage', () => {
  it('renders future agenda metrics and month coverage', async () => {
    server.use(
      http.get(getApiUrl('/metrics'), () => HttpResponse.json(metricsResponse)),
    );

    render(<DashboardPage />);

    expect(await screen.findByText('Agenda Futura')).toBeInTheDocument();
    expect(screen.getByText(/Cobertura de agenda/i)).toBeInTheDocument();
    expect(screen.getByText('Pacientes Activos')).toBeInTheDocument();
    expect(screen.getByText('miércoles 5 de agosto de 2026')).toBeInTheDocument();

    const futureCoverageSection = screen.getByText(/Cobertura de agenda/i).closest('section');
    expect(futureCoverageSection).toBeTruthy();
    expect(within(futureCoverageSection).getByText('Junio 2026')).toBeInTheDocument();
    expect(within(futureCoverageSection).getByText('Agosto 2026')).toBeInTheDocument();
  });
});
