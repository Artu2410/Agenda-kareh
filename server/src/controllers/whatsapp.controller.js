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
import { normalizePhone } from '../utils/phone.js';
import {
  findInMemoryWhatsAppCoverageByInput,
} from '../utils/whatsappCoverageCatalog.js';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WELCOME_TEMPLATE = process.env.WHATSAPP_WELCOME_TEMPLATE || 'bienvenida_kareh';
const HOLA_TEMPLATE = process.env.WHATSAPP_HOLA_TEMPLATE || 'bienvenida_kareh';

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

const FLOW_STATE_SEPARATOR = '::';

const buildFlowState = (baseState, ...metaParts) => [
  baseState,
  ...metaParts.map((part) => String(part || '').trim()).filter(Boolean),
].join(FLOW_STATE_SEPARATOR);

const getFlowStateBase = (state) => String(state || FLOW_STATES.WELCOME)
  .split(FLOW_STATE_SEPARATOR)
  .filter(Boolean)[0] || FLOW_STATES.WELCOME;

const getFlowStateMeta = (state) => String(state || '')
  .split(FLOW_STATE_SEPARATOR)
  .slice(1)
  .filter(Boolean);

const DEFAULT_WELCOME_TEXT = [
  '¡Hola! {{1}} 👋',
  '*Bienvenido/a a Kinesiología Kareh* 🌿',
  '',
  'Para asesorarte con tu turno, por favor enviá el número de tu opción:',
  '',
  '1️⃣ Indicar nombre de Obra Social / Prepaga / ART',
  '2️⃣ Particular',
  '3️⃣ PAMI Particular',
  '4️⃣ Kinesiología Respiratoria',
  '5️⃣ Ubicación y Horarios 📍',
  '',
  'Estamos procesando los mensajes para responderte lo antes posible. ✨',
].join('\n');

const AUTO_REPLY_OBRA_SOCIAL_TEXT = [
  '¡Perfecto! Primero indicanos el nombre de tu Obra Social, Prepaga o ART.',
  '',
  'Vamos a revisar si está dentro de las coberturas que atendemos.',
  '',
  'Si trabajamos con esa cobertura, te pedimos la documentación para continuar.',
  'Si no está dentro del listado, te ofrecemos la opción *Particular*.',
  '',
  '0️⃣ Volver al inicio.',
].join('\n');

const buildInactiveCoverageReplyText = (coverageName) => [
  `Por el momento no contamos con convenio vigente para atención a través de *${coverageName}*.`,
  '',
  'Si querés, podés atenderte de forma *Particular*. Te compartimos la información:',
  '',
  '💰 Valor: $15.000 por zona a tratar (solo efectivo).',
  '',
  'Para coordinar tu turno, envianos:',
  '✅ Nombre, Apellido y DNI',
  '✅ Fecha de nacimiento',
  '✅ Diagnóstico: qué zona hay que tratar',
  '📸 Foto de la Orden Médica',
  '🩺 Antecedentes: Marcapasos, cáncer u otra condición.',
  '',
  'Cuando recibamos la documentación, un administrador seguirá la conversación para asignarte un horario. ✨',
  '',
  '0️⃣ Volver al inicio.',
].join('\n');

const buildActiveCoverageReplyText = (coverageName) => [
  `¡Perfecto! Tenemos convenio con *${coverageName}* ✅`,
  '',
  'Para verificar cobertura y coordinar el horario, necesitamos:',
  '',
  '✅ Nombre, Apellido y DNI',
  '✅ Fecha de nacimiento',
  '📸 Foto de la Orden Médica (legible)',
  '🩺 Antecedentes: Marcapasos, cáncer u otra condición.',
  '',
  'Cuando recibamos la documentación, un administrador seguirá la conversación y te ofrecerá los horarios disponibles. ⏳',
  '',
  '0️⃣ Volver al inicio.',
].join('\n');

const AUTO_REPLY_PARTICULAR_TEXT = [
  '¡Excelente! Información para sesiones *Particulares*:',
  '',
  '💰 Valor: $15.000 por zona a tratar (solo efectivo).',
  '',
  'Para coordinar tu turno, envianos:',
  '✅ Nombre, Apellido y DNI',
  '✅ Fecha de nacimiento',
  '✅ Diagnóstico: qué zona hay que tratar',
  '📸 Foto de la Orden Médica',
  '🩺 Antecedentes: Marcapasos, cáncer u otra condición.',
  '',
  'Cuando recibamos la documentación, un administrador seguirá la conversación para asignarte un horario. ✨',
  '',
  '0️⃣ Volver al inicio.',
].join('\n');

const AUTO_REPLY_PAMI_TEXT = [
  '¡Entendido! Para pacientes de PAMI el valor es diferencial:',
  '',
  '💰 Valor bonificado: $10.000 por zona a tratar (solo efectivo).',
  '',
  'Para reservar tu lugar, envianos:',
  '✅ Nombre, Apellido y DNI',
  '✅ Número de afiliado',
  '✅ Fecha de nacimiento',
  '📸 Foto de la Orden Médica (legible)',
  '🩺 Antecedentes: Marcapasos, cáncer u otra condición.',
  '',
  'Cuando recibamos la documentación, un administrador seguirá la conversación para coordinar el horario. ⏳',
  '',
  '0️⃣ Volver al inicio.',
].join('\n');

const AUTO_REPLY_RESPIRATORIO_TEXT = [
  '¡Excelente! Información para sesiones Respiratorias:',
  '',
  '💰 Valor: $30.000 (solo efectivo).',
  '',
  'Para coordinar tu turno, envianos:',
  '✅ Nombre, Apellido y DNI',
  '✅ Fecha de nacimiento',
  '✅ Diagnóstico',
  '📸 Foto de la Orden Médica',
  '🩺 Antecedentes: Marcapasos, cáncer u otra condición.',
  '',
  'Cuando recibamos la documentación, un administrador seguirá la conversación. ✨',
  '',
  '0️⃣ Volver al inicio.',
].join('\n');

const UNKNOWN_INPUT_TEXT = 'Perdón, no entendí eso. Por favor, enviá los datos solicitados o escribí *0* para volver al inicio. 🙏';
const WAITING_HUMAN_REVIEW_TEXT = 'Ya recibimos tu documentación. En breve te responde un administrador. Si necesitás volver al inicio, escribí *0*.';

const DOCUMENTATION_RECEIVED_TEXT = [
  '¡Gracias! Recibimos tu documentación correctamente.',
  'En breve te responde un administrador para continuar con el turno. ✨',
].join('\n');

const AUTO_REPLY_LOCATION_TEXT = [
  '📍 *Nuestra ubicación:*',
  'Av. Senador Morón 782, Bella Vista.',
  '🗺️ Google Maps: https://maps.app.goo.gl/ChIJccvYOMO9vJURBOmqm_VIytA',
  '',
  '⏰ *Horarios:*',
  '• Lunes y viernes: 14:00 a 19:00 hs.',
  '• Martes, miércoles y jueves: 17:30 a 19:00 hs.',
  '• Sábados: 08:00 a 12:00 hs.',
  '',
  '0️⃣ Volver al inicio.',
].join('\n');

const DOCUMENT_COLLECTION_STATES = new Set([
  FLOW_STATES.OBRA_SOCIAL_DOCS,
  FLOW_STATES.PARTICULAR,
  FLOW_STATES.PAMI,
  FLOW_STATES.RESPIRATORIO,
  FLOW_STATES.FINAL_DOCS,
]);

const DIRECT_INTENT_RULES = [
  {
    patterns: [/\b(rpg|rehabilitacion postural global|rehabilitación postural global|postural)\b/],
    text: 'Por el momento no contamos con la especialidad de RPG, pero con gusto podemos orientarte con otras opciones. Saludos.',
    nextState: FLOW_STATES.WELCOME,
  },
  {
    patterns: [/\b(vestibular|mareos|vertigo|vértigo)\b/],
    text: 'Por el momento no contamos con rehabilitación vestibular, pero con gusto podemos orientarte con otras opciones. Saludos.',
    nextState: FLOW_STATES.WELCOME,
  },
  {
    patterns: [/\b(drenaje|linfatico|linfático)\b/],
    text: 'Por el momento no contamos con drenaje linfático manual, pero con gusto podemos orientarte con otras opciones. Saludos.',
    nextState: FLOW_STATES.WELCOME,
  },
  {
    patterns: [/\b(domicilio|domiciliario|domiciliaria|en casa|en domicilio)\b/],
    text: 'Por el momento no realizamos atención a domicilio, pero con gusto podemos ayudarte a coordinar atención en consultorio. Saludos.',
    nextState: FLOW_STATES.WELCOME,
  },
  {
    patterns: [/^(1|1 obra social|1 prepaga|1 art)$/],
    text: AUTO_REPLY_OBRA_SOCIAL_TEXT,
    nextState: FLOW_STATES.OBRA_SOCIAL,
  },
  {
    patterns: [/\b(obra social|obras sociales|prepaga|art|carnet|cobertura)\b/],
    text: AUTO_REPLY_OBRA_SOCIAL_TEXT,
    nextState: FLOW_STATES.OBRA_SOCIAL,
  },
  {
    patterns: [/^(2|2 particular)$/],
    text: AUTO_REPLY_PARTICULAR_TEXT,
    nextState: FLOW_STATES.PARTICULAR,
  },
  {
    patterns: [/\b(particular|precio|precios|cuanto sale|cuanto cuesta|costo|costos|valor|efectivo|pagar en el centro)\b/],
    text: AUTO_REPLY_PARTICULAR_TEXT,
    nextState: FLOW_STATES.PARTICULAR,
  },
  {
    patterns: [/^(3|3 pami)$/],
    text: AUTO_REPLY_PAMI_TEXT,
    nextState: FLOW_STATES.PAMI,
  },
  {
    patterns: [/\b(pami|jubilado|jubilada|jubilados)\b/],
    text: AUTO_REPLY_PAMI_TEXT,
    nextState: FLOW_STATES.PAMI,
  },
  {
    patterns: [/^(4|4 respiratorio)$/],
    text: AUTO_REPLY_RESPIRATORIO_TEXT,
    nextState: FLOW_STATES.RESPIRATORIO,
  },
  {
    patterns: [/\b(respiratorio|respiratoria|nebulizacion|pecho|kinesiologia respiratoria|rehabilitacion respiratoria|respira)\b/],
    text: AUTO_REPLY_RESPIRATORIO_TEXT,
    nextState: FLOW_STATES.RESPIRATORIO,
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

const getPreviewText = (message) => {
  if (!message) return '';
  if (message.type === 'text') return message.text?.body || '';
  if (message.type === 'reaction') {
    const emoji = message.reaction?.emoji || '';
    return emoji ? `Reaccionó ${emoji}` : '[Reacción]';
  }
  if (message.type === 'sticker') return '[Sticker]';
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
    filename: payload.filename || (message.type === 'sticker' ? 'sticker.webp' : null),
    caption: payload.caption || null,
  };
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
}) => {
  const replyConfig = getReplyConfig({ replyKind, templateName });
  const outboundText = buildReplyText(replyConfig.textTemplate, patientName);
  const fallbackText = buildWelcomeFallbackText(patientName, replyConfig.textTemplate);

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

    console.warn('⚠️ Template automático rechazado por WhatsApp. Se enviará saludo de texto.', {
      templateName: replyConfig.templateName,
      detail: error?.detail?.error?.error_data?.details || error.message,
    });

    const response = await sendTextMessage({ to, text: outboundText || fallbackText });

    return {
      response,
      outboundType: 'text',
      outboundText: outboundText || fallbackText,
    };
  }
};

const normalizeOutgoingText = (value) => String(value || '')
  .replace(/\r\n/g, '\n')
  .replace(/\r/g, '\n')
  .trim();

const sanitizeFilename = (value, fallback = 'archivo') => {
  const normalized = String(value || fallback)
    .replace(/[^\w.\-() ]+/g, '_')
    .trim();
  return normalized || fallback;
};

const getFileExtension = (filename, mimeType) => {
  const ext = path.extname(filename || '').toLowerCase();
  if (ext) return ext;
  const mimeExt = MIME_EXTENSION[mimeType];
  return mimeExt ? `.${mimeExt}` : '.bin';
};

const storeOutboundMedia = async ({ conversationId, file }) => {
  const extension = getFileExtension(file.originalname, file.mimetype);
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

const GREETING_PREFIXES = ['hola', 'buenas', 'buen dia', 'buenos dias', 'buenas tardes', 'buenas noches'];

const MENU_COMMAND_PATTERNS = [/^(0|menu|menu principal|volver|inicio)(\b.*)?$/];
const LISTO_COMMAND_PATTERNS = [/^(listo|ya esta|ya envie todo|termine)(\b.*)?$/];
const GENERIC_COVERAGE_PROMPT_PATTERNS = [
  /^(obra social|obras sociales|prepaga|prepagas|art|cobertura|coberturas|mutual)(\b.*)?$/,
];

const matchesAnyPattern = (text, patterns) => patterns.some((pattern) => pattern.test(text));

const isGreeting = (normalizedText) => GREETING_PREFIXES.some(
  (prefix) => normalizedText === prefix || normalizedText.startsWith(`${prefix} `),
);

const isMenuCommand = (normalizedText) => matchesAnyPattern(normalizedText, MENU_COMMAND_PATTERNS);
const isListoCommand = (normalizedText) => matchesAnyPattern(normalizedText, LISTO_COMMAND_PATTERNS);
const isGenericCoveragePrompt = (normalizedText) => matchesAnyPattern(normalizedText, GENERIC_COVERAGE_PROMPT_PATTERNS);

const canApplyDirectIntent = (currentStateBase) => !currentStateBase
  || currentStateBase === FLOW_STATES.WELCOME
  || currentStateBase === FLOW_STATES.OBRA_SOCIAL
  || currentStateBase === FLOW_STATES.OBRA_SOCIAL_UNAVAILABLE
  || currentStateBase === FLOW_STATES.LOCATION
  || currentStateBase === FLOW_STATES.WAITING_HUMAN_REVIEW;

const getCoverageInputLabel = (messageText) => {
  const normalized = String(messageText || '').trim();
  return normalized || 'la cobertura indicada';
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

const getConversationAutoReply = ({
  messageText,
  messageType = 'text',
  currentState,
  shouldSendWelcome,
  hasNonTextMessage = false,
  hasMediaAttachment = false,
}) => {
  const normalized = normalizeText(messageText);
  const currentStateBase = getFlowStateBase(currentState);
  const matchedActiveCoverage = findInMemoryWhatsAppCoverageByInput(messageText, { includeInactive: false });
  const matchedCoverage = matchedActiveCoverage || findInMemoryWhatsAppCoverageByInput(messageText, { includeInactive: true });

  if (messageType === 'reaction') {
    return null;
  }

  if (normalized && isMenuCommand(normalized)) {
    return { type: 'welcome', nextState: FLOW_STATES.WELCOME };
  }

  if (currentStateBase === FLOW_STATES.HUMAN_HANDOFF) {
    return null;
  }

  if (normalized && currentStateBase === FLOW_STATES.OBRA_SOCIAL && isGenericCoveragePrompt(normalized)) {
    return {
      type: 'text',
      text: AUTO_REPLY_OBRA_SOCIAL_TEXT,
      nextState: FLOW_STATES.OBRA_SOCIAL,
    };
  }

  if (
    DOCUMENT_COLLECTION_STATES.has(currentStateBase)
    && (
      hasMediaAttachment
      || (normalized && isListoCommand(normalized))
    )
  ) {
    return {
      type: 'text',
      text: DOCUMENTATION_RECEIVED_TEXT,
      nextState: FLOW_STATES.HUMAN_HANDOFF,
    };
  }

  if (
    matchedActiveCoverage
    && (
      shouldSendWelcome
      || currentStateBase === FLOW_STATES.WELCOME
      || currentStateBase === FLOW_STATES.OBRA_SOCIAL
      || currentStateBase === FLOW_STATES.OBRA_SOCIAL_UNAVAILABLE
    )
  ) {
    return {
      type: 'text',
      text: buildActiveCoverageReplyText(matchedActiveCoverage.name),
      nextState: buildFlowState(FLOW_STATES.OBRA_SOCIAL_DOCS, matchedActiveCoverage.id),
    };
  }

  if (
    normalized
    && !matchedActiveCoverage
    && (currentStateBase === FLOW_STATES.OBRA_SOCIAL || currentStateBase === FLOW_STATES.OBRA_SOCIAL_UNAVAILABLE)
    && !isMenuCommand(normalized)
  ) {
    return {
      type: 'text',
      text: buildInactiveCoverageReplyText(matchedCoverage?.name || getCoverageInputLabel(messageText)),
      nextState: FLOW_STATES.PARTICULAR,
    };
  }

  if (normalized && (shouldSendWelcome || canApplyDirectIntent(currentStateBase))) {
    const directIntentReply = getDirectIntentReply(normalized);
    if (directIntentReply) return directIntentReply;
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

  if (DOCUMENT_COLLECTION_STATES.has(currentStateBase)) {
    return null;
  }

  if (normalized && currentStateBase === FLOW_STATES.WAITING_HUMAN_REVIEW) {
    return {
      type: 'text',
      text: WAITING_HUMAN_REVIEW_TEXT,
      nextState: FLOW_STATES.WAITING_HUMAN_REVIEW,
    };
  }

  if (normalized && currentStateBase !== FLOW_STATES.WELCOME) {
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
  
  return uploadBufferToStorage({
    buffer,
    key,
    contentType,
  });
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

          const now = new Date();
          const lastInbound = await prisma.whatsAppMessage.findFirst({
            where: { conversationId: conversation.id, direction: 'inbound' },
            orderBy: { createdAt: 'desc' },
          });

          const shouldResetSession = isNew
            || !lastInbound
            || (now - new Date(lastInbound.createdAt) > WELCOME_COOLDOWN_MS);

          const mediaMeta = getMediaInfoFromMessage(message);
          const inboundText = message.type === 'text' ? message.text?.body || '' : '';
          const extractedPatientName = extractPatientName(inboundText);
          const effectiveState = shouldResetSession
            ? FLOW_STATES.WELCOME
            : (conversation.currentState || FLOW_STATES.WELCOME);
          const autoReply = getConversationAutoReply({
            messageText: inboundText,
            messageType: message.type,
            currentState: effectiveState,
            shouldSendWelcome: shouldResetSession,
            hasNonTextMessage: message.type !== 'text',
            hasMediaAttachment: Boolean(mediaMeta?.mediaId),
          });
          const nextConversationState = autoReply?.nextState || effectiveState;
          const nextProfileName = extractedPatientName || incomingProfileName || conversation.profileName;

          let mediaUrl = null;
          if (mediaMeta?.mediaId) {
            mediaUrl = await storeInboundMedia({
              mediaId: mediaMeta.mediaId,
              mimeType: mediaMeta.mimeType,
              conversationId: conversation.id,
            });
          }

          await prisma.whatsAppMessage.create({
            data: {
              conversationId: conversation.id,
              direction: 'inbound',
              type: message.type,
              text: getPreviewText(message),
              mediaUrl,
              mediaMime: mediaMeta?.mimeType,
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
              lastMessageText: getPreviewText(message),
              profileName: nextProfileName || undefined,
              currentState: nextConversationState,
              unreadCount: { increment: 1 },
            },
          });

          if (autoReply) {
            try {
              const outboundText = autoReply.type === 'welcome'
                ? buildReplyText(WELCOME_TEXT_TEMPLATE, nextProfileName)
                : autoReply.text;
              const response = await sendTextMessage({
                to: conversation.waId,
                text: outboundText,
              });

              await prisma.whatsAppMessage.create({
                data: {
                  conversationId: conversation.id,
                  direction: 'outbound',
                  type: 'text',
                  text: outboundText,
                  waMessageId: response?.messages?.[0]?.id,
                  status: 'sent',
                },
              });
            } catch (err) {
              console.error('Error enviando respuesta automática:', err);
            }
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
    console.error('ERROR WHATSAPP WEBHOOK:', error);
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
    console.error('ERROR PAUSANDO BOT:', error);
    res.status(500).json({ message: 'No se pudo pausar el bot en esta conversación.' });
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
    console.error('ERROR REACTIVANDO BOT:', error);
    res.status(500).json({ message: 'No se pudo reactivar el bot en esta conversación.' });
  }
};

export const deleteConversation = async (req, res, prisma) => {
  const { id } = req.params;
  try {
    await prisma.whatsAppMessage.deleteMany({ where: { conversationId: id } });
    await prisma.whatsAppConversation.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('ERROR AL ELIMINAR:', error);
    res.status(500).json({ message: 'Error al eliminar la conversación' });
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
    console.error('ERROR ENVIANDO MENSAJE:', error);
    res.status(500).json({ message: 'Error al enviar' });
  }
};

export const sendWelcomeTemplate = async (req, res, prisma) => {
  const { id } = req.params;
  const conversation = await prisma.whatsAppConversation.findUnique({ where: { id } });
  if (!conversation) return res.status(404).json({ message: 'Conversación no encontrada' });

  try {
    const result = await sendWelcomeReply({
      to: conversation.waId,
      patientName: conversation.profileName,
      templateName: WELCOME_TEMPLATE,
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
    console.error('ERROR ENVIANDO WELCOME TEMPLATE:', error);
    res.status(500).json({ message: 'Error al enviar saludo' });
  }
};
