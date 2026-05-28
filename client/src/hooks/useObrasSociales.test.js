import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useObrasSociales } from './useObrasSociales';
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

describe('useObrasSociales', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installHandlers();
  });

  it('carga datos, filtra por búsqueda y responde a cambios de filtro/orden', async () => {
    const { result } = renderHook(() => useObrasSociales());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.obrasSociales).toHaveLength(2);
    expect(result.current.filtered[0].nombreOs).toBe('OSDE');
    expect(result.current.filtered[1].nombreOs).toBe('Swiss Medical');

    act(() => {
      result.current.setSearch('swiss');
    });
    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].nombreOs).toBe('Swiss Medical');

    act(() => {
      result.current.handleSort('coseguroValor');
    });
    expect(result.current.sortField).toBe('coseguroValor');
    expect(result.current.filtered[0].nombreOs).toBe('Swiss Medical');

    act(() => {
      result.current.handleSort('coseguroValor');
    });
    expect(result.current.sortDir).toBe('desc');

    act(() => {
      result.current.setSearch('');
      result.current.setFiltroEstado('inactive');
    });

    await waitFor(() => expect(result.current.obrasSociales).toHaveLength(1));
    expect(result.current.obrasSociales[0].nombreOs).toBe('IOMA');
    expect(result.current.filtered[0].nombreOs).toBe('IOMA');
  });

  it('maneja respuestas vacías sin romper filtros ni estado derivado', async () => {
    server.use(
      http.get(getApiUrl('/obras-sociales'), () => HttpResponse.json([])),
      http.get(getApiUrl('/obras-sociales/stats'), () => HttpResponse.json({
        total: 0,
        activas: 0,
        sanMiguel: 0,
        requierenAutorizacion: 0,
      })),
      http.get(getApiUrl('/obras-sociales/status'), () => HttpResponse.json({
        total: 0,
        activas: 0,
        lastSyncAt: null,
        syncing: false,
        lastSyncedRecord: null,
        config: {
          configured: false,
          canSync: false,
          missingFields: [],
          placeholderFields: [],
          accessMode: 'private',
        },
      })),
      http.get(getApiUrl('/obras-sociales/coinsurance-report'), ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          month: url.searchParams.get('month') || '2026-05',
          totalAmount: 0,
          rows: [],
        });
      })
    );

    const { result } = renderHook(() => useObrasSociales());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.obrasSociales).toEqual([]);
    expect(result.current.filtered).toEqual([]);
    expect(result.current.stats.total).toBe(0);
    expect(result.current.syncStatus.config.configured).toBe(false);
  });

  it('deja la grilla vacía cuando falla la carga principal', async () => {
    server.use(
      http.get(getApiUrl('/obras-sociales'), () => HttpResponse.json({ message: 'error' }, { status: 500 })),
      http.get(getApiUrl('/obras-sociales/stats'), () => HttpResponse.json({
        total: 0,
        activas: 0,
        sanMiguel: 0,
        requierenAutorizacion: 0,
      })),
      http.get(getApiUrl('/obras-sociales/status'), () => HttpResponse.json({
        total: 0,
        activas: 0,
        lastSyncAt: null,
        syncing: false,
        lastSyncedRecord: null,
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
        return HttpResponse.json({
          month: url.searchParams.get('month') || '2026-05',
          totalAmount: 0,
          rows: [],
        });
      })
    );

    const { result } = renderHook(() => useObrasSociales());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.obrasSociales).toEqual([]);
    expect(result.current.filtered).toEqual([]);
  });
});
