import {
  buildMonthlyHonorariosReport,
  isAgreementInsuranceForMonthlyHonorarios,
  resolveAppointmentHonorario,
} from '../src/utils/monthlyHonorariosReport.js';

describe('monthly honorarios report', () => {
  it('uses the stored honorario from the appointment when available', () => {
    expect(resolveAppointmentHonorario({
      coinsuranceDetails: { honorario: 2400 },
      obraSocial: { honorarioEstimado: 1800 },
    })).toBe(2400);
  });

  it('does not fallback to the current obra social amount when no snapshot exists', () => {
    expect(resolveAppointmentHonorario({
      coinsuranceDetails: null,
      obraSocial: { honorarioEstimado: 1800 },
    })).toBe(0);
  });

  it('filters out PAMI, OSDE and inactive insurances', () => {
    expect(isAgreementInsuranceForMonthlyHonorarios({
      obraSocial: { nombreOs: 'PAMI', isActive: true, isArchived: false, honorarioEstimado: 1000 },
    })).toBe(false);

    expect(isAgreementInsuranceForMonthlyHonorarios({
      obraSocial: { nombreOs: 'OSDE 210', isActive: true, isArchived: false, honorarioEstimado: 1000 },
    })).toBe(false);

    expect(isAgreementInsuranceForMonthlyHonorarios({
      obraSocial: { nombreOs: 'IOMA', isActive: false, isArchived: false, honorarioEstimado: 1000 },
    })).toBe(false);
  });

  it('builds totals only for active agreement insurances with honorarios', () => {
    const rows = buildMonthlyHonorariosReport([
      {
        obraSocialId: 'os-1',
        coinsuranceDetails: { honorario: 2000 },
        obraSocial: {
          nombreOs: 'IOMA',
          honorarioEstimado: 1800,
          isActive: true,
          isArchived: false,
        },
      },
      {
        obraSocialId: 'os-1',
        coinsuranceDetails: { honorario: 2000 },
        obraSocial: {
          nombreOs: 'IOMA',
          honorarioEstimado: 1800,
          isActive: true,
          isArchived: false,
        },
      },
      {
        obraSocialId: 'os-3',
        coinsuranceDetails: { honorario: 3000 },
        obraSocial: {
          nombreOs: 'PAMI',
          honorarioEstimado: 3000,
          isActive: true,
          isArchived: false,
        },
      },
    ]);

    expect(rows).toEqual([
      {
        obraSocialId: 'os-1',
        obraSocialName: 'IOMA',
        totalAmount: 4000,
        appointmentCount: 2,
        bonusDetails: [],
        bonusTotal: 0,
      },
    ]);
  });

  it('extracts bonus values from the obra social details without changing the base total', () => {
    const rows = buildMonthlyHonorariosReport([
      {
        obraSocialId: 'os-1',
        coinsuranceDetails: { honorario: 3830 },
        obraSocial: {
          nombreOs: 'IOMA',
          isActive: true,
          isArchived: false,
          cokibaDetails: {
            coseguroTexto: 'Coseguro: Bono de 10 sesiones:$ 10.000 y Bono de 5 sesiones $ 5.000',
          },
        },
      },
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        obraSocialId: 'os-1',
        obraSocialName: 'IOMA',
        totalAmount: 3830,
        appointmentCount: 1,
        bonusTotal: 15000,
        bonusDetails: [
          {
            label: 'Bono 10 sesiones',
            sessions: 10,
            amount: 10000,
          },
          {
            label: 'Bono 5 sesiones',
            sessions: 5,
            amount: 5000,
          },
        ],
      }),
    ]);
  });
});
