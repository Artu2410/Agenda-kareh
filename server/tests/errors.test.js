import {
  AppError,
  ValidationError,
  ConflictError,
  NotFoundError,
  createInternalError,
  createPublicError,
} from '../src/errors/AppError.js';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create an AppError with correct properties', () => {
      const error = new AppError('Test error', 400);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.status).toBe('fail');
      expect(error.isOperational).toBe(true);
      expect(error.publicMessage).toBe('Test error');
    });

    it('should classify 4xx errors as "fail"', () => {
      const error = new AppError('Bad request', 400);
      expect(error.status).toBe('fail');
    });

    it('should classify 5xx errors as "error"', () => {
      const error = new AppError('Server error', 500);
      expect(error.status).toBe('error');
    });
  });

  describe('ValidationError', () => {
    it('should be instance of AppError', () => {
      const error = new ValidationError('Invalid input');
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(400);
      expect(error.status).toBe('fail');
    });

    it('should use default message', () => {
      const error = new ValidationError();
      expect(error.message).toBe('Error de validación');
    });
  });

  describe('ConflictError', () => {
    it('should return 409 status', () => {
      const error = new ConflictError('Duplicate entry');
      expect(error.statusCode).toBe(409);
      expect(error.status).toBe('fail');
    });
  });

  describe('NotFoundError', () => {
    it('should return 404 status', () => {
      const error = new NotFoundError('User not found');
      expect(error.statusCode).toBe(404);
      expect(error.status).toBe('fail');
    });
  });

  describe('Error helpers', () => {
    it('should sanitize internal errors with a public message', () => {
      const originalError = new Error('Prisma failed with secret SQL');
      const error = createInternalError(originalError, 'Error al guardar');

      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Prisma failed with secret SQL');
      expect(error.publicMessage).toBe('Error al guardar');
    });

    it('should preserve 4xx messages when wrapping operational errors', () => {
      const originalError = new Error('Turno no encontrado');
      originalError.statusCode = 404;

      const error = createInternalError(originalError, 'Error interno');

      expect(error.statusCode).toBe(404);
      expect(error.publicMessage).toBe('Turno no encontrado');
    });

    it('should create explicit public errors', () => {
      const error = createPublicError(503, 'Servicio no disponible', new Error('DB down'));

      expect(error.statusCode).toBe(503);
      expect(error.publicMessage).toBe('Servicio no disponible');
      expect(error.message).toBe('DB down');
    });
  });
});
