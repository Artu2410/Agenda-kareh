const {
  WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_API_VERSION = 'v20.0',
  WHATSAPP_TEMPLATE_LANGUAGE = 'es_AR',
} = process.env;

const assertWhatsappConfig = () => {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error('WhatsApp no configurado');
  }
};

const buildEndpoint = () => `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

const sendMessage = async (payload) => {
  assertWhatsappConfig();
  const response = await fetch(buildEndpoint(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage = data?.error?.message || 'Error al enviar WhatsApp';
    const error = new Error(errorMessage);
    error.detail = data;
    throw error;
  }
  return data;
};

export const sendTemplateMessage = async ({ to, name, language, components }) => (
  sendMessage({
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name,
      language: { code: language || WHATSAPP_TEMPLATE_LANGUAGE },
      components,
    },
  })
);

export const sendDocumentMessage = async ({ to, link, filename, caption }) => (
  sendMessage({
    messaging_product: 'whatsapp',
    to,
    type: 'document',
    document: {
      link,
      filename,
      caption,
    },
  })
);
