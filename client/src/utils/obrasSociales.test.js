import { describe, expect, it } from 'vitest';
import { extractBonusAmounts, getCokibaDetails } from './obrasSociales';

describe('obras sociales utils', () => {
  it('extracts IOMA bonus amounts from the coverage text', () => {
    expect(extractBonusAmounts(
      'Coseguro: Bono de 10 sesiones:$ 10.000 y Bono de 5 sesiones $ 5.000'
    )).toEqual([
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
    ]);
  });

  it('includes bonus amounts in the normalized COKIBA details payload', () => {
    expect(getCokibaDetails({
      cokibaDetails: {
        coseguroTexto: 'Bono de 10 sesiones:$ 10.000 y Bono de 5 sesiones $ 5.000',
        observaciones: 'Nota extra',
      },
    })).toEqual(expect.objectContaining({
      bonusTotal: 15000,
      bonusAmounts: [
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
    }));
  });
});
