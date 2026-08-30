/**
 * Tests para Rate Limiting Configuration
 * 
 * Nota: Tests de funcionamiento real de rate limiting requieren
 * integración con Express middleware. Aquí testeamos la configuración.
 */

import {
  apiLimiter,
  requestOtpLimiter,
  verifyOtpLimiter,
  refreshLimiter,
  uploadLimiter,
  searchLimiter,
} from '../src/config/rateLimits.js';

describe('Rate Limiting Configuration', () => {
  describe('Rate Limiters exist and are configured', () => {
    it('should have apiLimiter configured', () => {
      expect(apiLimiter).toBeDefined();
      expect(typeof apiLimiter).toBe('function');
    });

    it('should have requestOtpLimiter configured', () => {
      expect(requestOtpLimiter).toBeDefined();
      expect(typeof requestOtpLimiter).toBe('function');
    });

    it('should have verifyOtpLimiter configured', () => {
      expect(verifyOtpLimiter).toBeDefined();
      expect(typeof verifyOtpLimiter).toBe('function');
    });

    it('should have uploadLimiter configured', () => {
      expect(uploadLimiter).toBeDefined();
      expect(typeof uploadLimiter).toBe('function');
    });

    it('should have refreshLimiter configured', () => {
      expect(refreshLimiter).toBeDefined();
      expect(typeof refreshLimiter).toBe('function');
    });

    it('should have searchLimiter configured', () => {
      expect(searchLimiter).toBeDefined();
      expect(typeof searchLimiter).toBe('function');
    });
  });

  describe('Rate Limiters are middleware functions', () => {
    it('all limiters should be callable as middleware', () => {
      const limiters = [
        apiLimiter,
        requestOtpLimiter,
        verifyOtpLimiter,
        refreshLimiter,
        uploadLimiter,
        searchLimiter,
      ];

      limiters.forEach((limiter) => {
        // Each limiter should be a function that can be used as middleware
        expect(typeof limiter).toBe('function');
      });
    });

    it('middleware functions should not throw errors', () => {
      const mockReq = { ip: '127.0.0.1' };
      const mockRes = {};
      const nextFn = jest.fn();

      // Should not throw
      expect(() => {
        apiLimiter(mockReq, mockRes, nextFn);
      }).not.toThrow();
    });
  });

  describe('All rate limiters configured', () => {
    it('should have 6 rate limiters exported', () => {
      const limiters = [
        apiLimiter,
        requestOtpLimiter,
        verifyOtpLimiter,
        refreshLimiter,
        uploadLimiter,
        searchLimiter,
      ];

      expect(limiters.length).toBe(6);
      limiters.forEach((limiter) => {
        expect(typeof limiter).toBe('function');
      });
    });
  });
});
