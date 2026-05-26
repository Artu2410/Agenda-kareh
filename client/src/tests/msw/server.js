import { setupServer } from 'msw/node';
import { createHandlers } from './handlers';

// default handlers that can be overwritten in tests
const defaultProtected = (req, res, ctx) => res(ctx.status(200), ctx.json({ data: 'ok' }));
const defaultRefresh = (req, res, ctx) => res(ctx.status(200), ctx.json({ accessToken: 'new-token' }));

export const server = setupServer(...createHandlers({ protectedHandler: defaultProtected, refreshHandler: defaultRefresh }));
