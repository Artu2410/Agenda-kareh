class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    // CORRECCIÓN: Convertir a String para usar startsWith
    this.status = String(statusCode).startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Indica que es un error previsto (ej: validación)

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

export { AppError, ConflictError, ValidationError, NotFoundError };