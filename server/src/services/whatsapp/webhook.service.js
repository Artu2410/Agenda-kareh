import logger from '../../config/logger.js';
import { sendNotificationToAll } from '../notifications.controller.js';
import { transcribeAudioBuffer } from '../../services/audioTranscription.js';
import { normalizePhone } from '../../utils/phone.js';
import { sendTextMessage } from '../../services/whatsapp.js';
import { recordWhatsAppMessage } from '../../lib/metrics.js';
import {
  parseWhatsAppWebhookBody,
  parseWhatsAppWebhookChanges,
  parseWhatsAppWebhookMessages,
  parseWhatsAppWebhookStatuses,
  parseWhatsAppWebhookValue,
} from '../../controllers/whatsapp/dto/incomingMessage.dto.js';
import {
  AUTO_REPLY_COOLDOWN_MS,
  AUTO_REPLY_MAX_DELAY_MS,
  AUTO_REPLY_MIN_DELAY_MS,
  FLOW_STATES,
  VERIFY_TOKEN,
  WELCOME_COOLDOWN_MS,
  WHATSAPP_AUTOREPLY_ENABLED,
} from './whatsapp.constants.js';
import {
  buildStoredInboundText,
  createWhatsAppLogger,
  extractPatientName,
  getIncomingProfileName,
  getMediaInfoFromMessage,
} from './message.helpers.js';
import { storeInboundMedia } from './media.handlers.js';
import { getConversationAutoReply, sendWelcomeReply } from './chatbot.handlers.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    const { object, entries } = parseWhatsAppWebhookBody(req.body);
    if (object !== 'whatsapp_business_account') return res.sendStatus(404);

    const requestLogger = req.logger || logger;

    for (const entry of entries) {
      for (const change of parseWhatsAppWebhookChanges(entry)) {
        const value = parseWhatsAppWebhookValue(change);
        const messages = parseWhatsAppWebhookMessages(value);

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
          if (message.type === 'audio' && mediaBuffer) {
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
          recordWhatsAppMessage({ direction: 'inbound', type: message.type });

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

          try {
            const totalUnread = await prisma.whatsAppConversation.aggregate({
              _sum: { unreadCount: true },
            });

            await sendNotificationToAll(prisma, {
              title: `Mensaje de ${nextProfileName || conversation.phone}`,
              body: storedInboundText,
              icon: '/icon-192x192.png',
              unreadCount: totalUnread._sum.unreadCount || 0,
              data: {
                url: `/whatsapp/${conversation.id}`,
                conversationId: conversation.id,
              },
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
              recordWhatsAppMessage({ direction: 'outbound', type: outboundType });

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

        const statuses = parseWhatsAppWebhookStatuses(value);
        if (statuses.length > 0) {
          for (const status of statuses) {
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
