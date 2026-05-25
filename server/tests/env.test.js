import { validateEnv } from '../src/config/env.js';

describe('Environment Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Limpiar variables de entorno antes de cada test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should throw error when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost/db';
    process.env.NODE_ENV = 'development';

    expect(() => {
      validateEnv();
    }).toThrow();
  });

  it('should throw error when DATABASE_URL is missing', () => {
    process.env.JWT_SECRET = 'a'.repeat(32);
    delete process.env.DATABASE_URL;
    process.env.NODE_ENV = 'development';

    expect(() => {
      validateEnv();
    }).toThrow();
  });

  it('should throw error when JWT_SECRET is less than 32 characters', () => {
    process.env.JWT_SECRET = 'short-secret';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost/db';
    process.env.NODE_ENV = 'development';

    expect(() => {
      validateEnv();
    }).toThrow('JWT_SECRET debe tener al menos 32 caracteres');
  });

  it('should validate correctly with valid environment', () => {
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost/db';
    process.env.NODE_ENV = 'development';

    expect(() => {
      validateEnv();
    }).not.toThrow();
  });

  it('should use default values for optional variables', () => {
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost/db';
    delete process.env.PORT;

    // No debería lanzar error, debería usar default PORT=5000
    expect(() => {
      validateEnv();
    }).not.toThrow();
  });
});
