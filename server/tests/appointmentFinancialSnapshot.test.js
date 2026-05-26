import { buildStoredFinancialSnapshot, resolveStoredHonorarioAmount } from '../src/utils/appointmentFinancialSnapshot.js';

describe('appointment financial snapshot', () => {
  it('preserves stored amounts when the appointment keeps the same coverage', () => {
    const snapshot = buildStoredFinancialSnapshot({
      currentAppointment: {
        obraSocialId: 'os-1',
        coinsuranceAmount: 1200,
        patientChargeAmount: 1200,
        coinsuranceDetails: {
          honorario: 7000,
          total: 1200,
        },
      },
      nextObraSocialId: 'os-1',
      nextCharge: {
        honorario: 9000,
        total: 1800,
      },
    });

    expect(snapshot).toEqual({
      coinsuranceAmount: 1200,
      patientChargeAmount: 1200,
      coinsuranceDetails: {
        honorario: 7000,
        total: 1200,
      },
    });
  });

  it('recalculates stored amounts when the coverage changes', () => {
    const snapshot = buildStoredFinancialSnapshot({
      currentAppointment: {
        obraSocialId: 'os-1',
        coinsuranceAmount: 1200,
        patientChargeAmount: 1200,
        coinsuranceDetails: {
          honorario: 7000,
          total: 1200,
        },
      },
      nextObraSocialId: 'os-2',
      nextCharge: {
        honorario: 9000,
        total: 1800,
      },
    });

    expect(snapshot).toEqual({
      coinsuranceAmount: 1800,
      patientChargeAmount: 1800,
      coinsuranceDetails: {
        honorario: 9000,
        total: 1800,
      },
    });
  });

  it('reads the stored honorario snapshot without consulting current obra social values', () => {
    expect(resolveStoredHonorarioAmount({
      coinsuranceDetails: { honorario: 4200 },
      obraSocial: { honorarioEstimado: 9500 },
    })).toBe(4200);
  });
});
