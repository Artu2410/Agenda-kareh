class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

class ConflictError extends AppError {
    constructor(message = 'Resource conflict', statusCode = 409) {
        super(message, statusCode);
    }
}

class ValidationError extends AppError {
    constructor(message = 'Validation failed', statusCode = 400, details = null) {
        super(message, statusCode);
        this.details = details; // To store detailed validation errors
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Resource not found', statusCode = 404) {
        super(message, statusCode);
    }
}

export { AppError, ConflictError, ValidationError, NotFoundError };
