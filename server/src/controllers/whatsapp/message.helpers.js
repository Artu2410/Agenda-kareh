import path from 'node:path';
import logger from '../../config/logger.js';

const FLOW_STATE_SEPARATOR = '::';

export const createWhatsAppLogger = (baseLogger = logger, context = {}) => {
  const meta = {};

  if (context.requestId) meta.requestId = context.requestId;
  if (context.patientId) meta.patientId = context.patientId;
  if (context.phone) meta.phone = context.phone;
  if (context.messageType) meta.messageType = context.messageType;
  if (context.conversationId) meta.conversationId = context.conversationId;

  return baseLogger.child(meta);
};

export const buildFlowState = (baseState, ...metaParts) => [
  baseState,
  ...metaParts.map((part) => String(part || '').trim()).filter(Boolean),
].join(FLOW_STATE_SEPARATOR);

export const getFlowStateBase = (state) => String(state || 'welcome')
  .split(FLOW_STATE_SEPARATOR)
  .filter(Boolean)[0] || 'welcome';

export const getFlowStateMeta = (state) => String(state || '')
  .split(FLOW_STATE_SEPARATOR)
  .slice(1)
  .filter(Boolean);

export const normalizeOutgoingText = (value) => String(value || '')
  .replace(/\r\n/g, '\n')
  .replace(/\r/g, '\n')
  .trim();

export const sanitizeFilename = (value, fallback = 'archivo') => {
  const normalized = String(value || fallback)
    .replace(/[^\w.\-() ]+/g, '_')
    .trim();
  return normalized || fallback;
};

export const getFileExtension = (filename, mimeType, extensionMap = {}) => {
  const ext = path.extname(filename || '').toLowerCase();
  if (ext) return ext;
  const mimeExt = extensionMap[mimeType];
  return mimeExt ? `.${mimeExt}` : '.bin';
};
