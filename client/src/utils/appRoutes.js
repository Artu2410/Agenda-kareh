export const APP_ROUTES = {
  login: '/acceso',
  dashboard: '/panel',
  appointments: '/agenda',
  patients: '/pacientes',
  clinicalHistories: '/historias-clinicas',
  clinicalHistoryDetailBase: '/historias-clinicas/ficha',
  cashflow: '/caja',
  billing: '/facturacion',
  capacity: '/capacidad',
  profitability: '/rentabilidad',
  financialProjection: '/proyeccion-financiera',
  crmIntelligence: '/crm-inteligente',
  hiring: '/contrataciones',
  strategicSimulator: '/simulador',
  notes: '/notas',
  settings: '/configuracion',
  whatsapp: '/whatsapp',
  obrasSociales: '/obras-sociales',
  audit: '/auditoria',
  authorizations: '/autorizaciones',
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
    [APP_ROUTES.billing]: 'Agenda Kareh | Facturacion',
    [APP_ROUTES.capacity]: 'Agenda Kareh | Capacidad',
    [APP_ROUTES.profitability]: 'Agenda Kareh | Rentabilidad',
    [APP_ROUTES.financialProjection]: 'Agenda Kareh | Proyeccion Financiera',
    [APP_ROUTES.crmIntelligence]: 'Agenda Kareh | CRM Inteligente',
    [APP_ROUTES.hiring]: 'Agenda Kareh | Contrataciones',
    [APP_ROUTES.strategicSimulator]: 'Agenda Kareh | Simulador Estrategico',
    [APP_ROUTES.notes]: 'Agenda Kareh | Notas',
    [APP_ROUTES.settings]: 'Agenda Kareh | Configuracion',
    [APP_ROUTES.whatsapp]: 'Agenda Kareh | WhatsApp',
    [APP_ROUTES.obrasSociales]: 'Agenda Kareh | Obras Sociales',
    [APP_ROUTES.audit]: 'Agenda Kareh | Auditoría',
    [APP_ROUTES.authorizations]: 'Agenda Kareh | Autorizaciones',
    [APP_ROUTES.privacy]: 'Agenda Kareh | Privacidad',
    '/login': 'Agenda Kareh | Acceso',
    '/dashboard': 'Agenda Kareh | Panel',
    '/appointments': 'Agenda Kareh | Agenda',
    '/patients': 'Agenda Kareh | Pacientes',
    '/clinical-histories': 'Agenda Kareh | Historias Clinicas',
    '/cashflow': 'Agenda Kareh | Caja',
    '/billing': 'Agenda Kareh | Facturacion',
    '/capacidad': 'Agenda Kareh | Capacidad',
    '/inteligencia/capacidad': 'Agenda Kareh | Capacidad',
    '/rentabilidad': 'Agenda Kareh | Rentabilidad',
    '/inteligencia/rentabilidad': 'Agenda Kareh | Rentabilidad',
    '/proyeccion-financiera': 'Agenda Kareh | Proyeccion Financiera',
    '/financial-projection': 'Agenda Kareh | Proyeccion Financiera',
    '/inteligencia/proyeccion-financiera': 'Agenda Kareh | Proyeccion Financiera',
    '/crm-inteligente': 'Agenda Kareh | CRM Inteligente',
    '/crm-intelligence': 'Agenda Kareh | CRM Inteligente',
    '/inteligencia/crm': 'Agenda Kareh | CRM Inteligente',
    '/contrataciones': 'Agenda Kareh | Contrataciones',
    '/hiring': 'Agenda Kareh | Contrataciones',
    '/inteligencia/contrataciones': 'Agenda Kareh | Contrataciones',
    '/simulador': 'Agenda Kareh | Simulador Estrategico',
    '/simulador-estrategico': 'Agenda Kareh | Simulador Estrategico',
    '/strategic-simulator': 'Agenda Kareh | Simulador Estrategico',
    '/inteligencia/simulador': 'Agenda Kareh | Simulador Estrategico',
    '/notes': 'Agenda Kareh | Notas',
    '/settings': 'Agenda Kareh | Configuracion',
    '/whatsapp': 'Agenda Kareh | WhatsApp',
    '/obras-sociales': 'Agenda Kareh | Obras Sociales',
    '/auditoria': 'Agenda Kareh | Auditoría',
    '/autorizaciones': 'Agenda Kareh | Autorizaciones',
  };

  return titleMap[pathname] || 'Agenda Kareh';
};
