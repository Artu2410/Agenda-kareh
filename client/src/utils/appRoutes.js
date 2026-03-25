export const APP_ROUTES = {
  login: '/acceso',
  dashboard: '/panel',
  appointments: '/agenda',
  patients: '/pacientes',
  clinicalHistories: '/historias-clinicas',
  clinicalHistoryDetailBase: '/historias-clinicas/ficha',
  cashflow: '/caja',
  notes: '/notas',
  settings: '/configuracion',
  whatsapp: '/whatsapp',
  privacy: '/privacidad',
};

export const CLINICAL_HISTORY_SESSION_KEY = 'agenda_kareh_selected_patient';

const stripAccents = (value) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const slugify = (value = 'paciente') => {
  const normalized = stripAccents(String(value).toLowerCase())
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'paciente';
};

export const buildClinicalHistoryPath = (patientName = 'paciente') =>
  `${APP_ROUTES.clinicalHistoryDetailBase}/${slugify(patientName)}`;

export const persistClinicalHistoryContext = ({ patientId, patientName = '' }) => {
  if (!patientId) return;

  localStorage.setItem(
    CLINICAL_HISTORY_SESSION_KEY,
    JSON.stringify({ patientId, patientName })
  );
};

export const readClinicalHistoryContext = () => {
  try {
    const rawValue = localStorage.getItem(CLINICAL_HISTORY_SESSION_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
};

export const clearClinicalHistoryContext = () => {
  localStorage.removeItem(CLINICAL_HISTORY_SESSION_KEY);
};

export const getDocumentTitle = (pathname) => {
  if (!pathname) return 'Agenda Kareh';

  if (
    pathname.startsWith(APP_ROUTES.clinicalHistoryDetailBase) ||
    pathname.startsWith('/clinical-history')
  ) {
    return 'Agenda Kareh | Historia Clinica';
  }

  const titleMap = {
    [APP_ROUTES.login]: 'Agenda Kareh | Acceso',
    [APP_ROUTES.dashboard]: 'Agenda Kareh | Panel',
    [APP_ROUTES.appointments]: 'Agenda Kareh | Agenda',
    [APP_ROUTES.patients]: 'Agenda Kareh | Pacientes',
    [APP_ROUTES.clinicalHistories]: 'Agenda Kareh | Historias Clinicas',
    [APP_ROUTES.cashflow]: 'Agenda Kareh | Caja',
    [APP_ROUTES.notes]: 'Agenda Kareh | Notas',
    [APP_ROUTES.settings]: 'Agenda Kareh | Configuracion',
    [APP_ROUTES.whatsapp]: 'Agenda Kareh | WhatsApp',
    [APP_ROUTES.privacy]: 'Agenda Kareh | Privacidad',
    '/login': 'Agenda Kareh | Acceso',
    '/dashboard': 'Agenda Kareh | Panel',
    '/appointments': 'Agenda Kareh | Agenda',
    '/patients': 'Agenda Kareh | Pacientes',
    '/clinical-histories': 'Agenda Kareh | Historias Clinicas',
    '/cashflow': 'Agenda Kareh | Caja',
    '/notes': 'Agenda Kareh | Notas',
    '/settings': 'Agenda Kareh | Configuracion',
    '/whatsapp': 'Agenda Kareh | WhatsApp',
  };

  return titleMap[pathname] || 'Agenda Kareh';
};
