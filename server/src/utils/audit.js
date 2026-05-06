import { getRequestIp, getRequestUserAgent } from './auth.js';

export const auditActions = {
  authOtpRequested: 'AUTH_OTP_REQUESTED',
  authOtpRequestDenied: 'AUTH_OTP_REQUEST_DENIED',
  authLoginSucceeded: 'AUTH_LOGIN_SUCCEEDED',
  authLoginFailed: 'AUTH_LOGIN_FAILED',
  authTokenVerified: 'AUTH_TOKEN_VERIFIED',
  authRefreshSucceeded: 'AUTH_REFRESH_SUCCEEDED',
  authRefreshFailed: 'AUTH_REFRESH_FAILED',
  authLogout: 'AUTH_LOGOUT',
  userCreated: 'USER_CREATED',
  userUpdated: 'USER_UPDATED',
  userRoleChanged: 'USER_ROLE_CHANGED',
  userDeleted: 'USER_DELETED',
  patientCreated: 'PATIENT_CREATED',
  patientUpdated: 'PATIENT_UPDATED',
  patientDeleted: 'PATIENT_DELETED',
  patientRead: 'PATIENT_READ',
  patientListed: 'PATIENT_LISTED',
  professionalCreated: 'PROFESSIONAL_CREATED',
  professionalUpdated: 'PROFESSIONAL_UPDATED',
  professionalDeleted: 'PROFESSIONAL_DELETED',
  appointmentCreated: 'APPOINTMENT_CREATED',
  appointmentUpdated: 'APPOINTMENT_UPDATED',
  appointmentDeleted: 'APPOINTMENT_DELETED',
  appointmentRead: 'APPOINTMENT_READ',
  clinicalHistoryCreated: 'CLINICAL_HISTORY_CREATED',
  clinicalHistoryUpdated: 'CLINICAL_HISTORY_UPDATED',
  clinicalHistoryDeleted: 'CLINICAL_HISTORY_DELETED',
  obraSocialCreated: 'OBRA_SOCIAL_CREATED',
  obraSocialUpdated: 'OBRA_SOCIAL_UPDATED',
  obraSocialDeleted: 'OBRA_SOCIAL_DELETED',
  obraSocialAuthorized: 'OBRA_SOCIAL_AUTHORIZED',
  obraSocialAuthorizationRejected: 'OBRA_SOCIAL_AUTHORIZATION_REJECTED',
  auditCleanup: 'AUDIT_CLEANUP',
};

const SENSITIVE_KEYS = new Set([
  'otp',
  'refreshToken',
  'accessToken',
  'medicalHistory',
  'medicalNotes',
  'attachments',
  'authorizationFileUrl',
]);

const sanitizePayload = (payload) => {
  if (payload === undefined) return null;
  if (payload === null) return null;

  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizePayload(item));
  }

  if (typeof payload !== 'object') {
    return payload;
  }

  const sanitized = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (SENSITIVE_KEYS.has(key)) {
      return;
    }

    sanitized[key] = sanitizePayload(value);
  });

  return sanitized;
};

export const writeAuditLog = async (prisma, req, entry = {}) => {
  const entityType = entry.entityType || entry.resource;
  const entityId = entry.entityId || entry.resourceId || null;

  if (!prisma?.auditLog || !entry.action || !entityType) {
    return null;
  }

  return prisma.auditLog.create({
    data: {
      userId: entry.userId || req.user?.userId || null,
      action: entry.action,
      entityType,
      entityId,
      oldValues: sanitizePayload(entry.oldValues),
      newValues: sanitizePayload(entry.newValues),
      details: sanitizePayload(entry.details),
      ipAddress: getRequestIp(req),
      userAgent: getRequestUserAgent(req),
    },
  });
};

export const safeWriteAuditLog = async (prisma, req, entry = {}) => {
  try {
    await writeAuditLog(prisma, req, entry);
  } catch (error) {
    console.error('❌ Error registrando auditoría:', error.message);
  }
};
