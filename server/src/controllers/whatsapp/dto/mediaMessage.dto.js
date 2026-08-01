export const normalizeWhatsAppMediaContext = ({
  mediaId,
  mimeType,
  conversationId,
  filename,
  contentType,
}) => ({
  mediaId: mediaId || null,
  mimeType: mimeType || null,
  conversationId: conversationId || null,
  filename: filename || null,
  contentType: contentType || null,
});
