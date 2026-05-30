jest.mock('../src/services/whatsapp.js', () => ({
  __esModule: true,
  uploadMedia: jest.fn(),
  sendDocumentMessage: jest.fn(),
  sendImageMessage: jest.fn(),
  sendTemplateMessage: jest.fn(),
  sendTextMessage: jest.fn(),
}));

jest.mock('../src/services/whatsappTicket.js', () => ({
  __esModule: true,
  sendWhatsAppTicketForAppointment: jest.fn(),
}));

jest.mock('../src/jobs/sendWhatsAppTicketJob.js', () => ({
  __esModule: true,
  enqueueSendWhatsAppTicket: jest.fn(),
  sendWhatsAppTicketJob: jest.fn(),
  default: jest.fn(),
}));

jest.mock('../src/services/storage.js', () => ({
  __esModule: true,
  uploadBufferToStorage: jest.fn(),
}));

jest.mock('../src/services/ticketPdf.js', () => ({
  __esModule: true,
  buildTicketPdf: jest.fn(),
}));

jest.mock('../src/services/pushNotifications.js', () => ({
  __esModule: true,
  sendNotificationToEmails: jest.fn(),
}));

jest.mock('../src/config/logger.js', () => {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(),
  };
  logger.child.mockReturnValue(logger);
  return { __esModule: true, default: logger };
});

import {
  createAppointment,
  reviewAppointmentAuthorization,
  updateAppointment,
} from '../src/controllers/AppointmentController.js';
import { sendNotificationToEmails } from '../src/services/pushNotifications.js';

const createResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const buildPatient = (overrides = {}) => ({
  id: 'pat-1',
  dni: '12345678',
  fullName: 'Juan Pérez',
  healthInsurance: 'PARTICULAR',
  obraSocialId: null,
  treatAsParticular: true,
  affiliateNumber: null,
  phone: null,
  birthDate: new Date('1990-01-01T12:00:00.000Z'),
  hasCancer: false,
  hasMarcapasos: false,
  usesEA: false,
  usesWheelchair: false,
  isRespiratory: false,
  isIU: false,
  ...overrides,
});

const buildAppointment = (overrides = {}) => ({
  id: 'apt-1',
  date: new Date('2026-06-10T12:00:00.000Z'),
  time: '10:00',
  slotNumber: 1,
  diagnosis: 'CONTROL',
  patientId: 'pat-1',
  professionalId: 'prof-1',
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
  professional: {
    id: 'prof-1',
    fullName: 'Lic. Ana',
  },
  ...overrides,
});

const buildCreatePrisma = ({ insured = false } = {}) => {
  const appointment = buildAppointment();
  const tx = {
    agendaConfig: {
      findFirst: jest.fn().mockResolvedValue({ capacityPerSlot: 2 }),
    },
    patient: {
      upsert: jest.fn().mockResolvedValue(buildPatient({
        id: 'pat-1',
        obraSocialId: insured ? 'os-1' : null,
        treatAsParticular: !insured,
      })),
      update: jest.fn().mockResolvedValue({ id: 'pat-1' }),
    },
    professional: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'prof-1',
        fullName: 'Lic. Ana',
        isActive: true,
      }),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    obraSocial: {
      findUnique: jest.fn().mockResolvedValue(insured ? {
        id: 'os-1',
        nombreOs: 'OSDE',
        isArchived: false,
        isActive: true,
        requiresAuthorization: true,
        requiredDocuments: JSON.stringify({
          documents: [{ name: 'DNI', mandatory: true, validityDays: 30 }],
          additionalInfo: 'Adjuntar DNI',
        }),
        coseguroValor: 100,
        honorarioEstimado: 200,
        percentageCoinsurance: 10,
        fixedCopay: 15,
      } : null),
    },
    appointment: {
      findMany: jest.fn()
        .mockResolvedValueOnce([{ slotNumber: 1 }])
        .mockResolvedValueOnce([]),
      create: jest.fn().mockImplementation(async ({ data }) => ({
        ...appointment,
        ...data,
        id: 'apt-created',
        patientId: 'pat-1',
        professionalId: 'prof-1',
      })),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const prisma = {
    agendaConfig: {
      findFirst: jest.fn().mockResolvedValue({ capacityPerSlot: 2 }),
    },
    $transaction: jest.fn(async (callback) => callback(tx)),
  };

  return { prisma, tx };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AppointmentController core flows', () => {
  it('creates a particular appointment and assigns the next free slot', async () => {
    const { prisma, tx } = buildCreatePrisma({ insured: false });
    const req = {
      body: {
        patientData: {
          dni: '12345678',
          fullName: 'Juan Pérez',
          healthInsurance: 'PARTICULAR',
          obraSocialId: '',
          treatAsParticular: true,
          affiliateNumber: '',
          phone: '1125609610',
          birthDate: '1990-01-01',
          hasCancer: false,
          hasMarcapasos: false,
          usesEA: false,
          usesWheelchair: false,
          isRespiratory: false,
          isIU: false,
        },
        professionalId: 'prof-1',
        date: '2026-06-10',
        time: '10:00',
        diagnosis: 'Control',
        sessionCount: 1,
        selectedDays: [3],
        paidInAdvance: false,
      },
      user: { role: 'ADMIN' },
    };
    const res = createResponse();

    await createAppointment(req, res, prisma);

    expect(tx.patient.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { dni: '12345678' },
    }));
    expect(tx.appointment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        patientId: 'pat-1',
        professionalId: 'prof-1',
        slotNumber: 2,
        obraSocialId: null,
        authorizationStatus: 'NOT_REQUIRED',
        status: 'SCHEDULED',
      }),
    }));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      appointments: expect.arrayContaining([
        expect.objectContaining({
          id: 'apt-created',
          slotNumber: 2,
        }),
      ]),
    }));
  });

  it('creates an insured appointment with authorization and financial snapshot data', async () => {
    const { prisma, tx } = buildCreatePrisma({ insured: true });
    tx.appointment.findMany
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ slotNumber: 1 }])
      .mockResolvedValueOnce([]);
    const req = {
      body: {
        patientData: {
          dni: '12345678',
          fullName: 'Juan Pérez',
          healthInsurance: 'OSDE',
          obraSocialId: 'os-1',
          treatAsParticular: false,
          affiliateNumber: 'AFF-123',
          phone: '1125609610',
          birthDate: '1990-01-01',
          hasCancer: false,
          hasMarcapasos: false,
          usesEA: false,
          usesWheelchair: false,
          isRespiratory: false,
          isIU: false,
        },
        professionalId: 'prof-1',
        date: '2026-06-10',
        time: '10:00',
        diagnosis: 'Control',
        sessionCount: 1,
        selectedDays: [3],
        paidInAdvance: false,
      },
      user: { role: 'ADMIN' },
    };
    const res = createResponse();

    await createAppointment(req, res, prisma);

    expect(tx.obraSocial.findUnique).toHaveBeenCalled();
    expect(tx.appointment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        obraSocialId: 'os-1',
        authorizationStatus: 'PENDING',
        status: 'PENDING_AUTHORIZATION',
        patientChargeAmount: 135,
        coinsuranceAmount: 135,
      }),
    }));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
    }));
  });

  it('updates an appointment while preserving unchanged insurance data', async () => {
    const currentAppointment = buildAppointment({
      obraSocialId: 'os-1',
      authorizationStatus: 'PENDING',
      patient: buildPatient({
        healthInsurance: 'OSDE',
        obraSocialId: 'os-1',
        treatAsParticular: false,
        affiliateNumber: 'AFF-123',
      }),
      coinsuranceAmount: 135,
      patientChargeAmount: 135,
      coinsuranceDetails: {
        baseCopay: 100,
        honorario: 200,
        percentage: 10,
        percentageAmount: 20,
        fixedCopay: 15,
        total: 135,
      },
      paidInAdvance: true,
      sessionToken: 'TOKEN-1',
    });
    const tx = {
      agendaConfig: {
        findFirst: jest.fn().mockResolvedValue({ capacityPerSlot: 2 }),
      },
      appointment: {
        findUnique: jest.fn().mockResolvedValue(currentAppointment),
        update: jest.fn().mockImplementation(async ({ data }) => ({
          ...currentAppointment,
          ...data,
          patient: currentAppointment.patient,
        })),
        findMany: jest.fn(),
      },
      patient: {
        update: jest.fn().mockResolvedValue({ id: currentAppointment.patientId }),
      },
      obraSocial: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'os-1',
          nombreOs: 'OSDE',
          isArchived: false,
          isActive: true,
          requiresAuthorization: false,
          requiredDocuments: JSON.stringify({ documents: [], additionalInfo: '' }),
          coseguroValor: 0,
          honorarioEstimado: 0,
          percentageCoinsurance: 0,
          fixedCopay: 0,
        }),
      },
    };
    const prisma = {
      agendaConfig: {
        findFirst: jest.fn().mockResolvedValue({ capacityPerSlot: 2 }),
      },
      $transaction: jest.fn(async (callback) => callback(tx)),
    };
    const req = {
      params: { id: currentAppointment.id },
      body: {
        patientId: currentAppointment.patientId,
        phone: '1144445555',
        birthDate: '1990-01-02',
        affiliateNumber: 'AFF-999',
      },
      user: { role: 'ADMIN' },
    };
    const res = createResponse();

    await updateAppointment(req, res, prisma);

    expect(tx.patient.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: currentAppointment.patientId },
      data: expect.objectContaining({
        phone: '1144445555',
        affiliateNumber: 'AFF-999',
      }),
    }));
    expect(tx.appointment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: currentAppointment.id },
      data: expect.objectContaining({
        obraSocialId: 'os-1',
        authorizationStatus: 'NOT_REQUIRED',
        paidInAdvance: true,
        sessionToken: 'TOKEN-1',
      }),
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      appointment: expect.objectContaining({
        obraSocialId: 'os-1',
        sessionToken: 'TOKEN-1',
      }),
    }));
  });

  it('reviews an authorization, updates the appointment and notifies the professional', async () => {
    const currentAppointment = buildAppointment({
      authorizationStatus: 'PENDING',
      status: 'PENDING_AUTHORIZATION',
    });
    const tx = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue(currentAppointment),
        update: jest.fn().mockResolvedValue({
          ...currentAppointment,
          authorizationStatus: 'AUTHORIZED',
          status: 'AUTHORIZED',
          authorizationNumber: 'AUTH-42',
          authorizationFileUrl: 'https://example.com/auth.pdf',
        }),
      },
    };
    const prisma = {
      agendaConfig: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => callback(tx)),
      user: {
        findFirst: jest.fn().mockResolvedValue({
          email: 'profesional@kareh.com.ar',
        }),
      },
    };
    sendNotificationToEmails.mockResolvedValue({ delivered: 1 });
    const req = {
      params: { id: currentAppointment.id },
      body: {
        decision: 'AUTHORIZED',
        authorizationNumber: 'AUTH-42',
        authorizationFileUrl: 'https://example.com/auth.pdf',
      },
      user: { userId: 'admin-1' },
    };
    const res = createResponse();

    await reviewAppointmentAuthorization(req, res, prisma);

    expect(tx.appointment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: currentAppointment.id },
      data: expect.objectContaining({
        authorizationStatus: 'AUTHORIZED',
        authorizationNumber: 'AUTH-42',
        authorizationFileUrl: 'https://example.com/auth.pdf',
        authorizationReviewedById: 'admin-1',
        status: 'AUTHORIZED',
      }),
    }));
    expect(sendNotificationToEmails).toHaveBeenCalledWith(
      prisma,
      ['profesional@kareh.com.ar'],
      expect.objectContaining({
        title: 'Turno autorizado',
        body: 'Juan Pérez: autorizado por administración.',
        url: '/autorizaciones',
        kind: 'appointment-authorization',
      }),
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      appointment: expect.objectContaining({
        authorizationStatus: 'AUTHORIZED',
      }),
    }));
  });

  it('rejects invalid authorization decisions', async () => {
    const prisma = {
      $transaction: jest.fn(),
      user: {
        findFirst: jest.fn(),
      },
    };
    const req = {
      params: { id: 'apt-1' },
      body: {
        decision: 'PENDING',
      },
      user: { userId: 'admin-1' },
    };
    const res = createResponse();

    await reviewAppointmentAuthorization(req, res, prisma);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Decisión inválida' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
