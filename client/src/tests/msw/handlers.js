import { rest } from 'msw';
import { getApiUrl } from '../../services/apiBase';

// Handlers will be configured dynamically in tests by replacing these exports
export const createHandlers = ({
  protectedHandler, // function to handle protected endpoint
  refreshHandler, // function to handle refresh
}) => {
  return [
    rest.get(getApiUrl('/protected'), (req, res, ctx) => protectedHandler(req, res, ctx)),
    rest.get(getApiUrl('/csrf-token'), (req, res, ctx) => res(ctx.status(200), ctx.json({ token: 'test-csrf-token' }))),
    rest.post(getApiUrl('/auth/refresh'), (req, res, ctx) => refreshHandler(req, res, ctx)),
    rest.post(getApiUrl('/auth/logout'), (req, res, ctx) => res(ctx.status(200), ctx.json({ success: true }))),
  ];
};
