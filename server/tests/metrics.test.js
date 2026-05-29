import {
  createHttpMetricsMiddleware,
  recordHttpRequest,
  recordLoginFailure,
  recordWhatsAppMessage,
  renderPrometheusMetrics,
  resetMetrics,
} from '../src/lib/metrics.js';

describe('metrics helpers', () => {
  beforeEach(() => {
    resetMetrics();
  });

  it('records counters and renders Prometheus metrics', () => {
    recordHttpRequest({
      method: 'post',
      route: '/api/appointments',
      status: 500,
      durationSeconds: 1.25,
    });
    recordWhatsAppMessage({ direction: 'inbound', type: 'text' });
    recordLoginFailure({ step: 'request-otp', reason: 'blocked' });

    const output = renderPrometheusMetrics();

    expect(output).toContain('http_requests_total{method="POST",route="/api/appointments",status="500"} 1');
    expect(output).toContain('http_request_duration_seconds_sum{method="POST",route="/api/appointments",status="500"} 1.25');
    expect(output).toContain('http_request_errors_total{method="POST",route="/api/appointments",status="500"} 1');
    expect(output).toContain('whatsapp_messages_total{direction="inbound",type="text"} 1');
    expect(output).toContain('login_failures_total{reason="blocked",step="request-otp"} 1');
  });

  it('captures request timing from middleware finish events', () => {
    const finishHandlers = {};
    const req = {
      method: 'PUT',
      baseUrl: '/api',
      route: { path: '/metrics' },
      originalUrl: '/api/metrics',
      path: '/metrics',
    };
    const res = {
      statusCode: 204,
      on: jest.fn((event, handler) => {
        finishHandlers[event] = handler;
        return res;
      }),
    };
    const next = jest.fn();

    createHttpMetricsMiddleware()(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    finishHandlers.finish();

    const output = renderPrometheusMetrics();
    expect(output).toContain('http_requests_total{method="PUT",route="/api/metrics",status="204"} 1');
    expect(output).toContain('http_request_duration_seconds_count{method="PUT",route="/api/metrics",status="204"} 1');
  });
});
