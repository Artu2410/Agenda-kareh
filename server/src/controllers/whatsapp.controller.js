import path from 'node:path';
import { uploadBufferToStorage } from '../services/storage.js';
import {
  downloadMedia,
  fetchMediaInfo,
  sendDocumentMessage,
  sendTemplateMessage,
  sendTextMessage,
  uploadMedia,
} from '../services/whatsapp.js';
import { getSuggestedWhatsAppSlots } from '../services/whatsappAvailability.js';
import { normalizePhone } from '../utils/phone.js';
import { transcribeAudioBuffer } from '../services/audioTranscription.js';
import { sendNotificationToAll } from './notifications.controller.js';
import { findInMemoryWhatsAppCoverageByInput } from '../utils/whatsappCoverageCatalog.js';
import { createInternalError } from '../errors/AppError.js';
import logger from '../config/logger.js';
import {
  buildFlowState,
  createWhatsAppLogger,
  getFileExtension,
  getFlowStateBase,
  getFlowStateMeta,
  normalizeOutgoingText,
  sanitizeFilename,
} from './whatsapp/message.helpers.js';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WELCOME_TEMPLATE = process.env.WHATSAPP_WELCOME_TEMPLATE || 'bienvenida_kareh';
const HOLA_TEMPLATE = process.env.WHATSAPP_HOLA_TEMPLATE || 'bienvenida_kareh';
const WHATSAPP_AUTOREPLY_ENABLED = String(process.env.WHATSAPP_AUTOREPLY_ENABLED || 'false').trim().toLowerCase() === 'true';

const FLOW_STATES = Object.freeze({
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

const FLOW_META = Object.freeze({
  OFFER: 'offer',
  DOCS: 'docs',
  OBRA_SOCIAL: 'obra_social',
  ART: 'art',
});
const CLINIC_LOCATION_MAPS_URL = 'https://maps.app.goo.gl/ChIJccvYOMO9vJURBOmqm_VIytA';

const DEFAULT_WELCOME_TEXT = [
  'Hola{{name_suffix}} 😊',
  'Contame si es particular, PAMI, obra social, ART o respiratorio.',
].join('\n');

const UNKNOWN_INPUT_TEXT = [
  'Claro.',
  'Contame si es particular, PAMI, obra social, ART o respiratorio.',
].join('\n');
const WAITING_HUMAN_REVIEW_TEXT = 'Perfecto 😊 Ya lo tiene administración. En cuanto lo revisen seguimos por acá.';
const DOCUMENTATION_RECEIVED_TEXT = 'Perfecto 😊 Recibimos la documentación correctamente. Lo revisamos y seguimos por acá.';

const AUTO_REPLY_LOCATION_TEXT = [
  'Av. Senador Morón 782, Bella Vista.',
  'Atendemos lun y vie de 14:00 a 19:00 hs, mar a jue de 17:30 a 19:00 hs y sáb de 08:00 a 12:00 hs.',
  `Mapa: ${CLINIC_LOCATION_MAPS_URL}`,
  'Si querés, te paso dos horarios disponibles.',
].join('\n');

const DIRECT_INTENT_RULES = [
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

const WELCOME_MODE = 'text';
const HOLA_MODE = 'text';
const WELCOME_TEXT_TEMPLATE = DEFAULT_WELCOME_TEXT;
const HOLA_TEXT_TEMPLATE = DEFAULT_WELCOME_TEXT;
const WELCOME_TEMPLATE_BODY_PARAMS = process.env.WHATSAPP_WELCOME_TEMPLATE_BODY_PARAMS;
const HOLA_TEMPLATE_BODY_PARAMS = String(process.env.WHATSAPP_HOLA_TEMPLATE_BODY_PARAMS || '').trim()
  ? process.env.WHATSAPP_HOLA_TEMPLATE_BODY_PARAMS
  : WELCOME_TEMPLATE_BODY_PARAMS;
const WELCOME_FALLBACK_TEXT = WELCOME_TEXT_TEMPLATE;
const WELCOME_COOLDOWN_HOURS = Number(process.env.WHATSAPP_WELCOME_COOLDOWN_HOURS || 24);
const WELCOME_COOLDOWN_MS = WELCOME_COOLDOWN_HOURS * 60 * 60 * 1000;
const PRICING_CHANGE_DATE = new Date(2026, 5, 1, 0, 0, 0, 0);
const AUTO_REPLY_COOLDOWN_MS = 15 * 1000;
const AUTO_REPLY_MIN_DELAY_MS = 1500;
const AUTO_REPLY_MAX_DELAY_MS = 5500;
const PRICING_REPEAT_WINDOW_MS = 60 * 60 * 1000;
const SLOT_REPEAT_WINDOW_MS = 45 * 60 * 1000;

const MIME_EXTENSION = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'text/plain': 'txt',
  'video/mp4': 'mp4',
};

const WHATSAPP_OUTBOUND_PLACEHOLDER = '[Archivo adjunto]';
const WHATSAPP_AUDIO_PLACEHOLDER = '[Audio]';
const SPECIAL_COVERAGE_AVAILABILITY = Object.freeze({
  UNAVAILABLE: 'unavailable',
  SUSPENDED: 'suspended',
});

const getPreviewText = (message) => {
  if (!message) return '';
  if (message.type === 'text') return message.text?.body || '';
  if (message.type === 'reaction') {
    const emoji = message.reaction?.emoji || '';
    return emoji ? `Reaccionó ${emoji}` : '[Reacción]';
  }
  if (message.type === 'sticker') return '[Sticker]';
  if (message.type === 'audio') return WHATSAPP_AUDIO_PLACEHOLDER;
  const caption = message[message.type]?.caption;
  return caption || `[${message.type || 'archivo'}]`;
};

const getMediaInfoFromMessage = (message) => {
  if (!message) return null;
  const payload = message[message.type];
  if (!payload) return null;
  return {
    mediaId: payload.id,
    mimeType: payload.mime_type,
    sha256: payload.sha256,
    filename: payload.filename
      || (message.type === 'sticker' ? 'sticker.webp' : null)
      || (message.type === 'audio' ? `audio${MIME_EXTENSION[payload.mime_type] ? `.${MIME_EXTENSION[payload.mime_type]}` : '.ogg'}` : null),
    caption: payload.caption || null,
  };
};

const isAudioMessageType = (messageType, mimeType) => messageType === 'audio' || String(mimeType || '').startsWith('audio/');

const buildAudioTranscriptText = (transcription) => `${WHATSAPP_AUDIO_PLACEHOLDER} ${transcription}`;

const buildStoredInboundText = ({ message, transcribedText, mimeType }) => {
  if (transcribedText && isAudioMessageType(message?.type, mimeType)) {
    return buildAudioTranscriptText(transcribedText);
  }

  return getPreviewText(message);
};

const ensureConversation = async ({ prisma, waId, profileName, phone }) => {
  const normalizedPhone = normalizePhone(phone || waId);
  const existing = await prisma.whatsAppConversation.findUnique({ where: { waId } });
  
  if (existing) {
    const updated = await prisma.whatsAppConversation.update({
      where: { id: existing.id },
      data: {
        profileName: profileName || undefined,
        phone: normalizedPhone || undefined,
      },
    });
    return { conversation: updated, isNew: false };
  }

  const created = await prisma.whatsAppConversation.create({
    data: {
      waId,
      phone: normalizedPhone || waId,
      profileName: profileName || null,
      currentState: FLOW_STATES.WELCOME,
      unreadCount: 0,
    },
  });
  return { conversation: created, isNew: true };
};

const parseTemplateBodyParams = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (normalized.toUpperCase() === 'NONE') return [];
  return normalized
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const WELCOME_TEMPLATE_BODY_PARAM_NAMES = parseTemplateBodyParams(WELCOME_TEMPLATE_BODY_PARAMS);
const HOLA_TEMPLATE_BODY_PARAM_NAMES = parseTemplateBodyParams(HOLA_TEMPLATE_BODY_PARAMS);

const getTemplateBodyParamNames = (templateName) => {
  if (templateName === HOLA_TEMPLATE) return HOLA_TEMPLATE_BODY_PARAM_NAMES;
  if (templateName === WELCOME_TEMPLATE) return WELCOME_TEMPLATE_BODY_PARAM_NAMES;
  return null;
};

const sanitizePatientName = (patientName) => {
  const normalized = String(patientName || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return '';

  const cleaned = normalized
    .replace(/[^\p{L}\p{N}' .-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';

  const shortened = cleaned
    .split(' ')
    .filter(Boolean)
    .slice(0, 3)
    .join(' ');

  return shortened.slice(0, 40).trim();
};

const getTemplatePatientName = (patientName, fallback = 'Paciente') => {
  const normalized = sanitizePatientName(patientName);
  if (!normalized) return fallback;
  return normalized;
};

const buildTemplateTextParameter = ({ text, parameterName }) => {
  const parameter = { type: 'text', text };
  if (parameterName) {
    parameter.parameter_name = parameterName;
  }
  return parameter;
};

const buildWelcomeTemplateComponents = (patientName, templateName = WELCOME_TEMPLATE) => {
  const paramNames = getTemplateBodyParamNames(templateName);
  if (Array.isArray(paramNames) && paramNames.length === 0) {
    return undefined;
  }

  return [
    {
      type: 'body',
      parameters: [
        buildTemplateTextParameter({
          text: getTemplatePatientName(patientName),
          parameterName: paramNames?.[0],
        }),
      ],
    },
  ];
};

const buildReplyText = (textTemplate, patientName) => {
  const name = getTemplatePatientName(patientName, '');
  return String(textTemplate || WELCOME_FALLBACK_TEXT)
    .replace(/\{\{\s*(?:name|1)\s*\}\}/gi, name)
    .replace(/\{\{\s*name_suffix\s*\}\}/gi, name ? ` ${name}` : '')
    .replace(/ {2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+\n/g, '\n')
    .trim();
};

const buildWelcomeFallbackText = (patientName, textTemplate = WELCOME_FALLBACK_TEXT) => (
  buildReplyText(textTemplate, patientName)
);

const isTemplatePayloadError = (error) => {
  const message = String(error?.detail?.error?.message || error?.message || '').toLowerCase();
  const details = String(error?.detail?.error?.error_data?.details || '').toLowerCase();
  return message.includes('invalid parameter')
    || details.includes('parameter name')
    || details.includes('number of parameters');
};

const getReplyConfig = ({ replyKind = 'welcome', templateName } = {}) => {
  if (replyKind === 'hola') {
    return {
      mode: HOLA_MODE,
      templateName: templateName || HOLA_TEMPLATE || WELCOME_TEMPLATE,
      textTemplate: HOLA_TEXT_TEMPLATE,
    };
  }

  return {
    mode: WELCOME_MODE,
    templateName: templateName || WELCOME_TEMPLATE,
    textTemplate: WELCOME_TEXT_TEMPLATE,
  };
};

const sendWelcomeReply = async ({
  to,
  patientName,
  templateName = WELCOME_TEMPLATE,
  replyKind = 'welcome',
  baseLogger = logger,
}) => {
  const replyConfig = getReplyConfig({ replyKind, templateName });
  const outboundText = buildReplyText(replyConfig.textTemplate, patientName);
  const fallbackText = buildWelcomeFallbackText(patientName, replyConfig.textTemplate);
  const replyLogger = createWhatsAppLogger(baseLogger);

  if (replyConfig.mode !== 'template') {
    const response = await sendTextMessage({
      to,
      text: outboundText,
    });
    return {
      response,
      outboundType: 'text',
      outboundText,
    };
  }

  try {
    const response = await sendTemplateMessage({
      to,
      name: replyConfig.templateName,
      components: buildWelcomeTemplateComponents(patientName, replyConfig.templateName),
    });

    return {
      response,
      outboundType: 'template',
      outboundText: `Plantilla: ${replyConfig.templateName}`,
    };
  } catch (error) {
    if (!isTemplatePayloadError(error)) {
      throw error;
    }

    replyLogger.warn('Template automático rechazado por WhatsApp. Se enviará saludo de texto.', {
      templateName: replyConfig.templateName,
      errorMessage: error?.detail?.error?.error_data?.details || error.message,
    });

    const response = await sendTextMessage({ to, text: outboundText || fallbackText });

    return {
      response,
      outboundType: 'text',
      outboundText: outboundText || fallbackText,
    };
  }
};

const storeOutboundMedia = async ({ conversationId, file }) => {
  const extension = getFileExtension(file.originalname, file.mimetype, MIME_EXTENSION);
  const baseName = sanitizeFilename(path.basename(file.originalname || `archivo${extension}`, extension), 'archivo');
  const key = `whatsapp/${conversationId}/outbound/${Date.now()}-${baseName}${extension}`;

  return uploadBufferToStorage({
    buffer: file.buffer,
    key,
    contentType: file.mimetype || 'application/octet-stream',
  });
};

const normalizeText = (value) => {
  if (!value) return '';
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u200d\uFE0F\u20E3]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
};

const SPECIAL_COVERAGE_RULES = [
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
    availability: SPECIAL_COVERAGE_AVAILABILITY.SUSPENDED,
  },
];

const GREETING_PREFIXES = ['hola', 'buenas', 'buen dia', 'buenos dias', 'buenas tardes', 'buenas noches'];
const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const MENU_COMMAND_PATTERNS = [/^(0|menu|menu principal|volver|inicio)(\b.*)?$/];
const LISTO_COMMAND_PATTERNS = [/^(listo|ya esta|ya envie todo|termine)(\b.*)?$/];
const LOCATION_INTENT_PATTERNS = [
  /^(5|5 ubicacion|5 ubicacion y horarios)$/,
  /\b(ubicacion|direccion|donde estan|donde quedan|mapa|horario|horarios)\b/,
];
const PRICE_INTENT_PATTERNS = [/\b(cuanto sale|cuanto cuesta|precio|precios|valor|costo|costos)\b/];
const PARTICULAR_INTENT_PATTERNS = [/^(2|2 particular)$/, /\bparticular\b/];
const PAMI_INTENT_PATTERNS = [/^(3|3 pami)$/, /\bpami\b/];
const IOMA_INTENT_PATTERNS = [/\bioma\b/];
const ART_INTENT_PATTERNS = [/\bart\b/, /\b(accidente laboral|aseguradora de riesgos del trabajo|riesgos del trabajo|siniestro)\b/];
const INSURANCE_INTENT_PATTERNS = [
  /\b(obra social|obras sociales|prepaga|prepagas|mutual|credencial|carnet)\b/,
];
const RESPIRATORY_INTENT_PATTERNS = [
  /^(4|4 respiratorio)$/,
  /\b(respiratorio|respiratoria|bronquiolitis|broncoespasmo|nebulizacion|tos persistente|respira)\b/,
];
const SLOT_REQUEST_PATTERNS = [
  /\b(turno|horario|horarios|disponibilidad|disponible|arrancar|empezar|comenzar|sesion|sesiones)\b/,
];
const WHEN_INTENT_PATTERNS = [/\b(cuando|para cuando|que horario|que horarios|tenes algo|tendras algo|tendra algo)\b/];
const MORNING_SLOT_PATTERNS = [/\b(a la manana|de manana|temprano|primera hora)\b/];
const AFTERNOON_SLOT_PATTERNS = [/\b(a la tarde|por la tarde|tarde)\b/];
const EVENING_SLOT_PATTERNS = [/\b(mas tarde|a ultima hora|despues de las 17|despues de las 18|despues de las 19)\b/];
const TOMORROW_SLOT_PATTERNS = [/\b(para manana|manana)\b/];
const HUMAN_HANDOFF_PATTERNS = [
  /\bkati\b/,
  /\bkatia\b/,
  /\bkaren\b/,
  /\bkarina\b/,
  /\bmas temprano\b/,
  /\bmas tarde\b/,
  /\bpuedo mover\b/,
  /\bcambiar turno\b/,
  /\breprogramar\b/,
  /\bmi turno\b/,
  /\bel turno\b/,
  /\bllego mas tarde\b/,
  /\bpuedo ir antes\b/,
  /\bse puede pasar\b/,
];
const BOOKING_COMMIT_PATTERNS = [
  /\b(me sirve|me queda bien|quiero ese|quiero turno|quiero sacar turno|avancemos|podemos avanzar|dale|de una|ok|esta bien|perfecto|prefiero|viernes|sabado|lunes|martes|miercoles|jueves)\b/,
];
const PRICE_OBJECTION_PATTERNS = [/\b(caro|cara|mucha plata|se me complica|no llego|no puedo pagar)\b/];
const COMPLEX_ADMIN_PATTERNS = [
  /\b(reintegro|reintegran|devolucion|auditoria|factura|facturacion|reclamo|queja|problema|excepcion|cubre|cobertura|autoriza|autorizacion|bono|bonos)\b/,
];
const URGENT_PATTERNS = [/\b(cirugia|protesis|lca|postoperatorio|fractura|dificultad respiratoria)\b/];
const NEURO_PATTERNS = [/\b(neuro|neurorehabilitacion|acv|hemiplejia|parkinson|esclerosis|neurologica)\b/];
const WEEKDAY_SLOT_RULES = [
  { day: 1, pattern: /\blunes\b/ },
  { day: 2, pattern: /\bmartes\b/ },
  { day: 3, pattern: /\bmiercoles\b/ },
  { day: 4, pattern: /\bjueves\b/ },
  { day: 5, pattern: /\bviernes\b/ },
  { day: 6, pattern: /\bsabado\b/ },
];
const BODY_ZONE_PATTERNS = [
  /\b(rodilla|hombro|espalda|cintura|cuello|cervical|lumbar|tobillo|pie|mano|codo|brazo|pierna|columna|ciatica|rotula|menisco|rotador)\b/,
];
const GENERIC_REASON_PATTERNS = [/\b(dolor|contractura|lesion|rehabilitacion|operacion|esguince|luxacion)\b/];
const DOCUMENT_TEXT_PATTERNS = [/\b(orden|credencial|dni|frente|dorso|estudio|resonancia|radiografia|receta|foto)\b/];
const OFFER_FLOW_STATES = new Set([FLOW_STATES.PARTICULAR, FLOW_STATES.PAMI, FLOW_STATES.RESPIRATORIO]);

const matchesAnyPattern = (text, patterns) => patterns.some((pattern) => pattern.test(text));
const hashText = (value) => String(value || '')
  .split('')
  .reduce((accumulator, char) => ((accumulator * 31) + char.charCodeAt(0)) >>> 0, 7);
const pickVariant = (variants, seed = '') => variants[hashText(seed) % variants.length];
const formatCurrency = (value) => `$${Number(value || 0).toLocaleString('es-AR')}`;
const hasFlowMeta = (state, meta) => getFlowStateMeta(state).includes(meta);

const isGreeting = (normalizedText) => GREETING_PREFIXES.some(
  (prefix) => normalizedText === prefix || normalizedText.startsWith(`${prefix} `),
);

const isMenuCommand = (normalizedText) => matchesAnyPattern(normalizedText, MENU_COMMAND_PATTERNS);
const isListoCommand = (normalizedText) => matchesAnyPattern(normalizedText, LISTO_COMMAND_PATTERNS);
const isLocationIntent = (normalizedText) => matchesAnyPattern(normalizedText, LOCATION_INTENT_PATTERNS);
const hasPriceIntent = (normalizedText) => matchesAnyPattern(normalizedText, PRICE_INTENT_PATTERNS);
const hasParticularIntent = (normalizedText) => matchesAnyPattern(normalizedText, PARTICULAR_INTENT_PATTERNS);
const hasPamiIntent = (normalizedText) => matchesAnyPattern(normalizedText, PAMI_INTENT_PATTERNS);
const hasIomaIntent = (normalizedText) => matchesAnyPattern(normalizedText, IOMA_INTENT_PATTERNS);
const hasArtKeywordIntent = (normalizedText) => matchesAnyPattern(normalizedText, ART_INTENT_PATTERNS);
const hasRespiratoryIntent = (normalizedText) => matchesAnyPattern(normalizedText, RESPIRATORY_INTENT_PATTERNS);
const hasSlotRequestIntent = (normalizedText) => matchesAnyPattern(normalizedText, SLOT_REQUEST_PATTERNS);
const hasWhenIntent = (normalizedText) => matchesAnyPattern(normalizedText, WHEN_INTENT_PATTERNS);
const hasHumanHandoffIntent = (normalizedText) => matchesAnyPattern(normalizedText, HUMAN_HANDOFF_PATTERNS);
const hasBookingCommitment = (normalizedText) => matchesAnyPattern(normalizedText, BOOKING_COMMIT_PATTERNS);
const hasPriceObjection = (normalizedText) => matchesAnyPattern(normalizedText, PRICE_OBJECTION_PATTERNS);
const hasComplexAdminIntent = (normalizedText) => matchesAnyPattern(normalizedText, COMPLEX_ADMIN_PATTERNS);
const hasUrgentIntent = (normalizedText) => matchesAnyPattern(normalizedText, URGENT_PATTERNS);
const hasNeuroIntent = (normalizedText) => matchesAnyPattern(normalizedText, NEURO_PATTERNS);
const hasBodyZoneIntent = (normalizedText) => matchesAnyPattern(normalizedText, BODY_ZONE_PATTERNS);
const hasGenericReasonIntent = (normalizedText) => matchesAnyPattern(normalizedText, GENERIC_REASON_PATTERNS);
const hasDocumentationText = (normalizedText) => matchesAnyPattern(normalizedText, DOCUMENT_TEXT_PATTERNS);
const getKnownCoverageIntent = (normalizedText) => (
  normalizedText ? findInMemoryWhatsAppCoverageByInput(normalizedText, { includeInactive: true }) : null
);
const hasKnownCoverageIntent = (normalizedText) => Boolean(getKnownCoverageIntent(normalizedText));
const isArtCoverage = (coverage) => {
  if (!coverage) return false;

  const normalizedCoverageName = normalizeText(coverage.name);
  const normalizedDocumentation = normalizeText(coverage.documentationRequired);

  return normalizedCoverageName.includes(' art')
    || normalizedCoverageName.endsWith(' art')
    || normalizedDocumentation.includes('siniestro');
};
const hasArtIntent = (normalizedText) => (
  hasArtKeywordIntent(normalizedText)
  || isArtCoverage(getKnownCoverageIntent(normalizedText))
);
const getInactiveCoverageIntent = (normalizedText) => {
  const matchedCoverage = getKnownCoverageIntent(normalizedText);
  if (!matchedCoverage || matchedCoverage.isActive !== false) {
    return null;
  }

  return {
    label: matchedCoverage.name,
    availability: normalizeText(matchedCoverage.documentationRequired).includes('suspendida')
      ? SPECIAL_COVERAGE_AVAILABILITY.SUSPENDED
      : SPECIAL_COVERAGE_AVAILABILITY.UNAVAILABLE,
  };
};
const getSpecialCoverageIntent = (normalizedText) => (
  SPECIAL_COVERAGE_RULES.find(({ patterns }) => matchesAnyPattern(normalizedText, patterns)) || null
);
const hasInsuranceIntent = (normalizedText) => (
  hasIomaIntent(normalizedText)
  || hasKnownCoverageIntent(normalizedText)
  || matchesAnyPattern(normalizedText, INSURANCE_INTENT_PATTERNS)
) && !hasArtIntent(normalizedText);
const hasClinicalReason = (normalizedText) => (
  hasRespiratoryIntent(normalizedText)
  || hasBodyZoneIntent(normalizedText)
  || hasGenericReasonIntent(normalizedText)
  || hasUrgentIntent(normalizedText)
  || hasNeuroIntent(normalizedText)
);
const extractSlotPreference = (normalizedText) => {
  if (!normalizedText) return null;

  const preference = {};
  const mentionsMorning = matchesAnyPattern(normalizedText, MORNING_SLOT_PATTERNS);

  if (mentionsMorning) {
    preference.timeOfDay = 'morning';
  } else if (matchesAnyPattern(normalizedText, EVENING_SLOT_PATTERNS)) {
    preference.timeOfDay = 'evening';
  } else if (matchesAnyPattern(normalizedText, AFTERNOON_SLOT_PATTERNS)) {
    preference.timeOfDay = 'afternoon';
  }

  const afterHourMatch = normalizedText.match(/\bdespues de las (\d{1,2})\b/);
  if (afterHourMatch) {
    preference.minHour = Number(afterHourMatch[1]);
  }

  const beforeHourMatch = normalizedText.match(/\bantes de las (\d{1,2})\b/);
  if (beforeHourMatch) {
    preference.maxHour = Number(beforeHourMatch[1]);
  }

  const weekdayMatch = WEEKDAY_SLOT_RULES.find(({ pattern }) => pattern.test(normalizedText));
  if (weekdayMatch) {
    preference.allowedWeekdays = [weekdayMatch.day];
  }

  if (!mentionsMorning && matchesAnyPattern(normalizedText, TOMORROW_SLOT_PATTERNS)) {
    preference.specificDayOffset = 1;
  }

  return Object.keys(preference).length ? preference : null;
};
const isServiceFlowState = (stateBase) => OFFER_FLOW_STATES.has(stateBase);
const isCollectingDocumentation = (currentState) => {
  const stateBase = getFlowStateBase(currentState);
  if (stateBase === FLOW_STATES.OBRA_SOCIAL_DOCS || stateBase === FLOW_STATES.FINAL_DOCS) {
    return true;
  }

  return isServiceFlowState(stateBase)
    && (hasFlowMeta(currentState, FLOW_META.DOCS) || hasFlowMeta(currentState, FLOW_META.OFFER));
};
const isAwaitingSlotChoice = (currentState) => (
  isServiceFlowState(getFlowStateBase(currentState)) && hasFlowMeta(currentState, FLOW_META.OFFER)
);

const getCurrentPricing = (referenceDate = new Date()) => (
  referenceDate >= PRICING_CHANGE_DATE
    ? {
      particular: 18000,
      respiratorio: 35000,
      pami: 12000,
      iomaCoinsurance: 7000,
    }
    : {
      particular: 15000,
      respiratorio: 30000,
      pami: 10000,
      iomaCoinsurance: 7000,
    }
);

const parseConversationDate = (value) => {
  if (!value) return null;
  const parsedValue = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsedValue.getTime()) ? null : parsedValue;
};

const isTimestampWithinWindow = (value, windowMs, referenceDate = new Date()) => {
  const parsedValue = parseConversationDate(value);
  if (!parsedValue) return false;
  return (referenceDate.getTime() - parsedValue.getTime()) <= windowMs;
};

const shouldIncludePricingForService = ({
  conversation,
  serviceKind,
  now = new Date(),
  force = false,
} = {}) => {
  if (force) {
    return true;
  }

  if (!serviceKind) {
    return false;
  }

  if (conversation?.lastServiceType !== serviceKind) {
    return true;
  }

  return !isTimestampWithinWindow(conversation?.pricingExplainedAt, PRICING_REPEAT_WINDOW_MS, now);
};

const getRecentOfferedSlots = (conversation, now = new Date()) => {
  if (!isTimestampWithinWindow(conversation?.slotOfferSentAt, SLOT_REPEAT_WINDOW_MS, now)) {
    return [];
  }

  return Array.isArray(conversation?.lastOfferedSlots)
    ? conversation.lastOfferedSlots.filter((slot) => slot?.date && slot?.time)
    : [];
};

const getServiceKindFromState = (stateBase) => {
  if (stateBase === FLOW_STATES.RESPIRATORIO) return FLOW_STATES.RESPIRATORIO;
  if (stateBase === FLOW_STATES.PAMI) return FLOW_STATES.PAMI;
  return FLOW_STATES.PARTICULAR;
};

const getServiceKindFromMessage = (normalizedText, currentStateBase) => {
  if (hasRespiratoryIntent(normalizedText) || currentStateBase === FLOW_STATES.RESPIRATORIO) {
    return FLOW_STATES.RESPIRATORIO;
  }
  if (hasPamiIntent(normalizedText) || currentStateBase === FLOW_STATES.PAMI) {
    return FLOW_STATES.PAMI;
  }
  return FLOW_STATES.PARTICULAR;
};

const padDatePart = (value) => String(value).padStart(2, '0');

const formatSlotCalendarDate = (date) => (
  `${padDatePart(date.getDate())}/${padDatePart(date.getMonth() + 1)}/${String(date.getFullYear()).slice(-2)}`
);

const formatSlotLabel = (slot) => {
  const startsAt = slot?.startsAt instanceof Date ? slot.startsAt : new Date(slot?.startsAt || `${slot?.date}T12:00:00`);
  if (Number.isNaN(startsAt.getTime())) {
    return slot?.time ? `a las ${slot.time} hs` : 'en el próximo horario disponible';
  }

  return `${WEEKDAY_NAMES[startsAt.getDay()]} ${formatSlotCalendarDate(startsAt)} a las ${slot.time} hs`;
};

const joinSlotLabels = (slots = []) => slots.map((slot) => formatSlotLabel(slot)).join(' o ');

const buildGenericPriceReply = ({ seed }) => {
  const pricing = getCurrentPricing();
  return [
    `${pickVariant(['Hola 😊', 'Claro', 'Buenísimo'], seed)} Particular hoy está en ${formatCurrency(pricing.particular)}.`,
    'Contame la zona y te paso horarios.',
  ].join('\n');
};

const buildParticularIntroReply = ({ seed, includePricing = true }) => {
  const pricing = getCurrentPricing();
  if (!includePricing) {
    return [
      `${pickVariant(['Claro', 'Perfecto 😊', 'Dale'], seed)}`,
      'Decime la zona y te paso horarios.',
    ].join('\n');
  }

  return [
    `${pickVariant(['Claro', 'Perfecto 😊', 'Buenísimo'], seed)} Particular hoy está en ${formatCurrency(pricing.particular)}.`,
    'Decime la zona y te paso horarios.',
  ].join('\n');
};

const buildInsuranceDocsReply = () => {
  return [
    'Perfecto 😊 Si es por obra social, mandanos foto de la orden y la credencial.',
    'Lo revisamos y seguimos por acá manualmente.',
  ].join('\n');
};

const buildArtDocsReply = () => {
  return [
    'Perfecto 😊 Si es ART, mandanos foto de la orden y el número de siniestro si ya lo tenés.',
    'Lo revisamos administrativamente y seguimos por acá.',
  ].join('\n');
};

const buildSpecialCoverageReply = ({ label, availability }) => {
  if (availability === SPECIAL_COVERAGE_AVAILABILITY.SUSPENDED) {
    return [
      `Perfecto 😊 ${label} hoy está suspendida.`,
      'Si querés avanzar por particular, decime si es respiratorio o qué necesitás tratar y te paso horarios.',
    ].join('\n');
  }

  return [
    `Perfecto 😊 ${label} por ahora no la estamos trabajando.`,
    'Si querés avanzar por particular, decime si es respiratorio o qué necesitás tratar y te paso horarios.',
  ].join('\n');
};

const buildPamiIntroReply = ({ seed, includePricing = true }) => {
  const pricing = getCurrentPricing();
  if (!includePricing) {
    return [
      `${pickVariant(['Claro', 'Perfecto 😊', 'Dale'], seed)}`,
      'Decime la zona y te paso horarios.',
    ].join('\n');
  }

  return [
    `${pickVariant(['Claro', 'Perfecto 😊', 'Buenísimo'], seed)} PAMI particular hoy está en ${formatCurrency(pricing.pami)} por sesión.`,
    'Decime la zona y te paso horarios.',
  ].join('\n');
};

const buildDocumentationRequestReply = ({ kind, seed }) => {
  const basePrefix = pickVariant(['Perfecto 😊', 'Buenísimo', 'Dale'], seed);
  if (kind === FLOW_STATES.PAMI) {
    return [
      `${basePrefix}`,
      'Mandame nombre, apellido y fecha de nacimiento.',
      'Si ya tenés la orden, sumala.',
    ].join('\n');
  }

  return [
    `${basePrefix}`,
    'Mandame nombre, apellido y fecha de nacimiento.',
    'Si ya tenés la orden, sumala.',
  ].join('\n');
};

const buildHumanHandoffReply = (seed) => pickVariant([
  'Eso lo revisa administración y seguimos por acá.',
  'Ese punto lo ve administración. Seguimos por acá.',
  'Lo paso a administración y seguimos por este medio.',
], seed);

const buildTurnChangeHandoffReply = (seed) => pickVariant([
  'Perfecto 😊\nAhora lo revisamos y seguimos por acá.',
  'Dale 😊\nYa lo vemos y te confirmamos por acá.',
  'Perfecto 😊\nLo vemos y seguimos por acá.',
], seed);

const buildPriceObjectionReply = (seed) => [
  `${pickVariant(['Claro', 'Perfecto 😊', 'Dale'], seed)} Se puede abonar sesión por sesión.`,
  'Si querés, seguimos con una opción.',
].join('\n');

const buildNoAvailabilityReply = () => [
  'Ahora no me quedó un hueco claro.',
  'Lo sigo viendo y te escribo por acá.',
].join('\n');

const buildSlotPreferenceMissReply = (fallbackSlot) => {
  if (!fallbackSlot) {
    return [
      'Con ese horario no me quedó lugar.',
      'Si querés, busco otra opción.',
    ].join('\n');
  }

  return [
    'Con ese horario no me quedó lugar.',
    `Lo más cercano es ${formatSlotLabel(fallbackSlot)}.`,
  ].join('\n');
};

const getWhatsAppMinDaysAhead = (kind) => (
  kind === FLOW_STATES.OBRA_SOCIAL ? 2 : 1
);

const buildSlotOfferReply = async ({
  prisma,
  kind,
  seed,
  urgent = false,
  includePricing = true,
  slotPreference = null,
  excludedSlots = [],
}) => {
  const minDaysAhead = getWhatsAppMinDaysAhead(kind);
  const schedulingConfig = kind === FLOW_STATES.PAMI
    ? { horizonDays: 14, minLeadMinutes: 180, minDaysAhead, preferLowerOccupancy: true }
    : urgent
      ? { horizonDays: 7, minLeadMinutes: 60, minDaysAhead, preferLowerOccupancy: false }
      : { horizonDays: 12, minLeadMinutes: 120, minDaysAhead, preferLowerOccupancy: true };

  const suggestedSlots = await getSuggestedWhatsAppSlots({
    prisma,
    maxSlots: 2,
    horizonDays: schedulingConfig.horizonDays,
    minLeadMinutes: schedulingConfig.minLeadMinutes,
    minDaysAhead: schedulingConfig.minDaysAhead,
    preferLowerOccupancy: schedulingConfig.preferLowerOccupancy,
    serviceKind: kind,
    slotPreference,
    excludedSlots,
  });

  if (!suggestedSlots.length && excludedSlots.length) {
    suggestedSlots = await getSuggestedWhatsAppSlots({
      prisma,
      maxSlots: 2,
      horizonDays: schedulingConfig.horizonDays,
      minLeadMinutes: schedulingConfig.minLeadMinutes,
      minDaysAhead: schedulingConfig.minDaysAhead,
      preferLowerOccupancy: schedulingConfig.preferLowerOccupancy,
      serviceKind: kind,
      slotPreference,
    });
  }

  if (!suggestedSlots.length && slotPreference) {
    const fallbackSlots = await getSuggestedWhatsAppSlots({
      prisma,
      maxSlots: 1,
      horizonDays: schedulingConfig.horizonDays,
      minLeadMinutes: schedulingConfig.minLeadMinutes,
      minDaysAhead: schedulingConfig.minDaysAhead,
      preferLowerOccupancy: schedulingConfig.preferLowerOccupancy,
      serviceKind: kind,
    });

    return {
      type: 'text',
      text: buildSlotPreferenceMissReply(fallbackSlots[0]),
      nextState: buildFlowState(kind, FLOW_META.OFFER),
      memory: {
        serviceKind: kind,
      },
    };
  }

  if (!suggestedSlots.length) {
    return {
      type: 'text',
      text: buildNoAvailabilityReply(),
      nextState: FLOW_STATES.WAITING_HUMAN_REVIEW,
      memory: {
        serviceKind: kind,
      },
    };
  }

  const pricing = getCurrentPricing();
  const priceLine = kind === FLOW_STATES.RESPIRATORIO
    ? `Las sesiones respiratorias están en ${formatCurrency(pricing.respiratorio)}.`
    : kind === FLOW_STATES.PAMI
      ? `PAMI particular hoy está en ${formatCurrency(pricing.pami)} por sesión.`
      : `Las sesiones particulares están en ${formatCurrency(pricing.particular)}.`;

  const urgencyLine = kind === FLOW_STATES.RESPIRATORIO
    ? 'Conviene arrancar rápido para sostener la evolución respiratoria.'
    : 'En estos casos conviene arrancar rápido para no perder movilidad.';

  const lines = [];

  if (urgent) {
    lines.push(urgencyLine);
  } else if (!includePricing) {
    lines.push(pickVariant(['Dale 😊', 'Perfecto 😊', 'Buenísimo'], seed));
  }

  if (includePricing) {
    lines.push(priceLine);
  }

  lines.push(`Tengo ${joinSlotLabels(suggestedSlots)}.`);
  lines.push('Si una te sirve, avanzamos.');

  return {
    type: 'text',
    text: lines.filter(Boolean).join('\n'),
    nextState: buildFlowState(kind, FLOW_META.OFFER),
    memory: {
      serviceKind: kind,
      pricingExplained: includePricing,
      slotOfferSent: true,
      offeredSlots: suggestedSlots.map((slot) => ({ date: slot.date, time: slot.time })),
    },
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildCoverageDocsState = (kind = FLOW_META.OBRA_SOCIAL) => (
  buildFlowState(FLOW_STATES.OBRA_SOCIAL_DOCS, kind)
);

const buildConversationMemoryUpdate = (autoReply, now = new Date()) => {
  const memory = autoReply?.memory || {};
  const nextData = {};

  if (memory.serviceKind !== undefined) {
    nextData.lastServiceType = memory.serviceKind;
  }

  if (memory.pricingExplained) {
    nextData.pricingExplainedAt = now;
  }

  if (memory.slotOfferSent) {
    nextData.slotOfferSentAt = now;
    nextData.lastOfferedSlots = Array.isArray(memory.offeredSlots) ? memory.offeredSlots : [];
  }

  if (memory.clearSlotOffer) {
    nextData.slotOfferSentAt = null;
    nextData.lastOfferedSlots = null;
  }

  return nextData;
};

const getRandomAutoReplyDelayMs = () => (
  AUTO_REPLY_MIN_DELAY_MS
  + Math.floor(Math.random() * ((AUTO_REPLY_MAX_DELAY_MS - AUTO_REPLY_MIN_DELAY_MS) + 1))
);

const shouldSkipAutoReplyForCooldown = ({ conversation, currentState, nextState, now = new Date() }) => {
  const lastAutoReplyAt = conversation?.lastAutoReplyAt ? new Date(conversation.lastAutoReplyAt) : null;
  if (!lastAutoReplyAt || Number.isNaN(lastAutoReplyAt.getTime())) {
    return false;
  }

  const elapsedMs = now.getTime() - lastAutoReplyAt.getTime();
  if (elapsedMs >= AUTO_REPLY_COOLDOWN_MS) {
    return false;
  }

  return String(nextState || currentState || '') === String(currentState || '');
};

const getDirectIntentReply = (normalizedText) => {
  const matchedRule = DIRECT_INTENT_RULES.find(({ patterns }) => patterns.some((pattern) => pattern.test(normalizedText)));
  if (!matchedRule) return null;

  return {
    type: 'text',
    text: matchedRule.text,
    nextState: matchedRule.nextState,
  };
};

const getConversationAutoReply = async ({
  prisma,
  conversation,
  messageText,
  messageType = 'text',
  currentState,
  shouldSendWelcome,
  hasNonTextMessage = false,
  hasMediaAttachment = false,
  now = new Date(),
}) => {
  const normalized = normalizeText(messageText);
  const currentStateBase = getFlowStateBase(currentState);
  const slotPreference = extractSlotPreference(normalized);
  const recentOfferedSlots = getRecentOfferedSlots(conversation, now);

  if (messageType === 'reaction') {
    return null;
  }

  if (normalized && isMenuCommand(normalized)) {
    return { type: 'welcome', nextState: FLOW_STATES.WELCOME };
  }

  if (currentStateBase === FLOW_STATES.HUMAN_HANDOFF) {
    return null;
  }

  if (normalized && isLocationIntent(normalized)) {
    return {
      type: 'text',
      text: AUTO_REPLY_LOCATION_TEXT,
      nextState: FLOW_STATES.LOCATION,
    };
  }

  if (normalized && hasHumanHandoffIntent(normalized)) {
    return {
      type: 'text',
      text: buildTurnChangeHandoffReply(normalized),
      nextState: FLOW_STATES.HUMAN_HANDOFF,
      memory: {
        clearSlotOffer: true,
      },
    };
  }

  if (
    isCollectingDocumentation(currentState)
    && (
      hasMediaAttachment
      || (normalized && isListoCommand(normalized))
      || (normalized && hasDocumentationText(normalized))
    )
  ) {
    return {
      type: 'text',
      text: DOCUMENTATION_RECEIVED_TEXT,
      nextState: FLOW_STATES.WAITING_HUMAN_REVIEW,
      memory: {
        clearSlotOffer: true,
      },
    };
  }

  if (normalized && hasComplexAdminIntent(normalized)) {
    return {
      type: 'text',
      text: buildHumanHandoffReply(normalized),
      nextState: FLOW_STATES.WAITING_HUMAN_REVIEW,
      memory: {
        clearSlotOffer: true,
      },
    };
  }

  if (
    normalized
    && (currentStateBase === FLOW_STATES.OBRA_SOCIAL || currentStateBase === FLOW_STATES.OBRA_SOCIAL_UNAVAILABLE)
    && !isMenuCommand(normalized)
  ) {
    return {
      type: 'text',
      text: buildInsuranceDocsReply(),
      nextState: buildCoverageDocsState(FLOW_META.OBRA_SOCIAL),
      memory: {
        clearSlotOffer: true,
      },
    };
  }

  if (
    normalized
    && currentStateBase === FLOW_STATES.OBRA_SOCIAL_DOCS
    && !isMenuCommand(normalized)
  ) {
    return {
      type: 'text',
      text: hasFlowMeta(currentState, FLOW_META.ART) ? buildArtDocsReply() : buildInsuranceDocsReply(),
      nextState: currentState,
      memory: {
        clearSlotOffer: true,
      },
    };
  }

  if (normalized) {
    const directIntentReply = getDirectIntentReply(normalized);
    if (directIntentReply) return directIntentReply;
  }

  if (normalized) {
    const inactiveCoverageIntent = getInactiveCoverageIntent(normalized);
    if (inactiveCoverageIntent) {
      return {
        type: 'text',
        text: buildSpecialCoverageReply(inactiveCoverageIntent),
        nextState: FLOW_STATES.PARTICULAR,
      };
    }

    const specialCoverageIntent = getSpecialCoverageIntent(normalized);
    if (specialCoverageIntent) {
      return {
        type: 'text',
        text: buildSpecialCoverageReply(specialCoverageIntent),
        nextState: FLOW_STATES.PARTICULAR,
      };
    }
  }

  if (normalized && hasArtIntent(normalized)) {
    return {
      type: 'text',
      text: buildArtDocsReply(),
      nextState: buildCoverageDocsState(FLOW_META.ART),
      memory: {
        clearSlotOffer: true,
      },
    };
  }

  if (normalized && hasInsuranceIntent(normalized) && !hasPamiIntent(normalized)) {
    return {
      type: 'text',
      text: buildInsuranceDocsReply(),
      nextState: buildCoverageDocsState(FLOW_META.OBRA_SOCIAL),
      memory: {
        clearSlotOffer: true,
      },
    };
  }

  if (normalized && hasPamiIntent(normalized) && currentStateBase !== FLOW_STATES.PAMI && !hasClinicalReason(normalized) && !hasSlotRequestIntent(normalized)) {
    const includePricing = shouldIncludePricingForService({
      conversation,
      serviceKind: FLOW_STATES.PAMI,
      now,
      force: hasPriceIntent(normalized),
    });

    return {
      type: 'text',
      text: buildPamiIntroReply({ seed: normalized, includePricing }),
      nextState: FLOW_STATES.PAMI,
      memory: {
        serviceKind: FLOW_STATES.PAMI,
        pricingExplained: includePricing,
      },
    };
  }

  if (normalized && hasPriceObjection(normalized) && isAwaitingSlotChoice(currentState)) {
    return {
      type: 'text',
      text: buildPriceObjectionReply(normalized),
      nextState: currentState,
    };
  }

  if (normalized && isAwaitingSlotChoice(currentState) && hasBookingCommitment(normalized)) {
    const serviceKind = getServiceKindFromState(currentStateBase);
    return {
      type: 'text',
      text: buildDocumentationRequestReply({ kind: serviceKind, seed: normalized }),
      nextState: buildFlowState(serviceKind, FLOW_META.DOCS),
      memory: {
        serviceKind,
        clearSlotOffer: true,
      },
    };
  }

  if (
    normalized
    && isAwaitingSlotChoice(currentState)
    && (slotPreference || hasWhenIntent(normalized) || hasSlotRequestIntent(normalized))
  ) {
    const serviceKind = getServiceKindFromState(currentStateBase);
    return buildSlotOfferReply({
      prisma,
      kind: serviceKind,
      seed: normalized,
      urgent: serviceKind === FLOW_STATES.RESPIRATORIO,
      includePricing: false,
      slotPreference,
      excludedSlots: recentOfferedSlots,
    });
  }

  if (normalized && currentStateBase === FLOW_STATES.WELCOME && hasPriceIntent(normalized) && !hasClinicalReason(normalized) && !hasInsuranceIntent(normalized)) {
    return {
      type: 'text',
      text: buildGenericPriceReply({ seed: normalized }),
      nextState: FLOW_STATES.PARTICULAR,
      memory: {
        serviceKind: FLOW_STATES.PARTICULAR,
        pricingExplained: true,
      },
    };
  }

  if (
    normalized
    && (
      currentStateBase === FLOW_STATES.PARTICULAR
      || currentStateBase === FLOW_STATES.PAMI
      || currentStateBase === FLOW_STATES.RESPIRATORIO
      || currentStateBase === FLOW_STATES.WELCOME
      || currentStateBase === FLOW_STATES.LOCATION
    )
  ) {
    const serviceKind = getServiceKindFromMessage(normalized, currentStateBase);
    const includePricing = shouldIncludePricingForService({
      conversation,
      serviceKind,
      now,
      force: hasPriceIntent(normalized),
    });
    const shouldOfferSlots = hasClinicalReason(normalized)
      || hasSlotRequestIntent(normalized)
      || hasWhenIntent(normalized)
      || Boolean(slotPreference)
      || (serviceKind === FLOW_STATES.RESPIRATORIO && hasRespiratoryIntent(normalized));

    if (serviceKind === FLOW_STATES.PAMI && !shouldOfferSlots && currentStateBase === FLOW_STATES.PAMI) {
      return {
        type: 'text',
        text: buildPamiIntroReply({ seed: normalized, includePricing }),
        nextState: FLOW_STATES.PAMI,
        memory: {
          serviceKind: FLOW_STATES.PAMI,
          pricingExplained: includePricing,
        },
      };
    }

    if (shouldOfferSlots) {
      return buildSlotOfferReply({
        prisma,
        kind: serviceKind,
        seed: normalized,
        urgent: hasUrgentIntent(normalized) || hasNeuroIntent(normalized) || serviceKind === FLOW_STATES.RESPIRATORIO,
        includePricing,
        slotPreference,
        excludedSlots: recentOfferedSlots,
      });
    }

    if (serviceKind === FLOW_STATES.PARTICULAR && (hasParticularIntent(normalized) || currentStateBase === FLOW_STATES.PARTICULAR) && !shouldOfferSlots) {
      return {
        type: 'text',
        text: hasPriceIntent(normalized)
          ? buildGenericPriceReply({ seed: normalized })
          : buildParticularIntroReply({
            seed: normalized,
            includePricing: hasPriceIntent(normalized) ? true : includePricing,
          }),
        nextState: FLOW_STATES.PARTICULAR,
        memory: {
          serviceKind: FLOW_STATES.PARTICULAR,
          pricingExplained: hasPriceIntent(normalized) || includePricing,
        },
      };
    }
  }

  if (shouldSendWelcome && (normalized || hasNonTextMessage)) {
    return { type: 'welcome', nextState: FLOW_STATES.WELCOME };
  }

  if (normalized && currentStateBase === FLOW_STATES.WELCOME && isGreeting(normalized)) {
    return { type: 'welcome', nextState: FLOW_STATES.WELCOME };
  }

  if (!normalized && hasNonTextMessage) {
    return null;
  }

  if (isCollectingDocumentation(currentState)) {
    return null;
  }

  if (normalized && currentStateBase === FLOW_STATES.WAITING_HUMAN_REVIEW) {
    return {
      type: 'text',
      text: WAITING_HUMAN_REVIEW_TEXT,
      nextState: FLOW_STATES.WAITING_HUMAN_REVIEW,
    };
  }

  if (normalized) {
    return {
      type: 'text',
      text: UNKNOWN_INPUT_TEXT,
      nextState: currentState,
    };
  }

  return null;
};

const extractPatientName = (messageText) => {
  const text = String(messageText || '').trim();
  if (!text) return null;

  const match = text.match(/\b(?:soy|me llamo|mi nombre es)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]{2,50})/i);
  if (!match?.[1]) return null;

  const normalized = match[1]
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .slice(0, 3)
    .join(' ');

  return normalized || null;
};

const getIncomingProfileName = (value, waId) => {
  const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
  const matchedContact = contacts.find((contact) => String(contact?.wa_id || '').trim() === String(waId || '').trim());
  return matchedContact?.profile?.name || contacts[0]?.profile?.name || null;
};

const storeInboundMedia = async ({ mediaId, mimeType, conversationId }) => {
  if (!mediaId) return null;
  const mediaInfo = await fetchMediaInfo(mediaId);
  const buffer = await downloadMedia(mediaInfo.url);
  const contentType = mimeType || mediaInfo.mime_type || 'application/octet-stream';
  const ext = MIME_EXTENSION[contentType] || 'bin';
  const key = `whatsapp/${conversationId}/${mediaId}.${ext}`;

  const mediaUrl = await uploadBufferToStorage({
    buffer,
    key,
    contentType,
  });

  return {
    mediaUrl,
    buffer,
    contentType,
  };
};

export const verifyWhatsAppWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
};

export const handleWhatsAppWebhook = async (req, res, prisma) => {
  try {
    const body = req.body;
    if (!body || body.object !== 'whatsapp_business_account') return res.sendStatus(404);

    const requestLogger = req.logger || logger;

    const entries = body.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const messages = value.messages || [];
        
        for (const message of messages) {
          const existing = await prisma.whatsAppMessage.findUnique({ where: { waMessageId: message.id } });
          if (existing) continue;

          const incomingProfileName = getIncomingProfileName(value, message.from);
          const { conversation, isNew } = await ensureConversation({
            prisma,
            waId: message.from,
            profileName: incomingProfileName,
            phone: message.from,
          });
          const whatsappLogger = createWhatsAppLogger(requestLogger, {
            conversationId: conversation.id,
            phone: conversation.phone || conversation.waId || message.from,
            messageType: message.type,
          });

          const now = new Date();
          const lastInbound = await prisma.whatsAppMessage.findFirst({
            where: { conversationId: conversation.id, direction: 'inbound' },
            orderBy: { createdAt: 'desc' },
          });

          const shouldResetSession = isNew
            || !lastInbound
            || (now - new Date(lastInbound.createdAt) > WELCOME_COOLDOWN_MS);

          const mediaMeta = getMediaInfoFromMessage(message);
          let mediaUrl = null;
          let mediaBuffer = null;
          let mediaMimeType = mediaMeta?.mimeType || null;

          if (mediaMeta?.mediaId) {
            const storedMedia = await storeInboundMedia({
              mediaId: mediaMeta.mediaId,
              mimeType: mediaMeta.mimeType,
              conversationId: conversation.id,
            });
            mediaUrl = storedMedia?.mediaUrl || null;
            mediaBuffer = storedMedia?.buffer || null;
            mediaMimeType = storedMedia?.contentType || mediaMimeType;
          }

          let transcribedAudioText = null;
          if (isAudioMessageType(message.type, mediaMimeType) && mediaBuffer) {
            try {
              transcribedAudioText = await transcribeAudioBuffer({
                audioBuffer: mediaBuffer,
                mimeType: mediaMimeType,
              });
            } catch (transcriptionError) {
              whatsappLogger.error('Error transcribiendo audio de WhatsApp', {
                errorMessage: transcriptionError.message,
              });
            }
          }

          const inboundText = message.type === 'text'
            ? message.text?.body || ''
            : (transcribedAudioText || '');
          const extractedPatientName = extractPatientName(inboundText);
          const effectiveState = shouldResetSession
            ? FLOW_STATES.WELCOME
            : (conversation.currentState || FLOW_STATES.WELCOME);
          const autoReply = WHATSAPP_AUTOREPLY_ENABLED
            ? await getConversationAutoReply({
              prisma,
              conversation,
              messageText: inboundText,
              messageType: message.type,
              currentState: effectiveState,
              shouldSendWelcome: shouldResetSession,
              hasNonTextMessage: message.type !== 'text',
              hasMediaAttachment: Boolean(mediaMeta?.mediaId),
              now,
            })
            : null;
          const nextConversationState = autoReply?.nextState || effectiveState;
          const nextProfileName = extractedPatientName || incomingProfileName || conversation.profileName;
          const shouldSkipAutoReply = autoReply && shouldSkipAutoReplyForCooldown({
            conversation,
            currentState: effectiveState,
            nextState: nextConversationState,
            now,
          });
          const storedInboundText = buildStoredInboundText({
            message,
            transcribedText: transcribedAudioText,
            mimeType: mediaMimeType,
          });

          await prisma.whatsAppMessage.create({
            data: {
              conversationId: conversation.id,
              direction: 'inbound',
              type: message.type,
              text: storedInboundText,
              mediaUrl,
              mediaMime: mediaMimeType,
              mediaSha256: mediaMeta?.sha256,
              mediaName: mediaMeta?.filename,
              waMessageId: message.id,
              status: 'received',
            },
          });

          await prisma.whatsAppConversation.update({
            where: { id: conversation.id },
            data: {
              lastMessageAt: new Date(),
              lastMessageText: storedInboundText,
              profileName: nextProfileName || undefined,
              currentState: nextConversationState,
              unreadCount: { increment: 1 },
            },
          });

          // Enviar notificación Push a los administradores
          try {
            const totalUnread = await prisma.whatsAppConversation.aggregate({
              _sum: { unreadCount: true }
            });
            
            await sendNotificationToAll(prisma, {
              title: `Mensaje de ${nextProfileName || conversation.phone}`,
              body: storedInboundText,
              icon: '/icon-192x192.png',
              unreadCount: totalUnread._sum.unreadCount || 0,
              data: {
                url: `/whatsapp/${conversation.id}`,
                conversationId: conversation.id
              }
            });
          } catch (pushError) {
            whatsappLogger.error('Error enviando notificación push', {
              errorMessage: pushError.message,
            });
          }

          if (autoReply && !shouldSkipAutoReply) {
            try {
              await sleep(getRandomAutoReplyDelayMs());

              let outboundText = autoReply.text;
              let response = null;
              let outboundType = 'text';

              if (autoReply.type === 'welcome') {
                const welcomeResult = await sendWelcomeReply({
                  to: conversation.waId,
                  patientName: nextProfileName,
                  baseLogger: whatsappLogger,
                });

                response = welcomeResult.response;
                outboundText = welcomeResult.outboundText;
                outboundType = welcomeResult.outboundType;
              } else {
                response = await sendTextMessage({
                  to: conversation.waId,
                  text: outboundText,
                });
              }

              await prisma.whatsAppMessage.create({
                data: {
                  conversationId: conversation.id,
                  direction: 'outbound',
                  type: outboundType,
                  text: outboundText,
                  waMessageId: response?.messages?.[0]?.id,
                  status: 'sent',
                },
              });

              const memoryUpdate = buildConversationMemoryUpdate(autoReply, new Date());
              await prisma.whatsAppConversation.update({
                where: { id: conversation.id },
                data: {
                  lastAutoReplyAt: new Date(),
                  ...memoryUpdate,
                },
              });

              whatsappLogger.info('WA auto reply sent', {
                conversationId: conversation.id,
                currentState: effectiveState,
                nextState: nextConversationState,
                inboundText,
                outboundText,
                outboundType,
              });
            } catch (err) {
              whatsappLogger.error('Error enviando respuesta automática', {
                errorMessage: err.message,
              });
            }
          } else if (autoReply && shouldSkipAutoReply) {
            whatsappLogger.info('WA auto reply skipped', {
              conversationId: conversation.id,
              currentState: effectiveState,
              nextState: nextConversationState,
              inboundText,
              reason: 'cooldown',
            });
          }
        }

        if (value.statuses) {
          for (const status of value.statuses) {
            await prisma.whatsAppMessage.updateMany({
              where: { waMessageId: status.id },
              data: { status: status.status },
            });
          }
        }
      }
    }
    return res.sendStatus(200);
  } catch (error) {
    (req.logger || logger).error('ERROR WHATSAPP WEBHOOK', {
      errorMessage: error.message,
    });
    return res.sendStatus(200);
  }
};

export const listConversations = async (req, res, prisma) => {
  const conversations = await prisma.whatsAppConversation.findMany({
    orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
  });
  res.json(conversations);
};

export const listMessages = async (req, res, prisma) => {
  const { id } = req.params;
  const messages = await prisma.whatsAppMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: 'asc' },
  });
  res.json(messages);
};

export const markConversationRead = async (req, res, prisma) => {
  const { id } = req.params;
  await prisma.whatsAppConversation.update({ where: { id }, data: { unreadCount: 0 } });
  res.json({ success: true });
};

export const pauseConversationBot = async (req, res, prisma) => {
  const { id } = req.params;

  try {
    await prisma.whatsAppConversation.update({
      where: { id },
      data: { currentState: FLOW_STATES.HUMAN_HANDOFF },
    });

    res.json({ success: true, currentState: FLOW_STATES.HUMAN_HANDOFF });
  } catch (error) {
    throw createInternalError(error, 'No se pudo pausar el bot en esta conversación.');
  }
};

export const resumeConversationBot = async (req, res, prisma) => {
  const { id } = req.params;

  try {
    await prisma.whatsAppConversation.update({
      where: { id },
      data: { currentState: FLOW_STATES.WELCOME },
    });

    res.json({ success: true, currentState: FLOW_STATES.WELCOME });
  } catch (error) {
    throw createInternalError(error, 'No se pudo reactivar el bot en esta conversación.');
  }
};

export const deleteConversation = async (req, res, prisma) => {
  const { id } = req.params;
  try {
    await prisma.whatsAppMessage.deleteMany({ where: { conversationId: id } });
    await prisma.whatsAppConversation.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    throw createInternalError(error, 'Error al eliminar la conversación');
  }
};

export const sendConversationMessage = async (req, res, prisma) => {
  const { id } = req.params;
  const text = normalizeOutgoingText(req.body?.text);
  const file = req.file;

  if (!text && !file) {
    return res.status(400).json({ message: 'Debes escribir un mensaje o adjuntar un archivo.' });
  }

  const conversation = await prisma.whatsAppConversation.findUnique({ where: { id } });
  if (!conversation) return res.status(404).json({ message: 'No encontrada' });

  try {
    const createdMessages = [];
    let lastMessageText = text || WHATSAPP_OUTBOUND_PLACEHOLDER;

    if (text) {
      const response = await sendTextMessage({ to: conversation.waId, text });
      const waMessageId = response?.messages?.[0]?.id;

      const createdTextMessage = await prisma.whatsAppMessage.create({
        data: {
          conversationId: conversation.id,
          direction: 'outbound',
          type: 'text',
          text,
          waMessageId,
          status: 'sent',
        },
      });

      createdMessages.push(createdTextMessage);
    }

    if (file) {
      const filename = sanitizeFilename(file.originalname, 'archivo');
      const mediaUrl = await storeOutboundMedia({
        conversationId: conversation.id,
        file,
      });
      const uploadResult = await uploadMedia({
        buffer: file.buffer,
        filename,
        mimeType: file.mimetype || 'application/octet-stream',
      });
      if (!uploadResult?.id) {
        throw new Error('No se pudo obtener el identificador del archivo en WhatsApp.');
      }
      const response = await sendDocumentMessage({
        to: conversation.waId,
        mediaId: uploadResult?.id,
        filename,
      });

      const createdFileMessage = await prisma.whatsAppMessage.create({
        data: {
          conversationId: conversation.id,
          direction: 'outbound',
          type: file.mimetype?.startsWith('image/') ? 'image' : 'document',
          text: filename || WHATSAPP_OUTBOUND_PLACEHOLDER,
          mediaUrl,
          mediaMime: file.mimetype,
          mediaName: filename,
          waMessageId: response?.messages?.[0]?.id,
          status: 'sent',
        },
      });

      createdMessages.push(createdFileMessage);
      lastMessageText = `[Archivo] ${filename}`;
    }

    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastMessageText,
        currentState: FLOW_STATES.HUMAN_HANDOFF,
      },
    });

    res.json({ success: true, messages: createdMessages });
  } catch (error) {
    throw createInternalError(error, 'Error al enviar');
  }
};

export const sendWelcomeTemplate = async (req, res, prisma) => {
  const { id } = req.params;
  const conversation = await prisma.whatsAppConversation.findUnique({ where: { id } });
  if (!conversation) return res.status(404).json({ message: 'Conversación no encontrada' });
  const conversationLogger = createWhatsAppLogger(req.logger || logger, {
    conversationId: conversation.id,
    phone: conversation.waId,
  });

  try {
    const result = await sendWelcomeReply({
      to: conversation.waId,
      patientName: conversation.profileName,
      templateName: WELCOME_TEMPLATE,
      baseLogger: conversationLogger,
    });

    const waMessageId = result.response?.messages?.[0]?.id;

    await prisma.whatsAppMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'outbound',
        type: result.outboundType,
        text: result.outboundText,
        waMessageId,
        status: 'sent',
      },
    });

    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { currentState: FLOW_STATES.WELCOME },
    });

    res.json({ success: true, type: result.outboundType });
  } catch (error) {
    throw createInternalError(error, 'Error al enviar saludo');
  }
};
