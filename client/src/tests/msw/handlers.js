import { http, HttpResponse } from 'msw';
import { getApiUrl } from '../../services/apiBase';

// Handlers will be configured dynamically in tests by replacing these exports
export const createHandlers = ({
  protectedHandler, // function to handle protected endpoint
  refreshHandler, // function to handle refresh
}) => {
  return [
    http.get(getApiUrl('/protected'), ({ request, params, cookies }) =>
      protectedHandler({ request, params, cookies })
    ),
    http.get(getApiUrl('/version'), () =>
      HttpResponse.json({
        version: '2026.05.28-rc1',
        commit: 'cb5f418',
        environment: 'test',
        deployedAt: '2026-05-28T22:00:00.000Z',
      }, { status: 200 })
    ),
    http.get(getApiUrl('/csrf-token'), () =>
      HttpResponse.json({ token: 'test-csrf-token' }, { status: 200 })
    ),
    http.post(getApiUrl('/auth/refresh'), ({ request, params, cookies }) =>
      refreshHandler({ request, params, cookies })
    ),
    http.post(getApiUrl('/auth/logout'), () =>
      HttpResponse.json({ success: true }, { status: 200 })
    ),
  ];
};
