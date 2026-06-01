jest.mock('../src/services/cokibaSync.js', () => ({
  __esModule: true,
  getCokibaSyncStatus: jest.fn(),
  isCokibaSyncRunning: jest.fn(),
  runCokibaSync: jest.fn(),
}));

jest.mock('../src/utils/audit.js', () => ({
  __esModule: true,
  auditActions: {},
  safeWriteAuditLog: jest.fn(),
}));

import { getCoinsuranceReport } from '../src/controllers/obrasSociales.controller.js';

const createResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('obras sociales controller', () => {
  it('includes billable scheduled appointments in the monthly report', async () => {
    const appointments = [
      {
        id: 'sancor-1',
        date: new Date('2026-06-01T15:00:00.000Z'),
        time: '19:00',
        slotNumber: 1,
        patientId: 'patient-1',
        sessionNumber: 7,
        isFirstSession: false,
        status: 'COMPLETED',
        patientChargeAmount: '0',
        coinsuranceAmount: '0',
        coinsuranceDetails: {
          total: 0,
          baseCopay: 0,
          honorario: 11264,
          fixedCopay: 0,
          percentage: 0,
          percentageAmount: 0,
        },
        obraSocialId: 'os-sancor',
        obraSocial: {
          nombreOs: 'SANCOR',
          honorarioEstimado: '11828',
          isActive: true,
          isArchived: false,
          statusManualOverride: false,
          cokibaDetails: {
            observaciones: 'NO POSEE',
            coseguroTexto: 'NO POSEE',
          },
        },
      },
      {
        id: 'sancor-2',
        date: new Date('2026-06-03T15:00:00.000Z'),
        time: '19:00',
        slotNumber: 2,
        patientId: 'patient-1',
        sessionNumber: 8,
        isFirstSession: false,
        status: 'SCHEDULED',
        patientChargeAmount: '0',
        coinsuranceAmount: '0',
        coinsuranceDetails: {
          total: 0,
          baseCopay: 0,
          honorario: 11264,
          fixedCopay: 0,
          percentage: 0,
          percentageAmount: 0,
        },
        obraSocialId: 'os-sancor',
        obraSocial: {
          nombreOs: 'SANCOR',
          honorarioEstimado: '11828',
          isActive: true,
          isArchived: false,
          statusManualOverride: false,
          cokibaDetails: {
            observaciones: 'NO POSEE',
            coseguroTexto: 'NO POSEE',
          },
        },
      },
      {
        id: 'sancor-3',
        date: new Date('2026-06-05T15:00:00.000Z'),
        time: '19:00',
        slotNumber: 3,
        patientId: 'patient-1',
        sessionNumber: 9,
        isFirstSession: false,
        status: 'SCHEDULED',
        patientChargeAmount: '0',
        coinsuranceAmount: '0',
        coinsuranceDetails: {
          total: 0,
          baseCopay: 0,
          honorario: 11264,
          fixedCopay: 0,
          percentage: 0,
          percentageAmount: 0,
        },
        obraSocialId: 'os-sancor',
        obraSocial: {
          nombreOs: 'SANCOR',
          honorarioEstimado: '11828',
          isActive: true,
          isArchived: false,
          statusManualOverride: false,
          cokibaDetails: {
            observaciones: 'NO POSEE',
            coseguroTexto: 'NO POSEE',
          },
        },
      },
      {
        id: 'sancor-4',
        date: new Date('2026-06-08T15:00:00.000Z'),
        time: '19:00',
        slotNumber: 4,
        patientId: 'patient-1',
        sessionNumber: 10,
        isFirstSession: false,
        status: 'SCHEDULED',
        patientChargeAmount: '0',
        coinsuranceAmount: '0',
        coinsuranceDetails: {
          total: 0,
          baseCopay: 0,
          honorario: 11264,
          fixedCopay: 0,
          percentage: 0,
          percentageAmount: 0,
        },
        obraSocialId: 'os-sancor',
        obraSocial: {
          nombreOs: 'SANCOR',
          honorarioEstimado: '11828',
          isActive: true,
          isArchived: false,
          statusManualOverride: false,
          cokibaDetails: {
            observaciones: 'NO POSEE',
            coseguroTexto: 'NO POSEE',
          },
        },
      },
      {
        id: 'swiss-1',
        date: new Date('2026-06-22T15:00:00.000Z'),
        time: '18:00',
        slotNumber: 5,
        patientId: 'patient-2',
        sessionNumber: 10,
        isFirstSession: false,
        status: 'SCHEDULED',
        patientChargeAmount: '0',
        coinsuranceAmount: '0',
        coinsuranceDetails: {
          total: 0,
          baseCopay: 0,
          honorario: 9129.27,
          fixedCopay: 0,
          percentage: 0,
          percentageAmount: 0,
        },
        obraSocialId: 'os-swiss',
        obraSocial: {
          nombreOs: 'SWISS MEDICAL S.A.',
          honorarioEstimado: '9129.27',
          isActive: true,
          isArchived: false,
          statusManualOverride: false,
          cokibaDetails: {
            observaciones: 'NO POSEE',
            coseguroTexto: 'NO POSEE',
          },
        },
      },
    ];

    const prisma = {
      appointment: {
        findMany: jest.fn().mockResolvedValue(appointments),
      },
    };
    const req = { query: { month: '2026-06' } };
    const res = createResponse();

    await getCoinsuranceReport(req, res, prisma);

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        date: { lt: new Date(2026, 6, 1, 0, 0, 0, 0) },
        obraSocialId: { not: null },
        status: {
          in: ['SCHEDULED', 'PENDING_AUTHORIZATION', 'AUTHORIZED', 'COMPLETED'],
        },
      }),
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      month: '2026-06',
      totalAmount: 54185.27,
      copayTotal: 0,
      rows: [
        expect.objectContaining({
          obraSocialName: 'SANCOR',
          appointmentCount: 4,
          totalAmount: 45056,
        }),
        expect.objectContaining({
          obraSocialName: 'SWISS MEDICAL S.A.',
          appointmentCount: 1,
          totalAmount: 9129.27,
        }),
      ],
    }));
  });
});
