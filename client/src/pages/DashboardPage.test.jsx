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
  it('renders the dashboard blocks in the new order', async () => {
    server.use(
      http.get(getApiUrl('/metrics'), () => HttpResponse.json(metricsResponse)),
    );

    render(<DashboardPage />);

    const futureSummaryHeading = await screen.findByRole('heading', { name: 'Cobertura futura', level: 2 });
    const futureCoverageHeading = screen.getByRole('heading', { name: 'Turnos futuros por mes', level: 2 });
    const currentMonthHeading = screen.getByRole('heading', { name: 'Mes completo del consultorio', level: 2 });
    const historicalChartHeading = screen.getByRole('heading', { name: 'Evolución del consultorio', level: 2 });
    const historicalTableHeading = screen.getByRole('heading', { name: 'Registro mensual del consultorio', level: 2 });
    const annualHeading = screen.getByRole('heading', { name: 'Resumen anual del consultorio', level: 2 });
    const futureSummarySection = futureSummaryHeading.closest('section');
    const futureCoverageSection = futureCoverageHeading.closest('section');
    const currentMonthSection = currentMonthHeading.closest('section');
    const historicalChartSection = historicalChartHeading.closest('section');
    const historicalTableSection = historicalTableHeading.closest('section');
    const annualSectionNode = annualHeading.closest('section');

    expect(futureSummaryHeading).toBeInTheDocument();
    expect(screen.getByText('Desde hoy')).toBeInTheDocument();
    expect(screen.getByText('Desde hoy hacia adelante')).toBeInTheDocument();
    expect(screen.getByText('1 de mayo 2026 - 31 de mayo 2026')).toBeInTheDocument();
    expect(screen.getByText('Desde 1 de enero 2026')).toBeInTheDocument();
    expect(screen.getByText('Año corrido (incluye agenda futura)')).toBeInTheDocument();
    expect(screen.getByText('Pacientes con agenda futura')).toBeInTheDocument();
    expect(screen.getByText('% del total futuro')).toBeInTheDocument();
    expect(screen.getByText('Cobertura de agenda')).toBeInTheDocument();

    expect(futureSummarySection).toBeTruthy();
    expect(futureCoverageSection).toBeTruthy();
    expect(currentMonthSection).toBeTruthy();
    expect(historicalChartSection).toBeTruthy();
    expect(historicalTableSection).toBeTruthy();
    expect(annualSectionNode).toBeTruthy();

    expect(within(currentMonthSection).getByText('Mes actual')).toBeInTheDocument();
    expect(within(historicalChartSection).getByText('Histórico de actividad')).toBeInTheDocument();
    expect(within(historicalTableSection).getByText('Histórico de actividad')).toBeInTheDocument();
    expect(within(historicalChartSection).getByText('Últimos 12 meses con actividad')).toBeInTheDocument();
    expect(within(historicalTableSection).getByText('Últimos 12 meses con actividad')).toBeInTheDocument();
    expect(within(futureCoverageSection).getByText('Pacientes únicos del mes')).toBeInTheDocument();
    expect(within(futureSummarySection).getByText('Días cubiertos')).toBeInTheDocument();
    expect(within(futureSummarySection).getByText('Semanas cubiertas')).toBeInTheDocument();
    expect(within(futureSummarySection).getByText('Meses cubiertos')).toBeInTheDocument();
    expect(within(futureSummarySection).getByText('+30 días')).toBeInTheDocument();
    expect(within(futureSummarySection).getByText('+60 días')).toBeInTheDocument();
    expect(within(futureSummarySection).getByText('+90 días')).toBeInTheDocument();

    const orderedSections = [
      futureSummarySection,
      futureCoverageSection,
      currentMonthSection,
      historicalChartSection,
      historicalTableSection,
      annualSectionNode,
    ];

    for (let index = 0; index < orderedSections.length - 1; index += 1) {
      expect(
        orderedSections[index].compareDocumentPosition(orderedSections[index + 1]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }

    expect(within(futureCoverageSection).getByText('Junio 2026')).toBeInTheDocument();
    expect(within(futureCoverageSection).getByText('Agosto 2026')).toBeInTheDocument();
    expect(within(futureCoverageSection).getAllByText('16.7%').length).toBeGreaterThan(0);
  });
});
