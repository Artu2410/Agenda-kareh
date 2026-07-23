jest.mock('../src/jobs/sendWhatsAppTicketJob.js', () => ({
  __esModule: true,
  enqueueSendWhatsAppTicket: jest.fn(),
  sendWhatsAppTicketJob: jest.fn(),
  default: jest.fn(),
}));

import { updateEvolution } from '../src/controllers/AppointmentController.js';

const createResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const buildPatient = (overrides = {}) => ({
  id: 'pat-123',
  dni: '12345678',
  fullName: 'Juan Pérez',
  birthDate: new Date('1990-01-02T12:00:00.000Z'),
  healthInsurance: 'PARTICULAR',
  obraSocialId: null,
  treatAsParticular: true,
  affiliateNumber: null,
  phone: null,
  hasCancer: false,
  hasMarcapasos: false,
  usesEA: false,
  usesWheelchair: false,
  isRespiratory: false,
  isIU: false,
  ...overrides,
});

const buildAppointment = (overrides = {}) => ({
  id: 'apt-123',
  date: new Date('2026-05-27T12:00:00.000Z'),
  time: '10:00',
  slotNumber: 1,
  diagnosis: 'CONTROL',
  patientId: 'pat-123',
  professionalId: 'prof-123',
  obraSocialId: null,
  cycleId: null,
  sessionNumber: 1,
  isFirstSession: false,
  status: 'SCHEDULED',
  authorizationStatus: 'NOT_REQUIRED',
  authorizationNumber: null,
  authorizationFileUrl: null,
  documentsChecklist: { documents: [], additionalInfo: '' },
  coinsuranceAmount: null,
  patientChargeAmount: null,
  coinsuranceDetails: null,
  paidInAdvance: false,
  sessionToken: null,
  patient: buildPatient(),
  ...overrides,
});

const createPrismaMock = (currentAppointment, obraSocial = null) => {
  const tx = {
    appointment: {
      findUnique: jest.fn().mockResolvedValue(currentAppointment),
      update: jest.fn().mockImplementation(async ({ data }) => ({
        ...currentAppointment,
        ...data,
        patient: currentAppointment.patient,
      })),
      findMany: jest.fn().mockResolvedValue([]),
    },
    patient: {
      update: jest.fn().mockResolvedValue({ id: currentAppointment.patientId }),
    },
    clinicalHistory: {
      create: jest.fn().mockResolvedValue({ id: 'history-1' }),
    },
    obraSocial: {
      findUnique: jest.fn().mockResolvedValue(obraSocial),
    },
  };

  return {
    prisma: {
      $transaction: jest.fn(async (callback) => callback(tx)),
    },
    tx,
  };
};

describe('updateEvolution', () => {
  it('saves particular evolutions with empty optional insurance fields', async () => {
    const currentAppointment = buildAppointment({
      obraSocialId: null,
      authorizationStatus: 'NOT_REQUIRED',
      patient: buildPatient({
        healthInsurance: 'PARTICULAR',
        obraSocialId: null,
        treatAsParticular: true,
      }),
    });

    const { prisma, tx } = createPrismaMock(currentAppointment);
    const req = {
      params: { id: currentAppointment.id },
      body: {
        diagnosis: 'Control',
        status: 'COMPLETED',
        patientData: {
          healthInsurance: 'PARTICULAR',
          obraSocialId: '',
          treatAsParticular: true,
          affiliateNumber: '',
          birthDate: '',
          hasCancer: false,
          hasMarcapasos: false,
          usesEA: false,
          usesWheelchair: false,
          isRespiratory: false,
          isIU: false,
        },
        documentsChecklist: { documents: [], additionalInfo: '' },
        authorizationNumber: '',
        authorizationFileUrl: '',
        paidInAdvance: false,
        sessionToken: '',
        evolution: 'Seguimiento',
        isFirstSession: false,
      },
      user: { role: 'ADMIN' },
    };
    const res = createResponse();

    await updateEvolution(req, res, prisma);

    expect(tx.obraSocial.findUnique).not.toHaveBeenCalled();
    expect(tx.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: currentAppointment.patientId },
        data: expect.objectContaining({
          healthInsurance: 'PARTICULAR',
          obraSocialId: null,
          treatAsParticular: true,
        }),
      }),
    );
    expect(tx.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: currentAppointment.id },
        data: expect.objectContaining({
          status: 'COMPLETED',
          sessionToken: null,
        }),
      }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        appointment: expect.objectContaining({
          status: 'COMPLETED',
          sessionToken: null,
        }),
      }),
    );
  });

  it('saves insured evolutions without revalidating unchanged coverage and keeps a valid token', async () => {
    const currentAppointment = buildAppointment({
      obraSocialId: 'active-os-123',
      authorizationStatus: 'PENDING',
      patient: buildPatient({
        healthInsurance: 'OSDE',
        obraSocialId: 'active-os-123',
        treatAsParticular: false,
        affiliateNumber: '12345',
      }),
    });

    const { prisma, tx } = createPrismaMock(currentAppointment);
    const req = {
      params: { id: currentAppointment.id },
      body: {
        diagnosis: 'Control',
        status: 'COMPLETED',
        patientData: {
          healthInsurance: 'OSDE',
          obraSocialId: 'active-os-123',
          treatAsParticular: false,
          affiliateNumber: '12345',
          hasCancer: false,
          hasMarcapasos: false,
          usesEA: false,
          usesWheelchair: false,
          isRespiratory: false,
          isIU: false,
        },
        documentsChecklist: { documents: [], additionalInfo: '' },
        authorizationNumber: 'AUTH-42',
        authorizationFileUrl: 'https://example.com/auth.pdf',
        paidInAdvance: false,
        sessionToken: 'TOKEN-123',
        evolution: 'Seguimiento',
        isFirstSession: false,
      },
      user: { role: 'ADMIN' },
    };
    const res = createResponse();

    await updateEvolution(req, res, prisma);

    expect(tx.obraSocial.findUnique).not.toHaveBeenCalled();
    expect(tx.patient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: currentAppointment.patientId },
        data: expect.objectContaining({
          healthInsurance: 'OSDE',
          obraSocialId: 'active-os-123',
          treatAsParticular: false,
          affiliateNumber: '12345',
        }),
      }),
    );
    expect(tx.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: currentAppointment.id },
        data: expect.objectContaining({
          status: 'COMPLETED',
          authorizationNumber: 'AUTH-42',
          sessionToken: 'TOKEN-123',
        }),
      }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        appointment: expect.objectContaining({
          authorizationNumber: 'AUTH-42',
          sessionToken: 'TOKEN-123',
        }),
      }),
    );
  });
});
