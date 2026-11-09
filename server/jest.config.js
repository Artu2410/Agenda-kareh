export default {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  transformIgnorePatterns: ['node_modules/(?!(p-queue)/)'],
  // Umbral = cobertura real medida en nov-2026 (31% líneas, 22% ramas).
  // Subirlo a medida que se agregan tests; nunca bajarlo.
  coverageThreshold: {
    global: {
      lines: 30,
      branches: 20,
    },
  },
  // Todo el código del servidor, no solo utilidades: la cobertura tiene que reflejar el riesgo real.
  collectCoverageFrom: [
    'src/**/*.js',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 10000,
  verbose: true,
};
