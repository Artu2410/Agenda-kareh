export const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
export const WELCOME_TEMPLATE = process.env.WHATSAPP_WELCOME_TEMPLATE || 'bienvenida_kareh';
export const HOLA_TEMPLATE = process.env.WHATSAPP_HOLA_TEMPLATE || 'bienvenida_kareh';
export const WHATSAPP_AUTOREPLY_ENABLED = String(process.env.WHATSAPP_AUTOREPLY_ENABLED || 'false').trim().toLowerCase() === 'true';

export const FLOW_STATES = Object.freeze({
  WELCOME: 'welcome',
  OBRA_SOCIAL: 'obra_social',
  OBRA_SOCIAL_UNAVAILABLE: 'obra_social_unavailable',
  OBRA_SOCIAL_DOCS: 'obra_social_docs',
  PARTICULAR: 'particular',
  PAMI: 'pami',
  RESPIRATORIO: 'respiratorio',
  FINAL_DOCS: 'final_docs',
  LOCATION: 'location',
  WAITING_HUMAN_REVIEW: 'waiting_human_review',
  HUMAN_HANDOFF: 'human_handoff',
});

export const FLOW_META = Object.freeze({
  OFFER: 'offer',
  DOCS: 'docs',
  OBRA_SOCIAL: 'obra_social',
  ART: 'art',
});

export const CLINIC_LOCATION_MAPS_URL = 'https://maps.app.goo.gl/ChIJccvYOMO9vJURBOmqm_VIytA';

export const DEFAULT_WELCOME_TEXT = [
  'Hola{{name_suffix}} 😊',
  'Contame si es particular, PAMI, obra social, ART o respiratorio.',
].join('\n');

export const UNKNOWN_INPUT_TEXT = [
  'Claro.',
  'Contame si es particular, PAMI, obra social, ART o respiratorio.',
].join('\n');

export const WAITING_HUMAN_REVIEW_TEXT = 'Perfecto 😊 Ya lo tiene administración. En cuanto lo revisen seguimos por acá.';
export const DOCUMENTATION_RECEIVED_TEXT = 'Perfecto 😊 Recibimos la documentación correctamente. Lo revisamos y seguimos por acá.';

export const AUTO_REPLY_LOCATION_TEXT = [
  'Av. Senador Morón 782, Bella Vista.',
  'Atendemos lun y vie de 14:00 a 19:00 hs, mar a jue de 17:30 a 19:00 hs y sáb de 08:00 a 12:00 hs.',
  `Mapa: ${CLINIC_LOCATION_MAPS_URL}`,
  'Si querés, te paso dos horarios disponibles.',
].join('\n');

export const DIRECT_INTENT_RULES = [
  {
    patterns: [/\b(rpg|rehabilitacion postural global|rehabilitación postural global|postural)\b/],
    text: 'Por ahora no estamos tomando RPG. Si querés avanzar por particular, contame qué necesitás tratar y te paso horarios.',
    nextState: FLOW_STATES.PARTICULAR,
  },
  {
    patterns: [/\b(vestibular|mareos|vertigo|vértigo)\b/],
    text: 'Por ahora no estamos tomando rehabilitación vestibular. Si querés avanzar por particular, contame qué necesitás tratar y te paso horarios.',
    nextState: FLOW_STATES.PARTICULAR,
  },
  {
    patterns: [/\b(drenaje|linfatico|linfático)\b/],
    text: 'Perfecto 😊 Drenaje linfático lo vemos caso por caso según disponibilidad profesional. Lo revisamos y seguimos por acá.',
    nextState: FLOW_STATES.WAITING_HUMAN_REVIEW,
  },
  {
    patterns: [/\b(domicilio|domiciliario|domiciliaria|en casa|en domicilio)\b/],
    text: 'Atención a domicilio no estamos tomando en este momento. Si te sirve en consultorio por particular, contame qué necesitás tratar y te paso horarios.',
    nextState: FLOW_STATES.PARTICULAR,
  },
  {
    patterns: [/^(5|5 ubicacion|5 ubicacion y horarios)$/],
    text: AUTO_REPLY_LOCATION_TEXT,
    nextState: FLOW_STATES.LOCATION,
  },
  {
    patterns: [/\b(ubicacion|direccion|donde estan|donde quedan|mapa|horario|horarios)\b/],
    text: AUTO_REPLY_LOCATION_TEXT,
    nextState: FLOW_STATES.LOCATION,
  },
];

export const WELCOME_MODE = 'text';
export const HOLA_MODE = 'text';
export const WELCOME_TEXT_TEMPLATE = DEFAULT_WELCOME_TEXT;
export const HOLA_TEXT_TEMPLATE = DEFAULT_WELCOME_TEXT;
export const WELCOME_TEMPLATE_BODY_PARAMS = process.env.WHATSAPP_WELCOME_TEMPLATE_BODY_PARAMS;
export const HOLA_TEMPLATE_BODY_PARAMS = String(process.env.WHATSAPP_HOLA_TEMPLATE_BODY_PARAMS || '').trim()
  ? process.env.WHATSAPP_HOLA_TEMPLATE_BODY_PARAMS
  : WELCOME_TEMPLATE_BODY_PARAMS;
export const WELCOME_FALLBACK_TEXT = WELCOME_TEXT_TEMPLATE;
export const WELCOME_COOLDOWN_HOURS = Number(process.env.WHATSAPP_WELCOME_COOLDOWN_HOURS || 24);
export const WELCOME_COOLDOWN_MS = WELCOME_COOLDOWN_HOURS * 60 * 60 * 1000;
export const PRICING_CHANGE_DATE = new Date(2026, 5, 1, 0, 0, 0, 0);
export const AUTO_REPLY_COOLDOWN_MS = 15 * 1000;
export const AUTO_REPLY_MIN_DELAY_MS = 1500;
export const AUTO_REPLY_MAX_DELAY_MS = 5500;
export const PRICING_REPEAT_WINDOW_MS = 60 * 60 * 1000;
export const SLOT_REPEAT_WINDOW_MS = 45 * 60 * 1000;

export const MIME_EXTENSION = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'video/mp4': 'mp4',
  'audio/ogg': 'ogg',
  'audio/opus': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'text/plain': 'txt',
};

export const WHATSAPP_OUTBOUND_PLACEHOLDER = '[Archivo adjunto]';
export const WHATSAPP_AUDIO_PLACEHOLDER = '[Audio]';

export const SPECIAL_COVERAGE_AVAILABILITY = Object.freeze({
  AVAILABLE: 'available',
  LIMITED: 'limited',
  SUSPENDED: 'suspended',
  UNAVAILABLE: 'unavailable',
});

export const SPECIAL_COVERAGE_RULES = [
  {
    patterns: [/\bosde\b/],
    label: 'OSDE',
    availability: SPECIAL_COVERAGE_AVAILABILITY.UNAVAILABLE,
  },
  {
    patterns: [/\bgalicia\b/, /\bgalicia salud\b/],
    label: 'Galicia',
    availability: SPECIAL_COVERAGE_AVAILABILITY.UNAVAILABLE,
  },
  {
    patterns: [/\biosfa\b/],
    label: 'IOSFA',
    availability: SPECIAL_COVERAGE_AVAILABILITY.SUSPENDED,
  },
  {
    patterns: [/\bunion personal\b/, /^up$/],
    label: 'Union Personal',
    availability: SPECIAL_COVERAGE_AVAILABILITY.LIMITED,
  },
];
