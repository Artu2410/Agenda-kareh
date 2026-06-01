const normalizeStatusCode = (value, fallback = 500) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 400 && parsed <= 599 ? parsed : fallback;
};

const PRISMA_ERROR_MAP = {
  P2002: {
    statusCode: 409,
    publicMessage: 'Ya existe un registro con esos datos.',
  },
  P2003: {
    statusCode: 400,
    publicMessage: 'Los datos enviados hacen referencia a un registro inexistente.',
  },
  P2021: {
    statusCode: 500,
    publicMessage: 'La base de datos del servidor no está actualizada. Ejecuta las migraciones y vuelve a intentar.',
  },
  P2022: {
    statusCode: 500,
    publicMessage: 'La base de datos del servidor no está actualizada. Ejecuta las migraciones y vuelve a intentar.',
  },
  P2025: {
    statusCode: 404,
    publicMessage: 'No se encontró el registro solicitado.',
  },
};

const getPrismaErrorMetadata = (error) => {
  const code = typeof error?.code === 'string' ? error.code : null;
  return code ? PRISMA_ERROR_MAP[code] : null;
};

class AppError extends Error {
  constructor(message, statusCode = 500, options = {}) {
    super(message);

    const resolvedStatusCode = normalizeStatusCode(statusCode);

    this.statusCode = resolvedStatusCode;
    this.status = String(resolvedStatusCode).startsWith('4') ? 'fail' : 'error';
    this.isOperational = options.isOperational ?? resolvedStatusCode < 500;
    this.publicMessage = options.publicMessage ?? message;

    if (options.code) {
      this.code = options.code;
    }

    if (options.cause) {
      this.cause = options.cause;
    }

    Error.captureStackTrace(this, this.constructor);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflicto en los datos') {
    super(message, 409);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Error de validación') {
    super(message, 400);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(message, 404);
  }
}

const toAppError = (error, { statusCode, publicMessage, message } = {}) => {
  if (error instanceof AppError) {
    if (statusCode !== undefined) {
      error.statusCode = normalizeStatusCode(statusCode, error.statusCode);
      error.status = String(error.statusCode).startsWith('4') ? 'fail' : 'error';
      error.isOperational = error.isOperational ?? error.statusCode < 500;
    }

    if (publicMessage !== undefined) {
      error.publicMessage = publicMessage;
    }

    if (message && error.message !== message) {
      error.message = message;
    }

    return error;
  }

  const resolvedStatusCode = normalizeStatusCode(statusCode, normalizeStatusCode(error?.statusCode, 500));
  const resolvedMessage = message || error?.message || publicMessage || 'Internal server error';
  const appError = new AppError(resolvedMessage, resolvedStatusCode, {
    publicMessage: publicMessage ?? resolvedMessage,
    isOperational: resolvedStatusCode < 500,
    code: error?.code,
    cause: error,
  });

  if (error?.stack) {
    appError.stack = error.stack;
  }

  return appError;
};

const createInternalError = (error, publicMessage = 'Internal server error') => {
  const prismaMetadata = getPrismaErrorMetadata(error);
  const statusCode = normalizeStatusCode(error?.statusCode, prismaMetadata?.statusCode || 500);
  const safePublicMessage = statusCode >= 500
    ? (prismaMetadata?.publicMessage || publicMessage)
    : (error?.publicMessage || prismaMetadata?.publicMessage || error?.message || publicMessage);

  return toAppError(error, {
    statusCode,
    publicMessage: safePublicMessage,
  });
};

const createPublicError = (statusCode, publicMessage, error = null) => (
  toAppError(error || publicMessage, { statusCode, publicMessage })
);

export {
  AppError,
  ConflictError,
  ValidationError,
  NotFoundError,
  createInternalError,
  createPublicError,
  toAppError,
};
