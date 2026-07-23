export const parseWhatsAppWebhookBody = (body) => ({
  object: body?.object || null,
  entries: Array.isArray(body?.entry) ? body.entry : [],
});

export const parseWhatsAppWebhookChanges = (entry) => (
  Array.isArray(entry?.changes) ? entry.changes : []
);

export const parseWhatsAppWebhookValue = (change) => change?.value || {};

export const parseWhatsAppWebhookMessages = (value) => (
  Array.isArray(value?.messages) ? value.messages : []
);

export const parseWhatsAppWebhookStatuses = (value) => (
  Array.isArray(value?.statuses) ? value.statuses : []
);
