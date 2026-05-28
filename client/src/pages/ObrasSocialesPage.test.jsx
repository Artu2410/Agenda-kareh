import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ObrasSocialesPage from './ObrasSocialesPage';
import { server } from '../tests/msw/server';
import { getApiUrl } from '../services/apiBase';

const baseObrasSociales = [
  {
    id: 'osde-1',
    nombreOs: 'OSDE',
    codigoCokiba: '001',
    coseguroValor: 500,
    honorarioEstimado: 1000,
    fixedCopay: 200,
    plazoPago: 30,
    isActive: true,
    requiresAuthorization: false,
    atendibleSanMiguel: false,
    cokibaDetails: {
      areaCobertura: 'Provincia de Buenos Aires',
      coseguroTexto: '$500',
      links: [{ href: 'https://example.com/osde', text: 'Convenio' }],
    },
    requiredDocuments: { documents: [], additionalInfo: '' },
  },
  {
    id: 'swiss-2',
    nombreOs: 'Swiss Medical',
    codigoCokiba: '002',
    coseguroValor: 800,
    honorarioEstimado: 1200,
    fixedCopay: 250,
    plazoPago: 45,
    isActive: true,
    requiresAuthorization: false,
    atendibleSanMiguel: true,
    cokibaDetails: {
      areaCobertura: 'San Miguel / Bella Vista',
      coseguroTexto: '$800',
      links: [{ href: 'https://example.com/swiss', text: 'Validación afiliatoria' }],
    },
    requiredDocuments: { documents: [], additionalInfo: '' },
  },
  {
    id: 'ioma-3',
    nombreOs: 'IOMA',
    codigoCokiba: '003',
    coseguroValor: 300,
    honorarioEstimado: 900,
    fixedCopay: 150,
    plazoPago: 60,
    isActive: false,
    requiresAuthorization: true,
    atendibleSanMiguel: false,
    cokibaDetails: {
      areaCobertura: 'Provincia de Buenos Aires',
      coseguroTexto: '$300',
      links: [{ href: 'https://example.com/ioma', text: 'Autorización' }],
    },
    requiredDocuments: { documents: [], additionalInfo: '' },
  },
];

const installHandlers = () => {
  server.use(
    http.get(getApiUrl('/obras-sociales'), ({ request }) => {
      const url = new URL(request.url);
      const isActive = url.searchParams.get('isActive');
      const requiresAuthorization = url.searchParams.get('requiresAuthorization');
      const zona = url.searchParams.get('zona');

      let list = [...baseObrasSociales];

      if (isActive === 'true') {
        list = list.filter((obraSocial) => obraSocial.isActive);
      } else if (isActive === 'false') {
        list = list.filter((obraSocial) => !obraSocial.isActive);
      }

      if (requiresAuthorization === 'true') {
        list = list.filter((obraSocial) => obraSocial.requiresAuthorization);
      }

      if (zona === 'san-miguel') {
        list = list.filter((obraSocial) => obraSocial.atendibleSanMiguel);
      }

      return HttpResponse.json(list);
    }),
    http.get(getApiUrl('/obras-sociales/stats'), () => HttpResponse.json({
      total: baseObrasSociales.length,
      activas: baseObrasSociales.filter((obraSocial) => obraSocial.isActive).length,
      sanMiguel: baseObrasSociales.filter((obraSocial) => obraSocial.atendibleSanMiguel).length,
      requierenAutorizacion: baseObrasSociales.filter((obraSocial) => obraSocial.requiresAuthorization).length,
    })),
    http.get(getApiUrl('/obras-sociales/status'), () => HttpResponse.json({
      total: baseObrasSociales.length,
      activas: 2,
      lastSyncAt: '2026-05-28T10:00:00.000Z',
      syncing: false,
      lastSyncedRecord: 'IOMA',
      config: {
        configured: true,
        canSync: true,
        missingFields: [],
        placeholderFields: [],
        accessMode: 'private',
      },
    })),
    http.get(getApiUrl('/obras-sociales/coinsurance-report'), ({ request }) => {
      const url = new URL(request.url);
      const month = url.searchParams.get('month') || '2026-05';
      return HttpResponse.json({
        month,
        totalAmount: 25000,
        rows: [
          {
            obraSocialId: 'osde-1',
            obraSocialName: 'OSDE',
            appointmentCount: 3,
            totalAmount: 15000,
          },
        ],
      });
    })
  );
};

describe('ObrasSocialesPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installHandlers();
  });

  it('muestra resultados y filtra por búsqueda', async () => {
    render(<ObrasSocialesPage />);

    await screen.findByRole('table');
    const getTable = () => within(screen.getByRole('table'));
    expect(getTable().getByText('OSDE')).toBeInTheDocument();
    expect(getTable().getByText('Swiss Medical')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/buscar obra social por nombre o código/i), {
      target: { value: 'swiss' },
    });

    expect(getTable().getByText('Swiss Medical')).toBeInTheDocument();
    expect(getTable().queryByText('OSDE')).not.toBeInTheDocument();
  });

  it('refresca la vista al cambiar el filtro de estado', async () => {
    render(<ObrasSocialesPage />);

    await screen.findByRole('table');
    const getTable = () => within(screen.getByRole('table'));
    expect(getTable().getByText('OSDE')).toBeInTheDocument();
    expect(getTable().getByText('Swiss Medical')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Activas'), {
      target: { value: 'inactive' },
    });

    await waitFor(() => expect(getTable().getByText('IOMA')).toBeInTheDocument());
    expect(getTable().queryByText('OSDE')).not.toBeInTheDocument();
    expect(getTable().queryByText('Swiss Medical')).not.toBeInTheDocument();
  });
});
