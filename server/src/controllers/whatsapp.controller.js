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

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WELCOME_TEMPLATE = process.env.WHATSAPP_WELCOME_TEMPLATE || 'bienvenida_kareh';
const HOLA_TEMPLATE = process.env.WHATSAPP_HOLA_TEMPLATE || 'bienvenida_kareh';
const DEFAULT_WELCOME_TEXT = [
  '¡Hola! {{1}} 👋 Bienvenido/a a Kinesiología *Kareh* 🌿.',
  '',
  'Muchas gracias por escribirnos.',
  'Para poder asesorarte mejor y coordinar tu turno, por favor indicanos tu modalidad:',
  '',
  '✅ *Obras Sociales*',
  '✅ *Paciente Particular*',
  '✅ *Paciente de PAMI*',
  '',
  '📍 *Dirección:* Av. Senador Morón 782, Bella Vista.',
  '',
  '🗓 *Nuestros horarios de atención:*',
  'Lun y Vie: 14:00 a 19:00 hs.',
  'Mar, Mié y Jue: 17:30 a 19:00 hs.',
  'Sábados: 08:00 a 12:00 hs.',
  '',
  '¡Estamos procesando tu mensaje y te responderemos a la brevedad para confirmarte disponibilidad! ✨🏥',
].join('\n');
const normalizeReplyMode = (value, fallback = 'text') => (
  String(value || fallback).trim().toLowerCase() === 'template' ? 'template' : 'text'
);
const normalizeTextTemplate = (value, fallback) => String(value || fallback || '')
  .replace(/\\n/g, '\n')
  .trim();
const WELCOME_MODE = normalizeReplyMode(process.env.WHATSAPP_WELCOME_MODE, 'text');
const HOLA_MODE = normalizeReplyMode(process.env.WHATSAPP_HOLA_MODE, WELCOME_MODE);
const WELCOME_TEXT_TEMPLATE = normalizeTextTemplate(process.env.WHATSAPP_WELCOME_TEXT, DEFAULT_WELCOME_TEXT);
const HOLA_TEXT_TEMPLATE = normalizeTextTemplate(process.env.WHATSAPP_HOLA_TEXT, WELCOME_TEXT_TEMPLATE);
const WELCOME_TEMPLATE_BODY_PARAMS = process.env.WHATSAPP_WELCOME_TEMPLATE_BODY_PARAMS;
const HOLA_TEMPLATE_BODY_PARAMS = String(process.env.WHATSAPP_HOLA_TEMPLATE_BODY_PARAMS || '').trim()
  ? process.env.WHATSAPP_HOLA_TEMPLATE_BODY_PARAMS
  : WELCOME_TEMPLATE_BODY_PARAMS;
const WELCOME_FALLBACK_TEXT = normalizeTextTemplate(
  process.env.WHATSAPP_WELCOME_FALLBACK_TEXT,
  WELCOME_TEXT_TEMPLATE,
);
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
    filename: payload.filename || null,
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

const getTemplatePatientName = (patientName, fallback = 'Paciente') => {
  const normalized = String(patientName || '').trim();
  if (!normalized) return fallback;
  return normalized.length < 30 ? normalized : fallback;
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
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
};

const GREETING_PREFIXES = ['hola', 'buenas', 'buen dia', 'buenos dias', 'buenas tardes', 'buenas noches'];

const AUTO_REPLY_MAP = new Map([
  ['obra social', { type: 'text', text: 'Indíquenos su obra social para verificar cobertura.' }],
  ['particular', { type: 'text', text: '¿Cuenta con la orden médica? Puede enviar una foto por aquí mismo.' }],
  ['rehabilitacion respiratoria', { type: 'text', text: 'Realizamos rehabilitación respiratoria. Indíquenos su obra social y si cuenta con orden médica.' }],
  ['ubicacion y horarios', { type: 'text', text: 'Av. Senador Morón 782, Bella Vista. Lunes y viernes de 14:00 a 19:00 y sábados de 8:00 a 12:00.' }],
]);

const getAutoReply = (messageText) => {
  const normalized = normalizeText(messageText);
  if (!normalized) return null;
  if (GREETING_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix} `))) {
    return { type: 'template', name: HOLA_TEMPLATE };
  }
  return AUTO_REPLY_MAP.get(normalized) || null;
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

          const contact = value.contacts?.[0];
          const { conversation, isNew } = await ensureConversation({
            prisma,
            waId: message.from,
            profileName: contact?.profile?.name,
            phone: message.from,
          });

          const now = new Date();
          let shouldSendWelcome = false;
          const lastInbound = await prisma.whatsAppMessage.findFirst({
            where: { conversationId: conversation.id, direction: 'inbound' },
            orderBy: { createdAt: 'desc' },
          });

          if (isNew || !lastInbound || (now - new Date(lastInbound.createdAt) > WELCOME_COOLDOWN_MS)) {
            shouldSendWelcome = true;
          }

          const inboundText = message.type === 'text' ? message.text?.body : '';
          const autoReply = getAutoReply(inboundText);
          
          const mediaMeta = getMediaInfoFromMessage(message);
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
              unreadCount: { increment: 1 },
            },
          });

          const shouldSendAutoReply = !shouldSendWelcome && Boolean(autoReply);

          if (shouldSendWelcome || shouldSendAutoReply) {
            const templateName = autoReply?.type === 'template' ? autoReply.name : WELCOME_TEMPLATE;
            const isTextReply = shouldSendAutoReply && autoReply?.type === 'text';

            try {
              let outboundType;
              let outboundText;
              let response;
              if (isTextReply) {
                response = await sendTextMessage({ to: conversation.waId, text: autoReply.text });
                outboundType = 'text';
                outboundText = autoReply.text;
              } else {
                const result = await sendWelcomeReply({
                  to: conversation.waId,
                  patientName: conversation.profileName,
                  templateName,
                  replyKind: autoReply?.type === 'template' ? 'hola' : 'welcome',
                });
                response = result.response;
                outboundType = result.outboundType;
                outboundText = result.outboundText;
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

// --- CORRECCIÓN FINAL DE ELIMINACIÓN ---
export const deleteConversation = async (req, res, prisma) => {
  const { id } = req.params;
  try {
    // 1. Borramos mensajes asociados primero
    await prisma.whatsAppMessage.deleteMany({ where: { conversationId: id } });
    // 2. Borramos la conversación
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

    res.json({ success: true, type: result.outboundType });
  } catch (error) {
    console.error('ERROR ENVIANDO WELCOME TEMPLATE:', error);
    res.status(500).json({ message: 'Error al enviar saludo' });
  }
};
