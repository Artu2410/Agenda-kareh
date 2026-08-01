import { normalizeOutgoingText } from '../message.helpers.js';

export const normalizeOutgoingConversationMessagePayload = (body) => ({
  text: normalizeOutgoingText(body?.text),
  hasFile: Boolean(body?.file),
});
