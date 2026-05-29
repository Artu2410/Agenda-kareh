import {
  cashflowIdParamsSchema,
  createCashflowBodySchema,
  createTypedCashflowBodySchema,
} from '../src/validations/cashflowSchemas.js';

describe('cashflow schemas', () => {
  it('requires payment method for non-transfer movements', () => {
    const result = createCashflowBodySchema.safeParse({
      amount: '1000',
      category: 'Caja',
      concept: 'Pago de sesión',
      type: 'INCOME',
    });

    expect(result.success).toBe(false);
    expect(result.error.issues.some((issue) => issue.path.join('.') === 'paymentMethod')).toBe(true);
  });

  it('requires transfer accounts and rejects identical accounts', () => {
    const missingAccounts = createCashflowBodySchema.safeParse({
      amount: '1000',
      category: 'Caja',
      concept: 'Transferencia',
      type: 'TRANSFER',
    });
    const sameAccounts = createCashflowBodySchema.safeParse({
      amount: '1000',
      category: 'Caja',
      concept: 'Transferencia',
      type: 'TRANSFER',
      account: 'CASH',
      destinationAccount: 'CASH',
    });

    expect(missingAccounts.success).toBe(false);
    expect(missingAccounts.error.issues.some((issue) => issue.path.join('.') === 'account')).toBe(true);
    expect(missingAccounts.error.issues.some((issue) => issue.path.join('.') === 'destinationAccount')).toBe(true);

    expect(sameAccounts.success).toBe(false);
    expect(sameAccounts.error.issues.some((issue) => issue.message === 'La cuenta destino debe ser distinta')).toBe(true);
  });

  it('accepts typed cashflow payloads and validates ids', () => {
    const parsed = createTypedCashflowBodySchema.parse({
      amount: '1500',
      category: 'Honorarios',
      concept: 'Sesión particular',
      paymentMethod: 'Efectivo',
    });

    expect(parsed.paymentMethod).toBe('Efectivo');

    expect(cashflowIdParamsSchema.parse({ id: 'movimiento-123' })).toEqual({ id: 'movimiento-123' });
    expect(() => cashflowIdParamsSchema.parse({ id: 'abc' })).toThrow('Movimiento inválido');
  });
});
