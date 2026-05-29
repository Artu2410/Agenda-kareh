import path from 'node:path';
import { uploadBufferToStorage } from '../../services/storage.js';
import { downloadMedia, fetchMediaInfo } from '../../services/whatsapp.js';
import { MIME_EXTENSION } from './whatsapp.constants.js';
import { getFileExtension, sanitizeFilename } from './message.helpers.js';
import { normalizeWhatsAppMediaContext } from '../../controllers/whatsapp/dto/mediaMessage.dto.js';

export const storeOutboundMedia = async ({ conversationId, file }) => {
  const mediaContext = normalizeWhatsAppMediaContext({ conversationId, filename: file?.originalname, contentType: file?.mimetype });
  const extension = getFileExtension(mediaContext.filename, mediaContext.contentType, MIME_EXTENSION);
  const baseName = sanitizeFilename(path.basename(mediaContext.filename || `archivo${extension}`, extension), 'archivo');
  const key = `whatsapp/${mediaContext.conversationId}/outbound/${Date.now()}-${baseName}${extension}`;

  return uploadBufferToStorage({
    buffer: file.buffer,
    key,
    contentType: mediaContext.contentType || 'application/octet-stream',
  });
};

export const storeInboundMedia = async ({ mediaId, mimeType, conversationId }) => {
  const mediaContext = normalizeWhatsAppMediaContext({ mediaId, mimeType, conversationId });
  if (!mediaContext.mediaId) return null;
  const mediaInfo = await fetchMediaInfo(mediaContext.mediaId);
  const buffer = await downloadMedia(mediaInfo.url);
  const contentType = mediaContext.mimeType || mediaInfo.mime_type || 'application/octet-stream';
  const ext = MIME_EXTENSION[contentType] || 'bin';
  const key = `whatsapp/${mediaContext.conversationId}/${mediaContext.mediaId}.${ext}`;

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
