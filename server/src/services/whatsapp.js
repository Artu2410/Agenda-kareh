import logger from '../config/logger.js';

const {
  WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_API_VERSION = 'v20.0',
  WHATSAPP_TEMPLATE_LANGUAGE = 'es_AR',
} = process.env;

const whatsappLogger = logger.child({ service: 'whatsapp' });

const assertWhatsappConfig = () => {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error('WhatsApp no configurado');
  }
};

const buildEndpoint = () => `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

const sendMessage = async (payload) => {
  assertWhatsappConfig();
  whatsappLogger.info('Enviando mensaje a WhatsApp', {
    to: payload?.to,
    type: payload?.type,
  });

  const response = await fetch(buildEndpoint(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  whatsappLogger.info('Respuesta de WhatsApp', {
    status: response.status,
    messageId: data?.messages?.[0]?.id,
  });

  if (!response.ok) {
    const errorMessage = data?.error?.message || 'Error al enviar WhatsApp';
    whatsappLogger.error('Error en sendMessage', {
      errorMessage,
      status: response.status,
    });
    const error = new Error(errorMessage);
    error.detail = data;
    throw error;
  }

  whatsappLogger.info('Mensaje enviado exitosamente', {
    messageId: data?.messages?.[0]?.id,
  });
  return data;
};

const buildGraphUrl = (path) => `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${path}`;

export const sendTemplateMessage = async ({ to, name, language, components }) => {
  const template = {
    name,
    language: { code: language || WHATSAPP_TEMPLATE_LANGUAGE },
  };

  if (Array.isArray(components) && components.length > 0) {
    template.components = components;
  }

  whatsappLogger.info('Enviando template WhatsApp', {
    to,
    name,
    language: language || WHATSAPP_TEMPLATE_LANGUAGE,
    hasComponents: Array.isArray(template.components),
  });
  return sendMessage({
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template,
  });
};

export const sendTextMessage = async ({ to, text }) => (
  sendMessage({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  })
);

export const uploadMedia = async ({ buffer, filename, mimeType }) => {
  assertWhatsappConfig();

  whatsappLogger.info('Subiendo media a WhatsApp', {
    filename,
    mimeType,
    bufferSize: buffer.length,
  });

  // Node puede no exponer FormData global en versiones antiguas.
  // Intentamos usar el global, y si no está disponible, usamos la librería "form-data".
  const FormDataImpl = typeof FormData !== 'undefined'
    ? FormData
    : (await import('form-data')).default;

  const formData = new FormDataImpl();
  formData.append('messaging_product', 'whatsapp');
  if (typeof FormData !== 'undefined' && FormDataImpl === FormData) {
    const fileValue = typeof File !== 'undefined'
      ? new File([buffer], filename, { type: mimeType })
      : new Blob([buffer], { type: mimeType });
    formData.append('file', fileValue, filename);
  } else {
    formData.append('file', buffer, { filename, contentType: mimeType });
  }
  formData.append('type', mimeType);

  whatsappLogger.info('Enviando request a WhatsApp media endpoint');

  const response = await fetch(buildGraphUrl(`${WHATSAPP_PHONE_NUMBER_ID}/media`), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
    },
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  whatsappLogger.info('Respuesta de WhatsApp media', {
    status: response.status,
    mediaId: data?.id,
  });

  if (!response.ok) {
    const errorMessage = data?.error?.message || 'Error al subir media a WhatsApp';
    whatsappLogger.error('Error en uploadMedia', {
      errorMessage,
      status: response.status,
    });
    const error = new Error(errorMessage);
    error.detail = data;
    throw error;
  }

  whatsappLogger.info('Media subida exitosamente', { mediaId: data?.id });
  return data;
};

export const sendDocumentMessage = async ({ to, mediaId, filename, caption }) => {
  whatsappLogger.info('Enviando documento WhatsApp', {
    to,
    mediaId,
    filename,
    hasCaption: Boolean(caption),
  });
  return sendMessage({
    messaging_product: 'whatsapp',
    to,
    type: 'document',
    document: {
      id: mediaId,
      filename,
      ...(caption ? { caption } : {}),
    },
  });
};

export const sendImageMessage = async ({ to, mediaId, caption }) => {
  whatsappLogger.info('Enviando imagen WhatsApp', {
    to,
    mediaId,
    hasCaption: Boolean(caption),
  });
  return sendMessage({
    messaging_product: 'whatsapp',
    to,
    type: 'image',
    image: {
      id: mediaId,
      ...(caption ? { caption } : {}),
    },
  });
};

export const fetchMediaInfo = async (mediaId) => {
  assertWhatsappConfig();
  const response = await fetch(buildGraphUrl(mediaId), {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage = data?.error?.message || 'Error al consultar media';
    const error = new Error(errorMessage);
    error.detail = data;
    throw error;
  }
  return data;
};

export const downloadMedia = async (mediaUrl) => {
  assertWhatsappConfig();
  const response = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });
  if (!response.ok) {
    throw new Error('Error al descargar media');
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};
