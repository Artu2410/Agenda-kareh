import { AppError, ConflictError, ValidationError, NotFoundError, toAppError } from '../errors/AppError.js';
import logger from '../config/logger.js';

const normalizeError = (err) => {
  if (err?.code === 'EBADCSRFTOKEN') {
    return toAppError(err, {
      statusCode: 403,
      publicMessage: 'CSRF token inválido o faltante',
      message: err.message || 'CSRF token inválido o faltante',
    });
  }

  if (
    err instanceof ValidationError
    || err instanceof ConflictError
    || err instanceof NotFoundError
    || err instanceof AppError
  ) {
    return err;
  }

  return toAppError(err, {
    statusCode: err?.statusCode || 500,
    publicMessage: 'Internal server error',
  });
};

const resolvePublicMessage = (error, isDev) => (
  error.publicMessage
  || (isDev ? error.message : 'Internal server error')
);

const errorHandler = (err, req, res, next) => {
  const requestLogger = req.logger || logger;
  const isDev = process.env.NODE_ENV !== 'production';
  const error = normalizeError(err);
  const statusCode = error.statusCode || 500;

  const errorContext = {
    path: req.originalUrl || req.path,
    method: req.method,
    statusCode,
    userId: req.user?.id || req.user?.userId || 'anonymous',
    requestId: req.id || req.headers['x-request-id'] || null,
    code: error.code || null,
  };

  const logPayload = {
    ...errorContext,
    errorMessage: error.message,
    publicMessage: error.publicMessage,
  };

  if (isDev && error.stack) {
    logPayload.stack = error.stack;
  }

  if (statusCode >= 500) {
    requestLogger.error('Unhandled request error', logPayload);
  } else {
    requestLogger.warn('Handled request error', logPayload);
  }

  const response = {
    success: false,
    message: resolvePublicMessage(error, isDev),
  };

  if (Array.isArray(error.errors) && error.errors.length > 0) {
    response.errors = error.errors;
  }

  return res.status(statusCode).json(response);
};

export { errorHandler };
export default errorHandler;
