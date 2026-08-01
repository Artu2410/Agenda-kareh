# Testing Guide

## Overview

Nuestro proyecto ahora tiene un suite de testing completo con Jest y Supertest.

### Estructura

- `tests/` - Directorio raíz de tests
  - `errors.test.js` - Tests unitarios para clases de error
  - `env.test.js` - Tests para validación de variables de entorno
  - `integration.test.js` - Tests de integración HTTP
  
## Running Tests

### Ejecutar todos los tests

```bash
npm test
```

Esto ejecutará todos los tests y generará un reporte de cobertura.

### Ejecutar tests en modo watch

```bash
npm run test:watch
```

Útil durante desarrollo - re-ejecuta los tests automáticamente cuando cambias código.

### Ejecutar tests en debug mode

```bash
npm run test:debug
```

Abre Node.js inspector en puerto 9229. Puedes debuggear en VS Code o Chrome DevTools.

### Ejecutar tests específicos

```bash
# Por archivo
npm test -- errors.test.js

# Por patrón
npm test -- --testNamePattern="ValidationError"

# Con coverage
npm test -- --coverage
```

## Writing Tests

### Estructura básica

```javascript
describe('Feature Name', () => {
  // Setup (runs before each test)
  beforeEach(() => {
    // ...
  });

  // Cleanup (runs after each test)
  afterEach(() => {
    // ...
  });

  it('should do something', () => {
    // Arrange
    const data = { /* ... */ };
    
    // Act
    const result = doSomething(data);
    
    // Assert
    expect(result).toBe(expected);
  });
});
```

### Testing con Supertest

```javascript
import request from 'supertest';
import app from './app';

it('should create a user', async () => {
  const response = await request(app)
    .post('/api/users')
    .send({ email: 'user@test.com' })
    .expect(201);
  
  expect(response.body.id).toBeDefined();
});
```

## Coverage Goals

- Aim for 80% overall coverage
- 100% coverage for:
  - Error classes
  - Utility functions
  - Middleware
- Controllers and services: 70-80% (focus on critical paths)

## Best Practices

1. **Test names should be descriptive**
   - ✅ "should throw ValidationError when email is missing"
   - ❌ "test email"

2. **Use beforeEach/afterEach for setup/cleanup**
   ```javascript
   beforeEach(() => jest.clearAllMocks());
   ```

3. **Mock external dependencies**
   ```javascript
   jest.mock('../src/config/logger');
   ```

4. **Test error cases**
   ```javascript
   expect(() => validateEnv()).toThrow('JWT_SECRET debe tener...');
   ```

5. **Keep tests focused and isolated**
   - One concept per test
   - No shared state between tests

## Debugging

### In VS Code

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Jest Debug",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

Then press F5 to start debugging.

### Using console.log

Tests can use `console.log()` which will print output during test execution.

## Common Issues

**"Cannot find module" errors**
- Ensure `jest.config.js` has correct `testMatch` patterns
- Check that imports use proper file extensions (`.js`)

**Tests timing out**
- Increase timeout: `jest.setTimeout(20000);`
- Check for unresolved promises

**Mock not working**
- Ensure `jest.mock()` is called before importing the module
- Use `jest.doMock()` for dynamic mocking

## Continuous Integration

Tests run automatically on:
- Pull requests (see `.github/workflows/`)
- Commits to main branch
- Pre-push hook (if configured locally)

## Next Steps

1. Add tests for auth controllers
2. Add tests for appointment routes
3. Set up code coverage reporting
4. Integrate with GitHub Actions for CI/CD

