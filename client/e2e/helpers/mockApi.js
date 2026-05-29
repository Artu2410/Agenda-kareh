const clone = (value) => JSON.parse(JSON.stringify(value));

const buildProfessional = () => ({
  id: 'prof-1',
  fullName: 'Dra. Ana Pérez',
  licenseNumber: '12345',
  licenseNumberMP: 'MP-67890',
  specialty: 'Kinesiología',
  type: 'MN',
  dni: '30111222',
  phone: '1122334455',
  emergencyPhone: '1166677788',
  isActive: true,
  isArchived: false,
  workSchedule: [],
});

const buildObrasSociales = () => ([
  {
    id: 'os-1',
    nombreOs: 'OSDE',
    codigoCokiba: 'OSDE-001',
    isActive: true,
    requiresAuthorization: true,
    atendibleSanMiguel: true,
    coseguroValor: 2500,
    honorarioEstimado: 5000,
    percentageCoinsurance: 10,
    fixedCopay: 700,
    plazoPago: 30,
    detectedStatus: 'Activa',
    detectedIsActive: true,
    statusManualOverride: false,
    requiredDocuments: {
      documents: [{ name: 'Orden médica', validityDays: 30 }],
      additionalInfo: 'Presentar credencial',
    },
    cokibaDetails: {
      areaCobertura: 'Provincia de Buenos Aires',
      links: [{ href: 'https://example.com/osde', text: 'Manual' }],
    },
  },
  {
    id: 'os-2',
    nombreOs: 'IOMA',
    codigoCokiba: 'IOMA-002',
    isActive: false,
    requiresAuthorization: false,
    atendibleSanMiguel: false,
    coseguroValor: 1800,
    honorarioEstimado: 4500,
    percentageCoinsurance: 5,
    fixedCopay: 500,
    plazoPago: 45,
    detectedStatus: 'Inactiva',
    detectedIsActive: false,
    statusManualOverride: false,
    requiredDocuments: {
      documents: [{ name: 'Credencial', validityDays: null }],
      additionalInfo: '',
    },
    cokibaDetails: {
      areaCobertura: 'CABA',
      links: [],
    },
  },
]);

const buildMetricsResponse = () => ({
  weekly: {
    total: 3,
    scheduled: 2,
    completed: 1,
    noShow: 0,
    resolved: 1,
    respiratory: 0,
    iu: 0,
    percentage: 33.3,
    attendanceRate: 100,
  },
  monthly: {
    current: 12,
    previous: 9,
    scheduled: 8,
    completed: 3,
    noShow: 1,
    resolved: 4,
    attendanceRate: 75,
    change: 33.3,
    changeLabel: '+33.3%',
    label: 'Mayo 2026',
    insuranceBreakdown: [
      { name: 'PARTICULAR', count: 6 },
      { name: 'OSDE', count: 4 },
      { name: 'IOMA', count: 2 },
    ],
    respiratory: 0,
    iu: 0,
  },
  annual: {
    patientCount: 18,
    appointmentCount: 48,
    completedCount: 30,
    noShowCount: 3,
  },
  monthlyTrend: [
    {
      monthKey: '2026-04',
      month: 'ABR 26',
      label: 'Abril 2026',
      appointmentCount: 9,
      completedCount: 5,
      noShowCount: 1,
      scheduledCount: 3,
      resolvedCount: 6,
      attendanceRate: 83.3,
      insuranceBreakdown: [{ name: 'PARTICULAR', count: 5 }],
    },
    {
      monthKey: '2026-05',
      month: 'MAY 26',
      label: 'Mayo 2026',
      appointmentCount: 12,
      completedCount: 3,
      noShowCount: 1,
      scheduledCount: 8,
      resolvedCount: 4,
      attendanceRate: 75,
      insuranceBreakdown: [{ name: 'PARTICULAR', count: 6 }],
    },
  ],
});

const buildAuthUser = (role = 'SECRETARIA') => ({
  id: 'user-1',
  email: `${role.toLowerCase()}@kareh.test`,
  name: role === 'SUPER_USER' ? 'Super Usuario' : 'Secretaria',
  role,
  professionalId: '',
});

const buildAgendaConfig = () => ({
  slotDuration: 30,
  capacityPerSlot: 5,
  timerDurationMinutes: 25,
  timerDurations: [25, 25, 25, 25, 25],
});

const buildInitialState = ({ role = 'SECRETARIA' } = {}) => {
  const professionals = [buildProfessional()];
  const obrasSociales = buildObrasSociales();

  return {
    authenticated: false,
    otpCode: '123456',
    role,
    user: buildAuthUser(role),
    professionals,
    appointments: [],
    obrasSociales,
    users: [
      buildAuthUser('SUPER_USER'),
      {
        id: 'user-2',
        email: 'profesional@kareh.test',
        name: 'Profesional Demo',
        role: 'PROFESSIONAL',
        professionalId: professionals[0].id,
      },
    ],
    agendaConfig: buildAgendaConfig(),
    metrics: buildMetricsResponse(),
    syncStatus: {
      total: obrasSociales.length,
      activas: obrasSociales.filter((item) => item.isActive).length,
      lastSyncAt: new Date().toISOString(),
      syncing: false,
      lastSyncedRecord: obrasSociales[0].nombreOs,
      config: {
        configured: true,
        canSync: true,
        missingFields: [],
        placeholderFields: [],
        accessMode: 'private',
      },
    },
    coinsuranceReport: {
      month: '2026-05',
      totalAmount: 125000,
      rows: [
        {
          obraSocialId: obrasSociales[0].id,
          obraSocialName: obrasSociales[0].nombreOs,
          appointmentCount: 4,
          totalAmount: 82000,
        },
        {
          obraSocialId: obrasSociales[1].id,
          obraSocialName: obrasSociales[1].nombreOs,
          appointmentCount: 2,
          totalAmount: 43000,
        },
      ],
    },
    pushConfig: {
      enabled: false,
      publicKey: null,
    },
  };
};

const sendJson = async (route, data, status = 200) => {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(data),
  });
};

const parseBody = (request) => {
  try {
    return request.postDataJSON();
  } catch {
    return {};
  }
};

const getPath = (request) => new URL(request.url()).pathname.replace(/^\/api/, '') || '/';

const filterAppointments = (appointments, params) => {
  const professionalId = params.get('professionalId');
  if (!professionalId) return appointments;
  return appointments.filter((appointment) => appointment.professionalId === professionalId);
};

const filterObrasSociales = (items, params) => {
  const isActive = params.get('isActive');
  const includeInactive = params.get('includeInactive');
  const requiresAuthorization = params.get('requiresAuthorization');
  const zona = params.get('zona');

  return items.filter((item) => {
    if (isActive === 'true' && !item.isActive) return false;
    if (isActive === 'false' && item.isActive) return false;
    if (!includeInactive && !item.isActive && isActive !== 'false') return false;
    if (requiresAuthorization === 'true' && !item.requiresAuthorization) return false;
    if (zona === 'san-miguel' && !item.atendibleSanMiguel) return false;
    return true;
  });
};

const normalizePatientData = (patientData = {}) => ({
  fullName: String(patientData.fullName || `${patientData.lastName || ''} ${patientData.firstName || ''}`).trim() || 'Paciente de prueba',
  firstName: patientData.firstName || '',
  lastName: patientData.lastName || '',
  dni: patientData.dni || '',
  phone: patientData.phone || '',
  birthDate: patientData.birthDate || null,
  healthInsurance: patientData.healthInsurance || 'PARTICULAR',
  treatAsParticular: patientData.treatAsParticular ?? true,
  obraSocialId: patientData.obraSocialId || '',
  affiliateNumber: patientData.affiliateNumber || '',
  hasCancer: Boolean(patientData.hasCancer),
  hasMarcapasos: Boolean(patientData.hasMarcapasos),
  usesEA: Boolean(patientData.usesEA),
  usesWheelchair: Boolean(patientData.usesWheelchair),
  isRespiratory: Boolean(patientData.isRespiratory),
  isIU: Boolean(patientData.isIU),
});

const createAppointment = (state, payload) => {
  const professional = state.professionals.find((item) => item.id === payload.professionalId) || state.professionals[0];
  const appointment = {
    id: `apt-${state.appointments.length + 1}`,
    date: payload.date,
    time: payload.time,
    slotNumber: payload.slotNumber || 1,
    status: 'SCHEDULED',
    diagnosis: payload.diagnosis || '',
    paidInAdvance: Boolean(payload.paidInAdvance),
    isFirstSession: Boolean(payload.isFirstSession),
    sessionNumber: 1,
    patientId: `patient-${state.appointments.length + 1}`,
    professionalId: professional?.id || payload.professionalId || '',
    professional,
    patient: normalizePatientData(payload.patientData),
    documentsChecklist: payload.documentsChecklist || { documents: [], additionalInfo: '' },
    authorizationNumber: payload.authorizationNumber || '',
    authorizationFileUrl: payload.authorizationFileUrl || '',
    sessionToken: payload.sessionToken || '',
  };

  state.appointments.push(appointment);
  return appointment;
};

const updateAppointment = (state, id, payload) => {
  const index = state.appointments.findIndex((appointment) => appointment.id === id);
  if (index === -1) return null;

  const current = state.appointments[index];
  const next = {
    ...current,
    ...payload,
    patient: {
      ...current.patient,
      ...(payload.patientData ? normalizePatientData(payload.patientData) : {}),
    },
    diagnosis: payload.diagnosis ?? current.diagnosis,
    status: payload.status || current.status,
    paidInAdvance: payload.paidInAdvance ?? current.paidInAdvance,
    isFirstSession: payload.isFirstSession ?? current.isFirstSession,
    documentsChecklist: payload.documentsChecklist || current.documentsChecklist,
    authorizationNumber: payload.authorizationNumber ?? current.authorizationNumber,
    authorizationFileUrl: payload.authorizationFileUrl ?? current.authorizationFileUrl,
    sessionToken: payload.sessionToken ?? current.sessionToken,
  };

  state.appointments[index] = next;
  return next;
};

const deleteAppointment = (state, id) => {
  state.appointments = state.appointments.filter((appointment) => appointment.id !== id);
};

const findRouteMatch = (path, pattern) => {
  const match = path.match(pattern);
  return match ? match.slice(1) : null;
};

export const installMockApi = async (page, options = {}) => {
  const state = buildInitialState(options);

  const apiRoutePattern = /^https?:\/\/(?:localhost|127\.0\.0\.1|kareh-backend\.onrender\.com|api\.kareh\.com\.ar)(?::\d+)?\/api\/.*$/;

  await page.route(apiRoutePattern, async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const path = getPath(request);
    const body = method === 'GET' ? {} : parseBody(request);

    if (path === '/csrf-token' && method === 'GET') {
      return sendJson(route, { token: 'mock-csrf-token' });
    }

    if (path === '/auth/verify' && method === 'GET') {
      return state.authenticated
        ? sendJson(route, { valid: true, user: clone(state.user) })
        : sendJson(route, { valid: false, message: 'Token inválido o expirado' }, 401);
    }

    if (path === '/auth/refresh' && method === 'POST') {
      return state.authenticated
        ? sendJson(route, { success: true, accessToken: 'mock-access-token' })
        : sendJson(route, { message: 'Refresh token inválido o expirado' }, 401);
    }

    if (path === '/auth/logout' && method === 'POST') {
      state.authenticated = false;
      return sendJson(route, { success: true, message: 'Sesión cerrada' });
    }

    if (path === '/auth/request-otp' && method === 'POST') {
      const email = String(body?.email || '').toLowerCase();
      if (!email || !email.includes('@')) {
        return sendJson(route, { message: 'Email inválido' }, 400);
      }
      if (email.includes('invalid')) {
        return sendJson(route, { message: 'Acceso denegado', detail: 'El correo no está habilitado para ingresar.' }, 403);
      }
      return sendJson(route, {
        success: true,
        message: 'Código OTP enviado',
        devOtp: state.otpCode,
      });
    }

    if (path === '/auth/verify-otp' && method === 'POST') {
      const otp = String(body?.otp || '').trim();
      const email = String(body?.email || '').trim();
      if (!email || otp !== state.otpCode) {
        return sendJson(route, { message: 'Código incorrecto' }, 401);
      }

      state.authenticated = true;
      state.user = {
        ...state.user,
        email,
        name: state.role === 'SUPER_USER' ? 'Super Usuario' : 'Secretaria',
        role: state.role,
      };

      return sendJson(route, {
        success: true,
        user: clone(state.user),
        accessToken: 'mock-access-token',
      });
    }

    if (path === '/notifications/config' && method === 'GET') {
      return sendJson(route, state.pushConfig);
    }

    if (path === '/notifications/subscribe' && method === 'POST') {
      return sendJson(route, { success: true });
    }

    if (path === '/metrics' && method === 'GET') {
      return sendJson(route, clone(state.metrics));
    }

    if (path === '/professionals' && method === 'GET') {
      return sendJson(route, clone(state.professionals));
    }

    if (path === '/agenda/config' && method === 'GET') {
      return sendJson(route, clone(state.agendaConfig));
    }

    if (path === '/appointments/week' && method === 'GET') {
      const filtered = filterAppointments(state.appointments, url.searchParams);
      return sendJson(route, clone(filtered));
    }

    const futureAppointmentsMatch = findRouteMatch(path, /^\/patients\/([^/]+)\/future-appointments$/);
    if (futureAppointmentsMatch && method === 'GET') {
      const [patientId] = futureAppointmentsMatch;
      return sendJson(route, clone(state.appointments.filter((appointment) => appointment.patientId === patientId)));
    }

    const sessionCyclesMatch = findRouteMatch(path, /^\/patients\/([^/]+)\/session-cycles$/);
    if (sessionCyclesMatch && method === 'GET') {
      return sendJson(route, []);
    }

    if (path === '/appointments' && method === 'POST') {
      const appointment = createAppointment(state, body);
      return sendJson(route, { appointments: [clone(appointment)] });
    }

    const evolutionMatch = findRouteMatch(path, /^\/appointments\/([^/]+)\/evolution$/);
    if (evolutionMatch && method === 'PATCH') {
      const [appointmentId] = evolutionMatch;
      const appointment = updateAppointment(state, appointmentId, body);
      if (!appointment) {
        return sendJson(route, { message: 'No encontrado' }, 404);
      }
      return sendJson(route, { success: true, appointment: clone(appointment) });
    }

    const appointmentIdMatch = findRouteMatch(path, /^\/appointments\/([^/]+)$/);
    if (appointmentIdMatch && method === 'DELETE') {
      deleteAppointment(state, appointmentIdMatch[0]);
      return sendJson(route, { success: true });
    }

    if (appointmentIdMatch && method === 'PUT') {
      const [appointmentId] = appointmentIdMatch;
      const appointment = updateAppointment(state, appointmentId, body);
      if (!appointment) {
        return sendJson(route, { message: 'No encontrado' }, 404);
      }
      return sendJson(route, { success: true, appointment: clone(appointment) });
    }

    const batchMatch = findRouteMatch(path, /^\/appointments\/([^/]+)\/batch$/);
    if (batchMatch && method === 'GET') {
      const [appointmentId] = batchMatch;
      const appointment = state.appointments.find((item) => item.id === appointmentId);
      const patientId = appointment?.patientId;
      const batch = patientId
        ? state.appointments.filter((item) => item.patientId === patientId)
        : [];
      return sendJson(route, clone(batch));
    }

    const whatsappTicketMatch = findRouteMatch(path, /^\/appointments\/([^/]+)\/whatsapp-ticket-document$/);
    if (whatsappTicketMatch && method === 'POST') {
      return sendJson(route, { success: true });
    }

    if (path === '/obras-sociales' && method === 'GET') {
      const filtered = filterObrasSociales(state.obrasSociales, url.searchParams);
      return sendJson(route, clone(filtered));
    }

    if (path === '/obras-sociales/stats' && method === 'GET') {
      return sendJson(route, {
        total: state.obrasSociales.length,
        activas: state.obrasSociales.filter((item) => item.isActive).length,
        sanMiguel: state.obrasSociales.filter((item) => item.atendibleSanMiguel).length,
        requierenAutorizacion: state.obrasSociales.filter((item) => item.requiresAuthorization).length,
      });
    }

    if (path === '/obras-sociales/status' && method === 'GET') {
      return sendJson(route, clone(state.syncStatus));
    }

    if (path === '/obras-sociales/coinsurance-report' && method === 'GET') {
      return sendJson(route, clone(state.coinsuranceReport));
    }

    if (path === '/obras-sociales/sync' && method === 'POST') {
      return sendJson(route, { total: state.obrasSociales.length, created: 0, updated: 0 });
    }

    if (path === '/obras-sociales' && method === 'POST') {
      const newItem = {
        id: `os-${state.obrasSociales.length + 1}`,
        codigoCokiba: String(body?.codigoCokiba || `OS-${state.obrasSociales.length + 1}`).trim(),
        nombreOs: String(body?.nombreOs || '').trim(),
        coseguroValor: Number(body?.coseguroValor || 0),
        honorarioEstimado: Number(body?.honorarioEstimado || 0),
        fixedCopay: Number(body?.fixedCopay || 0),
        plazoPago: Number(body?.plazoPago || 60),
        percentageCoinsurance: Number(body?.percentageCoinsurance || 0),
        attendibleSanMiguel: Boolean(body?.atendibleSanMiguel),
        atendibleSanMiguel: Boolean(body?.atendibleSanMiguel),
        isActive: body?.isActive ?? true,
        requiresAuthorization: Boolean(body?.requiresAuthorization),
        statusManualOverride: Boolean(body?.statusManualOverride),
        detectedStatus: body?.detectedStatus || (body?.isActive ? 'Activa' : 'Inactiva'),
        detectedIsActive: body?.detectedIsActive ?? Boolean(body?.isActive),
        requiredDocuments: body?.requiredDocuments || { documents: [], additionalInfo: '' },
        cokibaDetails: body?.cokibaDetails || {},
      };

      state.obrasSociales.unshift(newItem);
      return sendJson(route, clone(newItem));
    }

    const obraSocialMatch = findRouteMatch(path, /^\/obras-sociales\/([^/]+)$/);
    if (obraSocialMatch && method === 'PUT') {
      const [obraSocialId] = obraSocialMatch;
      const index = state.obrasSociales.findIndex((item) => item.id === obraSocialId);
      if (index === -1) {
        return sendJson(route, { error: 'No encontrada' }, 404);
      }
      state.obrasSociales[index] = {
        ...state.obrasSociales[index],
        ...body,
      };
      return sendJson(route, clone(state.obrasSociales[index]));
    }

    if (obraSocialMatch && method === 'DELETE') {
      const [obraSocialId] = obraSocialMatch;
      state.obrasSociales = state.obrasSociales.filter((item) => item.id !== obraSocialId);
      return sendJson(route, { success: true });
    }

    if (path === '/users' && method === 'GET') {
      return sendJson(route, clone(state.users));
    }

    if (path === '/users' && method === 'POST') {
      return sendJson(route, { success: true });
    }

    const userRoleMatch = findRouteMatch(path, /^\/users\/([^/]+)\/role$/);
    if (userRoleMatch && method === 'PUT') {
      return sendJson(route, { success: true });
    }

    const userMatch = findRouteMatch(path, /^\/users\/([^/]+)$/);
    if (userMatch && ['PUT', 'DELETE'].includes(method)) {
      return sendJson(route, { success: true });
    }

    if (path === '/csrf-token' && method !== 'GET') {
      return sendJson(route, { token: 'mock-csrf-token' });
    }

    if (path === '/patients/search' && method === 'GET') {
      return sendJson(route, {}, 404);
    }

    if (path === '/upload' || path === '/uploads') {
      return sendJson(route, { url: 'https://files.example/mock-file.pdf' });
    }

    return sendJson(route, {});
  });

  return state;
};
