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
        obraSocialId: 'os-2',
        coinsuranceDetails: null,
        obraSocial: {
          nombreOs: 'SWISS MEDICAL',
          honorarioEstimado: 1500,
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
      },
      {
        obraSocialId: 'os-2',
        obraSocialName: 'SWISS MEDICAL',
        totalAmount: 1500,
        appointmentCount: 1,
      },
    ]);
  });
});
