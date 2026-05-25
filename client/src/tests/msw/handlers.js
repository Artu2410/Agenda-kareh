import { rest } from 'msw';

// Handlers will be configured dynamically in tests by replacing these exports
export const createHandlers = ({
  protectedHandler, // function to handle protected endpoint
  refreshHandler, // function to handle refresh
}) => {
  return [
    rest.get('/api/protected', (req, res, ctx) => protectedHandler(req, res, ctx)),
    rest.post('/api/auth/refresh', (req, res, ctx) => refreshHandler(req, res, ctx)),
    rest.post('/api/auth/logout', (req, res, ctx) => res(ctx.status(200), ctx.json({ success: true }))),
  ];
};
