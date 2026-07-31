import logger from '../../config/logger.js';
import { findInMemoryWhatsAppCoverageByInput } from '../../utils/whatsappCoverageCatalog.js';
import { getSuggestedWhatsAppSlots } from '../../services/whatsappAvailability.js';
import { sendTemplateMessage, sendTextMessage } from '../../services/whatsapp.js';
import {
  AUTO_REPLY_LOCATION_TEXT,
  DIRECT_INTENT_RULES,
  DOCUMENTATION_RECEIVED_TEXT,
  FLOW_META,
  FLOW_STATES,
  PRICING_CHANGE_DATE,
  PRICING_REPEAT_WINDOW_MS,
  SPECIAL_COVERAGE_AVAILABILITY,
  SPECIAL_COVERAGE_RULES,
  SLOT_REPEAT_WINDOW_MS,
  WELCOME_TEMPLATE,
  WAITING_HUMAN_REVIEW_TEXT,
  UNKNOWN_INPUT_TEXT,
} from './whatsapp.constants.js';
import {
  buildFlowState,
  buildReplyText,
  buildWelcomeFallbackText,
  buildWelcomeTemplateComponents,
  createWhatsAppLogger,
  getFlowStateBase,
  getFlowStateMeta,
  getReplyConfig,
  isTemplatePayloadError,
  normalizeText,
} from './message.helpers.js';

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

const buildInsuranceDocsReply = () => [
  'Perfecto 😊 Si es por obra social, mandanos foto de la orden y la credencial.',
  'Lo revisamos y seguimos por acá manualmente.',
].join('\n');

const buildArtDocsReply = () => [
  'Perfecto 😊 Si es ART, mandanos foto de la orden y el número de siniestro si ya lo tenés.',
  'Lo revisamos administrativamente y seguimos por acá.',
].join('\n');

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

  let suggestedSlots = await getSuggestedWhatsAppSlots({
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

const getDirectIntentReply = (normalizedText) => {
  const matchedRule = DIRECT_INTENT_RULES.find(({ patterns }) => patterns.some((pattern) => pattern.test(normalizedText)));
  if (!matchedRule) return null;

  return {
    type: 'text',
    text: matchedRule.text,
    nextState: matchedRule.nextState,
  };
};

export const sendWelcomeReply = async ({
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

export const getConversationAutoReply = async ({
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
      nextState: buildFlowState(FLOW_STATES.OBRA_SOCIAL_DOCS, FLOW_META.OBRA_SOCIAL),
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
      nextState: buildFlowState(FLOW_STATES.OBRA_SOCIAL_DOCS, FLOW_META.ART),
      memory: {
        clearSlotOffer: true,
      },
    };
  }

  if (normalized && hasInsuranceIntent(normalized) && !hasPamiIntent(normalized)) {
    return {
      type: 'text',
      text: buildInsuranceDocsReply(),
      nextState: buildFlowState(FLOW_STATES.OBRA_SOCIAL_DOCS, FLOW_META.OBRA_SOCIAL),
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
