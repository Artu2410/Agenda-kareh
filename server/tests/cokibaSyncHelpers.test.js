import {
  COKIBA_AUTHORIZATION_TYPES,
  buildCokibaSnapshotRecord,
  computeCokibaDiff,
  deriveCokibaAuthorizationType,
  getNextCokibaSyncRunAt,
  summarizeCokibaDiff,
} from '../src/services/cokibaSyncHelpers.js';

describe('cokiba sync helpers', () => {
  it('classifies authorization types from extracted text', () => {
    expect(
      deriveCokibaAuthorizationType({
        authorizationNote: 'A partir de febrero 2026 es obligatorio la utilización de token',
      })
    ).toBe(COKIBA_AUTHORIZATION_TYPES.TOKEN_ONLINE);

    expect(
      deriveCokibaAuthorizationType({
        authorizationNote: 'La autorización previa debe ser realizada presencialmente en la filial',
      })
    ).toBe(COKIBA_AUTHORIZATION_TYPES.PRESENCIAL);

    expect(
      deriveCokibaAuthorizationType({
        authorizationNote: 'La validación de las prestaciones será únicamente a través de la plataforma web de COKIBA',
      })
    ).toBe(COKIBA_AUTHORIZATION_TYPES.COKIBA_SISTEMA);
  });

  it('builds a normalized snapshot record', () => {
    const snapshot = buildCokibaSnapshotRecord({
      codigoCokiba: 'ABC123',
      nombreOs: 'OSDE',
      estado: 'Activa',
      isActive: 1,
      requiresAuthorization: 'true',
      authorizationType: 'COKIBA_SISTEMA',
      coseguroValor: '2500.500',
      honorarioEstimado: '4200.125',
      percentageCoinsurance: '12.3',
      fixedCopay: '99.9',
      plazoPago: '60',
      atendibleSanMiguel: 1,
      rawCategoria: 'Básica',
    });

    expect(snapshot).toMatchObject({
      codigoCokiba: 'ABC123',
      nombreOs: 'OSDE',
      isActive: true,
      requiresAuthorization: true,
      authorizationType: 'COKIBA_SISTEMA',
      coseguroValor: 2500.5,
      honorarioEstimado: 4200.13,
      percentageCoinsurance: 12.3,
      fixedCopay: 99.9,
      plazoPago: 60,
      atendibleSanMiguel: true,
    });
  });

  it('detects additions, removals and changes in the diff', () => {
    const diff = computeCokibaDiff(
      [
        {
          codigoCokiba: 'OS1',
          nombreOs: 'OS Uno',
          estado: 'Activa',
          isActive: true,
          requiresAuthorization: true,
          authorizationType: 'COKIBA_SISTEMA',
          coseguroValor: 1000,
          honorarioEstimado: 2500,
        },
        {
          codigoCokiba: 'OS2',
          nombreOs: 'OS Dos',
          estado: 'Activa',
          isActive: true,
          requiresAuthorization: false,
          authorizationType: 'PRESENCIAL',
          coseguroValor: 500,
          honorarioEstimado: 1800,
        },
      ],
      [
        {
          codigoCokiba: 'OS1',
          nombreOs: 'OS Uno',
          estado: 'Suspendida',
          isActive: false,
          requiresAuthorization: true,
          authorizationType: 'TOKEN_ONLINE',
          coseguroValor: 1300,
          honorarioEstimado: 2500,
        },
        {
          codigoCokiba: 'OS3',
          nombreOs: 'OS Tres',
          estado: 'Activa',
          isActive: true,
          requiresAuthorization: false,
          authorizationType: 'COKIBA_SISTEMA',
          coseguroValor: 800,
          honorarioEstimado: 1900,
        },
      ]
    );

    expect(diff.added).toHaveLength(1);
    expect(diff.removed).toHaveLength(1);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].changes.map((change) => change.field)).toEqual(
      expect.arrayContaining(['estado', 'isActive', 'authorizationType', 'coseguroValor'])
    );

    const summary = summarizeCokibaDiff(diff);
    expect(summary).toMatchObject({
      addedCount: 1,
      removedCount: 1,
      changedCount: 1,
      activeToInactive: 1,
      inactiveToActive: 0,
      honorarioChanges: 1,
      authorizationChanges: 1,
      hasChanges: true,
    });
  });

  it('counts percentage coinsurance and fixed copay as fee changes', () => {
    const summary = summarizeCokibaDiff({
      added: [],
      removed: [],
      changed: [
        {
          codigoCokiba: 'OS1',
          nombreOs: 'OS Uno',
          changes: [
            { field: 'percentageCoinsurance', before: 10, after: 15 },
            { field: 'fixedCopay', before: 500, after: 750 },
          ],
        },
      ],
    });

    expect(summary).toMatchObject({
      changedCount: 1,
      honorarioChanges: 2,
      hasChanges: true,
    });
  });

  it('pushes the next daily sync to tomorrow when the time already passed', () => {
    const baseDate = new Date(2026, 4, 31, 4, 0, 0, 0);
    const nextRun = getNextCokibaSyncRunAt('03:15', baseDate);

    expect(nextRun.getFullYear()).toBe(2026);
    expect(nextRun.getMonth()).toBe(5);
    expect(nextRun.getDate()).toBe(1);
    expect(nextRun.getHours()).toBe(3);
    expect(nextRun.getMinutes()).toBe(15);
  });
});
