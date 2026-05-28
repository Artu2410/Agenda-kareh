import path from 'node:path';
import logger from '../../config/logger.js';
import {
  HOLA_MODE,
  HOLA_TEMPLATE,
  HOLA_TEMPLATE_BODY_PARAMS,
  HOLA_TEXT_TEMPLATE,
  MIME_EXTENSION,
  WELCOME_FALLBACK_TEXT,
  WELCOME_MODE,
  WELCOME_TEMPLATE,
  WELCOME_TEMPLATE_BODY_PARAMS,
  WELCOME_TEXT_TEMPLATE,
  WHATSAPP_AUDIO_PLACEHOLDER,
} from './whatsapp.constants.js';

const FLOW_STATE_SEPARATOR = '::';

export const createWhatsAppLogger = (baseLogger = logger, context = {}) => {
  const meta = {};

  if (context.requestId) meta.requestId = context.requestId;
  if (context.patientId) meta.patientId = context.patientId;
  if (context.phone) meta.phone = context.phone;
  if (context.messageType) meta.messageType = context.messageType;
  if (context.conversationId) meta.conversationId = context.conversationId;

  return baseLogger.child(meta);
};

export const buildFlowState = (baseState, ...metaParts) => [
  baseState,
  ...metaParts.map((part) => String(part || '').trim()).filter(Boolean),
].join(FLOW_STATE_SEPARATOR);

export const getFlowStateBase = (state) => String(state || 'welcome')
  .split(FLOW_STATE_SEPARATOR)
  .filter(Boolean)[0] || 'welcome';

export const getFlowStateMeta = (state) => String(state || '')
  .split(FLOW_STATE_SEPARATOR)
  .slice(1)
  .filter(Boolean);

export const normalizeOutgoingText = (value) => String(value || '')
  .replace(/\r\n/g, '\n')
  .replace(/\r/g, '\n')
  .trim();

export const sanitizeFilename = (value, fallback = 'archivo') => {
  const normalized = String(value || fallback)
    .replace(/[^\w.\-() ]+/g, '_')
    .trim();
  return normalized || fallback;
};

export const getFileExtension = (filename, mimeType, extensionMap = {}) => {
  const ext = path.extname(filename || '').toLowerCase();
  if (ext) return ext;
  const mimeExt = extensionMap[mimeType];
  return mimeExt ? `.${mimeExt}` : '.bin';
};

export const getPreviewText = (message) => {
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

export const getMediaInfoFromMessage = (message) => {
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

export const isAudioMessageType = (messageType, mimeType) => messageType === 'audio' || String(mimeType || '').startsWith('audio/');

export const buildAudioTranscriptText = (transcription) => `${WHATSAPP_AUDIO_PLACEHOLDER} ${transcription}`;

export const buildStoredInboundText = ({ message, transcribedText, mimeType }) => {
  if (transcribedText && isAudioMessageType(message?.type, mimeType)) {
    return buildAudioTranscriptText(transcribedText);
  }

  return getPreviewText(message);
};

export const normalizeText = (value) => {
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

export const parseTemplateBodyParams = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (normalized.toUpperCase() === 'NONE') return [];
  return normalized
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const WELCOME_TEMPLATE_BODY_PARAM_NAMES = parseTemplateBodyParams(WELCOME_TEMPLATE_BODY_PARAMS);
export const HOLA_TEMPLATE_BODY_PARAM_NAMES = parseTemplateBodyParams(HOLA_TEMPLATE_BODY_PARAMS);

export const getTemplateBodyParamNames = (templateName) => {
  if (templateName === HOLA_TEMPLATE) return HOLA_TEMPLATE_BODY_PARAM_NAMES;
  if (templateName === WELCOME_TEMPLATE) return WELCOME_TEMPLATE_BODY_PARAM_NAMES;
  return null;
};

export const sanitizePatientName = (patientName) => {
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

export const getTemplatePatientName = (patientName, fallback = 'Paciente') => {
  const normalized = sanitizePatientName(patientName);
  if (!normalized) return fallback;
  return normalized;
};

export const buildTemplateTextParameter = ({ text, parameterName }) => {
  const parameter = { type: 'text', text };
  if (parameterName) {
    parameter.parameter_name = parameterName;
  }
  return parameter;
};

export const buildWelcomeTemplateComponents = (patientName, templateName = WELCOME_TEMPLATE) => {
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

export const buildReplyText = (textTemplate, patientName) => {
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

export const buildWelcomeFallbackText = (patientName, textTemplate = WELCOME_FALLBACK_TEXT) => (
  buildReplyText(textTemplate, patientName)
);

export const isTemplatePayloadError = (error) => {
  const message = String(error?.detail?.error?.message || error?.message || '').toLowerCase();
  const details = String(error?.detail?.error?.error_data?.details || '').toLowerCase();
  return message.includes('invalid parameter')
    || details.includes('parameter name')
    || details.includes('number of parameters');
};

export const getReplyConfig = ({ replyKind = 'welcome', templateName } = {}) => {
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

export const extractPatientName = (messageText) => {
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

export const getIncomingProfileName = (value, waId) => {
  const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
  const matchedContact = contacts.find((contact) => String(contact?.wa_id || '').trim() === String(waId || '').trim());
  return matchedContact?.profile?.name || contacts[0]?.profile?.name || null;
};
