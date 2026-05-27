import { setupServer } from 'msw/node';
import { HttpResponse } from 'msw';
import { createHandlers } from './handlers';

// default handlers that can be overwritten in tests
const defaultProtected = () => HttpResponse.json({ data: 'ok' }, { status: 200 });
const defaultRefresh = () => HttpResponse.json({ success: true }, { status: 200 });

export const server = setupServer(...createHandlers({ protectedHandler: defaultProtected, refreshHandler: defaultRefresh }));
