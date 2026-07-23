import {
  addBillingPayment,
  updateBillingInvoice,
} from '../src/controllers/billing.controller.js';

const createResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('billing controller', () => {
  it('rejects invoice total edits below already collected amount', async () => {
    const req = {
      params: { id: 'invoice-1' },
      body: {
        items: [
          { description: 'Prestaciones corregidas', quantity: 1, unitAmount: 100 },
        ],
      },
    };
    const res = createResponse();
    const prisma = {
      billingInvoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'invoice-1',
          totalAmount: 200,
          issueDate: new Date('2026-06-01T00:00:00.000Z'),
          payerType: 'OTHER',
          payerName: 'Pagador',
          status: 'ISSUED',
          payments: [{ amount: 150 }],
        }),
      },
      $transaction: jest.fn(),
    };

    await updateBillingInvoice(req, res, prisma);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'El total no puede ser menor a lo ya cobrado (150)',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('updates payer data and recalculates expected payment date', async () => {
    const req = {
      params: { id: 'invoice-1' },
      body: {
        payerType: 'OBRA_SOCIAL',
        obraSocialId: 'os-1',
        issueDate: '2026-06-01',
        expectedPaymentDate: '',
        items: [
          { description: 'Prestaciones corregidas', quantity: 2, unitAmount: 600 },
        ],
      },
    };
    const res = createResponse();
    const tx = {
      billingInvoiceItem: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      billingInvoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'invoice-1',
          totalAmount: 1200,
          expectedPaymentDate: new Date('2026-07-01T00:00:00.000Z'),
          status: 'ISSUED',
        }),
        update: jest.fn()
          .mockResolvedValueOnce({})
          .mockResolvedValueOnce({
            id: 'invoice-1',
            totalAmount: 1200,
            paidAmount: 0,
            status: 'ISSUED',
            items: [],
            payments: [],
          }),
      },
      billingPayment: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
      },
    };
    const prisma = {
      obraSocial: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'os-1',
          nombreOs: 'OSDE',
          plazoPago: 30,
        }),
      },
      billingInvoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'invoice-1',
          totalAmount: 1000,
          issueDate: new Date('2026-05-01T00:00:00.000Z'),
          payerType: 'OTHER',
          payerName: 'Pagador anterior',
          status: 'ISSUED',
          payments: [],
        }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };

    await updateBillingInvoice(req, res, prisma);

    const updateData = tx.billingInvoice.update.mock.calls[0][0].data;
    expect(updateData).toMatchObject({
      payerType: 'OBRA_SOCIAL',
      payerName: 'OSDE',
      obraSocialId: 'os-1',
      patientId: null,
      totalAmount: 1200,
    });
    expect(updateData.expectedPaymentDate.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('registers billing payments in Banco Provincia cash account', async () => {
    const req = {
      params: { id: 'invoice-1' },
      body: {
        amount: 500,
        paymentDate: '2026-06-10',
        paymentMethod: 'Banco Provincia',
      },
    };
    const res = createResponse();
    const tx = {
      cashFlow: {
        create: jest.fn().mockResolvedValue({ id: 'cashflow-1' }),
      },
      billingPayment: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 500 } }),
        create: jest.fn().mockResolvedValue({ id: 'payment-1' }),
      },
      billingInvoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'invoice-1',
          totalAmount: 1000,
          expectedPaymentDate: new Date('2026-07-01T00:00:00.000Z'),
          status: 'ISSUED',
        }),
        update: jest.fn().mockResolvedValue({
          id: 'invoice-1',
          totalAmount: 1000,
          paidAmount: 500,
          status: 'PARTIALLY_PAID',
          items: [],
          payments: [],
        }),
      },
    };
    const prisma = {
      billingInvoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'invoice-1',
          invoiceNumber: 'A-1',
          payerName: 'OSDE',
          totalAmount: 1000,
          paidAmount: 0,
          status: 'ISSUED',
        }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };

    await addBillingPayment(req, res, prisma);

    expect(tx.cashFlow.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentMethod: 'Banco Provincia',
        account: 'BANCO_PROVINCIA',
      }),
    });
    expect(tx.billingPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentMethod: 'Banco Provincia',
        account: 'BANCO_PROVINCIA',
      }),
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
