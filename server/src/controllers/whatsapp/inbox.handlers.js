import logger from '../../config/logger.js';
import { createInternalError } from '../../errors/AppError.js';
import {
  sendDocumentMessage,
  sendTextMessage,
  uploadMedia,
} from '../../services/whatsapp.js';
import { createWhatsAppLogger, normalizeOutgoingText, sanitizeFilename } from './message.helpers.js';
import { storeOutboundMedia } from './media.handlers.js';
import { sendWelcomeReply } from './chatbot.handlers.js';
import {
  FLOW_STATES,
  WHATSAPP_OUTBOUND_PLACEHOLDER,
  WELCOME_TEMPLATE,
} from './whatsapp.constants.js';

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
