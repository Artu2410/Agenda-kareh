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
  patientCreated: 'PATIENT_CREATED',
  patientUpdated: 'PATIENT_UPDATED',
  patientDeleted: 'PATIENT_DELETED',
  patientRead: 'PATIENT_READ',
  patientListed: 'PATIENT_LISTED',
  appointmentRead: 'APPOINTMENT_READ',
};

const sanitizeDetails = (details) => {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return details ?? null;
  }

  const sanitized = { ...details };
  delete sanitized.otp;
  delete sanitized.refreshToken;
  delete sanitized.accessToken;
  delete sanitized.medicalHistory;
  delete sanitized.medicalNotes;
  delete sanitized.attachments;

  return sanitized;
};

export const writeAuditLog = async (prisma, req, entry = {}) => {
  if (!prisma?.auditLog || !entry.action || !entry.resource) {
    return null;
  }

  return prisma.auditLog.create({
    data: {
      userId: entry.userId || req.user?.userId || null,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId || null,
      details: sanitizeDetails(entry.details),
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
