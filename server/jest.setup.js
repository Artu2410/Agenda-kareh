// Jest setup file
// Aquí se configuran cosas globales para todos los tests

// Suprimir logs en tests (opcional)
// global.console = {
//   log: jest.fn(),
//   error: jest.fn(),
//   warn: jest.fn(),
//   info: jest.fn(),
// };

// Timeout global más alto para tests integración
jest.setTimeout(15000);
