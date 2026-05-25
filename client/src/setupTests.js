import 'whatwg-fetch';
import { server } from './tests/msw/server';

// Start MSW before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
