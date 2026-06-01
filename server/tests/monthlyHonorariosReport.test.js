import {
  buildMonthlyHonorariosReport,
  isAgreementInsuranceForMonthlyHonorarios,
  resolveAppointmentHonorario,
} from '../src/utils/monthlyHonorariosReport.js';

describe('monthly honorarios report', () => {
  const buildAppointment = ({
    patientId = 'patient-1',
    obraSocialId = 'os-1',
    date,
    sessionNumber = 1,
    isFirstSession = false,
    status = 'COMPLETED',
    honorario = null,
    obraSocial = {},
  }) => ({
    patientId,
    obraSocialId,
    date: new Date(`${date}T15:00:00.000Z`),
    sessionNumber,
    isFirstSession,
    status,
    coinsuranceDetails: honorario === null ? null : { honorario },
    obraSocial: {
      nombreOs: 'IOMA',
      honorarioEstimado: 1800,
      isActive: true,
      isArchived: false,
      ...obraSocial,
    },
  });

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

  it('falls back to the obra social honorario for legacy appointments without snapshot data', () => {
    const rows = buildMonthlyHonorariosReport([
      {
        obraSocialId: 'os-1',
        coinsuranceDetails: null,
        obraSocial: {
          nombreOs: 'IOMA',
          honorarioEstimado: 5000,
          isActive: true,
          isArchived: false,
        },
      },
    ]);

    expect(rows).toEqual([
      {
        obraSocialId: 'os-1',
        obraSocialName: 'IOMA',
        totalAmount: 5000,
        appointmentCount: 1,
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

  it('keeps regular insurers on the selected calendar month when a month is provided', () => {
    const rows = buildMonthlyHonorariosReport([
      buildAppointment({
        date: '2026-04-15',
        sessionNumber: 1,
        isFirstSession: true,
        honorario: 2000,
        obraSocialId: 'os-sancor',
        obraSocial: {
          nombreOs: 'SANCOR',
          honorarioEstimado: 2000,
        },
      }),
      buildAppointment({
        date: '2026-05-15',
        sessionNumber: 2,
        honorario: 2000,
        obraSocialId: 'os-sancor',
        obraSocial: {
          nombreOs: 'SANCOR',
          honorarioEstimado: 2000,
        },
      }),
    ], { month: '2026-05' });

    expect(rows).toEqual([
      {
        obraSocialId: 'os-sancor',
        obraSocialName: 'SANCOR',
        totalAmount: 2000,
        appointmentCount: 1,
        bonusDetails: [],
        bonusTotal: 0,
      },
    ]);
  });

  it('groups IOMA by completed 10-session cycles and bills the following month', () => {
    const iomaAppointments = [
      ...[
        '2026-03-27',
        '2026-03-30',
        '2026-04-01',
        '2026-04-04',
        '2026-04-06',
        '2026-04-08',
        '2026-04-10',
        '2026-04-13',
        '2026-04-15',
        '2026-04-17',
      ].map((date, index) => buildAppointment({
        date,
        sessionNumber: index + 1,
        isFirstSession: index === 0,
        obraSocialId: 'os-ioma',
        honorario: null,
        obraSocial: {
          nombreOs: 'IOMA',
          honorarioEstimado: 5000,
          cokibaDetails: {
            coseguroTexto: 'Bono de 10 sesiones:$ 20.000 y Bono de 5 sesiones $ 10.000',
          },
        },
      })),
      ...[
        '2026-04-20',
        '2026-04-22',
        '2026-04-24',
        '2026-04-29',
        '2026-05-02',
        '2026-05-04',
        '2026-05-06',
        '2026-05-08',
        '2026-05-11',
        '2026-05-13',
      ].map((date, index) => buildAppointment({
        date,
        sessionNumber: index + 1,
        isFirstSession: index === 0,
        obraSocialId: 'os-ioma',
        honorario: index >= 6 ? (index >= 8 ? 3830 : 0) : null,
        obraSocial: {
          nombreOs: 'IOMA',
          honorarioEstimado: 5000,
          cokibaDetails: {
            coseguroTexto: 'Bono de 10 sesiones:$ 20.000 y Bono de 5 sesiones $ 10.000',
          },
        },
      })),
    ];

    const mayRows = buildMonthlyHonorariosReport(iomaAppointments, { month: '2026-05' });
    const juneRows = buildMonthlyHonorariosReport(iomaAppointments, { month: '2026-06' });

    expect(mayRows).toEqual([
      expect.objectContaining({
        obraSocialId: 'os-ioma',
        obraSocialName: 'IOMA',
        totalAmount: 50000,
        appointmentCount: 10,
        bonusTotal: 30000,
        bonusDetails: [
          {
            label: 'Bono 10 sesiones',
            sessions: 10,
            amount: 20000,
          },
          {
            label: 'Bono 5 sesiones',
            sessions: 5,
            amount: 10000,
          },
        ],
      }),
    ]);

    expect(juneRows).toEqual([
      expect.objectContaining({
        obraSocialId: 'os-ioma',
        obraSocialName: 'IOMA',
        totalAmount: 50000,
        appointmentCount: 10,
        bonusTotal: 30000,
        bonusDetails: [
          {
            label: 'Bono 10 sesiones',
            sessions: 10,
            amount: 20000,
          },
          {
            label: 'Bono 5 sesiones',
            sessions: 5,
            amount: 10000,
          },
        ],
      }),
    ]);
  });
});
