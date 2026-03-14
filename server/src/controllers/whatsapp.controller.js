import { uploadBufferToStorage } from '../services/storage.js';
import { downloadMedia, fetchMediaInfo, sendTemplateMessage, sendTextMessage } from '../services/whatsapp.js';
import { normalizePhone } from '../utils/phone.js';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WELCOME_TEMPLATE = process.env.WHATSAPP_WELCOME_TEMPLATE || 'bienvenida_kareh';
const WELCOME_COOLDOWN_HOURS = Number(process.env.WHATSAPP_WELCOME_COOLDOWN_HOURS || 24);
const WELCOME_COOLDOWN_MS = Number.isFinite(WELCOME_COOLDOWN_HOURS)
  ? WELCOME_COOLDOWN_HOURS * 60 * 60 * 1000
  : 24 * 60 * 60 * 1000;

const MIME_EXTENSION = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'video/mp4': 'mp4',
};

const getPreviewText = (message) => {
  if (!message) return '';
  if (message.type === 'text') return message.text?.body || '';
  const caption = message[message.type]?.caption;
  if (caption) return caption;
  return `[${message.type || 'archivo'}]`;
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

const buildWelcomeTemplateComponents = (patientName) => ([
  {
    type: 'body',
    parameters: [
      { type: 'text', text: patientName || 'Paciente' },
    ],
  },
]);

const normalizeText = (value) => {
  if (!value) return '';
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
};

const AUTO_REPLY_MAP = new Map([
  ['obra social', 'Indiquenos su obra social.'],
  ['particular', 'Cuenta con la orden medica? Envie una foto.'],
  ['rehabilitacion respiratoria', 'Realizamos rehabilitacion respiratoria. Indiquenos su obra social o si es particular y si cuenta con orden medica.'],
  ['ubicacion y horarios', 'Av. Senador Morón 782, B1661INS Bella Vista, Provincia de Buenos Aires. Horarios lunes y viernes de 14:00 a 19:00 y sabados de 8:00 a 12:00'],
]);

const getAutoReply = (messageText) => AUTO_REPLY_MAP.get(normalizeText(messageText)) || null;

const storeInboundMedia = async ({ mediaId, mimeType, conversationId }) => {
  if (!mediaId) return null;
  const mediaInfo = await fetchMediaInfo(mediaId);
  const mediaUrl = mediaInfo.url;
  const contentType = mimeType || mediaInfo.mime_type || 'application/octet-stream';
  const buffer = await downloadMedia(mediaUrl);
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
    if (!body || body.object !== 'whatsapp_business_account') {
      return res.sendStatus(404);
    }

    let totalMessages = 0;
    let totalStatuses = 0;

    const entries = body.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const contacts = value.contacts || [];
        const profileName = contacts[0]?.profile?.name || null;
        const waId = contacts[0]?.wa_id || null;

        if (Array.isArray(value.messages)) {
          totalMessages += value.messages.length;
          for (const message of value.messages) {
            if (message?.id) {
              const existing = await prisma.whatsAppMessage.findUnique({
                where: { waMessageId: message.id },
              });
              if (existing) {
                continue;
              }
            }

            const { conversation, isNew } = await ensureConversation({
              prisma,
              waId: waId || message.from,
              profileName,
              phone: message.from,
            });

            const now = new Date();
            let shouldSendWelcome = false;
            if (WELCOME_TEMPLATE) {
              if (isNew) {
                shouldSendWelcome = true;
              } else {
                const lastInbound = await prisma.whatsAppMessage.findFirst({
                  where: { conversationId: conversation.id, direction: 'inbound' },
                  orderBy: { createdAt: 'desc' },
                  select: { createdAt: true },
                });
                if (!lastInbound || now - new Date(lastInbound.createdAt) > WELCOME_COOLDOWN_MS) {
                  shouldSendWelcome = true;
                }
              }
            }

            const inboundText = message.type === 'text' ? message.text?.body : '';
            const autoReply = getAutoReply(inboundText);
            const previewText = getPreviewText(message);
            const mediaMeta = getMediaInfoFromMessage(message);
            let mediaUrl = null;
            let mediaMime = null;
            let mediaSha = null;
            let mediaName = null;

            if (mediaMeta?.mediaId) {
              mediaUrl = await storeInboundMedia({
                mediaId: mediaMeta.mediaId,
                mimeType: mediaMeta.mimeType,
                conversationId: conversation.id,
              });
              mediaMime = mediaMeta.mimeType || null;
              mediaSha = mediaMeta.sha256 || null;
              mediaName = mediaMeta.filename || null;
            }

            await prisma.whatsAppMessage.create({
              data: {
                conversationId: conversation.id,
                direction: 'inbound',
                type: message.type,
                text: previewText || mediaMeta?.caption || null,
                mediaUrl,
                mediaMime,
                mediaSha256: mediaSha,
                mediaName,
                waMessageId: message.id,
                status: 'received',
              },
            });

            await prisma.whatsAppConversation.update({
              where: { id: conversation.id },
              data: {
                lastMessageAt: new Date(),
                lastMessageText: previewText || mediaMeta?.caption || `[${message.type}]`,
                unreadCount: { increment: 1 },
              },
            });

            if (shouldSendWelcome) {
              try {
                const components = buildWelcomeTemplateComponents(profileName);
                const response = await sendTemplateMessage({
                  to: conversation.waId,
                  name: WELCOME_TEMPLATE,
                  components,
                });
                const waMessageId = response?.messages?.[0]?.id || null;
                await prisma.whatsAppMessage.create({
                  data: {
                    conversationId: conversation.id,
                    direction: 'outbound',
                    type: 'template',
                    text: `Plantilla: ${WELCOME_TEMPLATE}`,
                    waMessageId,
                    status: 'sent',
                  },
                });
              } catch (error) {
                console.error('ERROR WHATSAPP WELCOME:', error);
              }
            }

            if (autoReply) {
              try {
                const response = await sendTextMessage({
                  to: conversation.waId,
                  text: autoReply,
                });
                const waMessageId = response?.messages?.[0]?.id || null;
                await prisma.whatsAppMessage.create({
                  data: {
                    conversationId: conversation.id,
                    direction: 'outbound',
                    type: 'text',
                    text: autoReply,
                    waMessageId,
                    status: 'sent',
                  },
                });
                await prisma.whatsAppConversation.update({
                  where: { id: conversation.id },
                  data: {
                    lastMessageAt: new Date(),
                    lastMessageText: autoReply,
                  },
                });
              } catch (error) {
                console.error('ERROR WHATSAPP AUTO-REPLY:', error);
              }
            }
          }
        }

        if (Array.isArray(value.statuses)) {
          totalStatuses += value.statuses.length;
          for (const status of value.statuses) {
            await prisma.whatsAppMessage.updateMany({
              where: { waMessageId: status.id },
              data: {
                status: status.status,
                statusAt: status.timestamp ? new Date(Number(status.timestamp) * 1000) : new Date(),
              },
            });
          }
        }
      }
    }

    if (totalMessages || totalStatuses) {
      console.log('📨 WhatsApp webhook procesado', { messages: totalMessages, statuses: totalStatuses });
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
  const limit = Math.min(Number(req.query.limit || 50), 200);
  const messages = await prisma.whatsAppMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  res.json(messages);
};

export const markConversationRead = async (req, res, prisma) => {
  const { id } = req.params;
  await prisma.whatsAppConversation.update({
    where: { id },
    data: { unreadCount: 0 },
  });
  res.json({ success: true });
};

export const deleteConversation = async (req, res, prisma) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ message: 'Conversación requerida' });

  try {
    await prisma.whatsAppConversation.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ message: 'Conversación no encontrada' });
    }
    console.error('ERROR ELIMINANDO CONVERSACION WHATSAPP:', error);
    return res.status(500).json({ message: 'Error al eliminar conversación' });
  }
};

export const sendConversationMessage = async (req, res, prisma) => {
  const { id } = req.params;
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ message: 'Mensaje requerido' });

  const conversation = await prisma.whatsAppConversation.findUnique({ where: { id } });
  if (!conversation) return res.status(404).json({ message: 'Conversación no encontrada' });

  try {
    const response = await sendTextMessage({
      to: conversation.waId,
      text,
    });
    const waMessageId = response?.messages?.[0]?.id || null;

    await prisma.whatsAppMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'outbound',
        type: 'text',
        text,
        waMessageId,
        status: 'sent',
      },
    });

    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastMessageText: text,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('ERROR ENVIANDO WHATSAPP:', error);
    res.status(500).json({ message: 'Error al enviar WhatsApp', detail: error.message });
  }
};
