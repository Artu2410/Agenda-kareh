import { AppError, ConflictError, ValidationError, NotFoundError } from '../errors/AppError.js';
import logger from '../config/logger.js';

const errorHandler = (err, req, res, next) => {
  const requestLogger = req.logger || logger;

  // Log del error con contexto
  const errorContext = {
    path: req.path,
    method: req.method,
    statusCode: err.statusCode || 500,
    stack: err.stack,
    userId: req.user?.id || 'anonymous',
  };

  if (err instanceof ValidationError) {
    requestLogger.warn('Validation error', errorContext);
    return res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  } else if (err instanceof ConflictError) {
    requestLogger.warn('Conflict error', errorContext);
    return res.status(409).json({
      status: 'fail',
      message: err.message,
    });
  } else if (err instanceof NotFoundError) {
    requestLogger.warn('Not found error', errorContext);
    return res.status(404).json({
      status: 'fail',
      message: err.message,
    });
  } else if (err instanceof AppError) {
    requestLogger.warn('Application error', errorContext);
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Unexpected errors - log como error
    requestLogger.error('UNEXPECTED ERROR', {
      ...errorContext,
      message: err.message,
      stack: err.stack,
    });

    return res.status(500).json({
      status: 'error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went very wrong!',
    });
  }
};

export default errorHandler;
