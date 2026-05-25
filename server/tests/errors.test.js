import { AppError, ValidationError, ConflictError, NotFoundError } from '../src/errors/AppError.js';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create an AppError with correct properties', () => {
      const error = new AppError('Test error', 400);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.status).toBe('fail');
      expect(error.isOperational).toBe(true);
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
});
