import path from 'node:path';
import { uploadBufferToStorage } from '../../services/storage.js';
import { downloadMedia, fetchMediaInfo } from '../../services/whatsapp.js';
import { MIME_EXTENSION } from './whatsapp.constants.js';
import { getFileExtension, sanitizeFilename } from './message.helpers.js';

export const storeOutboundMedia = async ({ conversationId, file }) => {
  const extension = getFileExtension(file.originalname, file.mimetype, MIME_EXTENSION);
  const baseName = sanitizeFilename(path.basename(file.originalname || `archivo${extension}`, extension), 'archivo');
  const key = `whatsapp/${conversationId}/outbound/${Date.now()}-${baseName}${extension}`;

  return uploadBufferToStorage({
    buffer: file.buffer,
    key,
    contentType: file.mimetype || 'application/octet-stream',
  });
};

export const storeInboundMedia = async ({ mediaId, mimeType, conversationId }) => {
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
