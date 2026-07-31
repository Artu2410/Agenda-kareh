const stores = {
  httpRequests: new Map(),
  httpDurations: new Map(),
  httpErrors: new Map(),
  whatsappMessages: new Map(),
  loginFailures: new Map(),
};

const escapeLabelValue = (value) => String(value ?? '')
  .replace(/\\/g, '\\\\')
  .replace(/\n/g, '\\n')
  .replace(/"/g, '\\"');

const buildLabelString = (labels = {}) => {
  const entries = Object.entries(labels).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (!entries.length) return '';
  return `{${entries.map(([key, value]) => `${key}="${escapeLabelValue(value)}"`).join(',')}}`;
};

const buildMetricKey = (name, labels = {}) => `${name}|${JSON.stringify(labels, Object.keys(labels).sort())}`;

const incrementStore = (store, name, labels = {}, amount = 1) => {
  const key = buildMetricKey(name, labels);
  store.set(key, (store.get(key) || 0) + amount);
};

const sanitizeRouteLabel = (value) => {
  const normalized = String(value || '/')
    .split('?')[0]
    .trim();

  return normalized || '/';
};

const resolveRouteLabel = (req) => {
  const baseUrl = String(req.baseUrl || '');
  const routePath = typeof req.route?.path === 'string'
    ? req.route.path
    : Array.isArray(req.route?.path)
      ? req.route.path[0]
      : '';

  return sanitizeRouteLabel(`${baseUrl}${routePath}` || req.originalUrl || req.path || '/');
};

export const recordHttpRequest = ({ method, route, status, durationSeconds }) => {
  const labels = {
    method: String(method || 'GET').toUpperCase(),
    route: sanitizeRouteLabel(route),
    status: String(status || 0),
  };

  incrementStore(stores.httpRequests, 'http_requests_total', labels, 1);
  incrementStore(stores.httpDurations, 'http_request_duration_seconds_sum', labels, Number(durationSeconds) || 0);
  incrementStore(stores.httpDurations, 'http_request_duration_seconds_count', labels, 1);

  if (Number(status) >= 400) {
    incrementStore(stores.httpErrors, 'http_request_errors_total', labels, 1);
  }
};

export const recordWhatsAppMessage = ({ direction = 'inbound', type = 'text' } = {}) => {
  incrementStore(stores.whatsappMessages, 'whatsapp_messages_total', {
    direction: String(direction || 'inbound'),
    type: String(type || 'text'),
  }, 1);
};

export const recordLoginFailure = ({ step = 'verify-otp', reason = 'unknown' } = {}) => {
  incrementStore(stores.loginFailures, 'login_failures_total', {
    step: String(step || 'verify-otp'),
    reason: String(reason || 'unknown'),
  }, 1);
};

export const createHttpMetricsMiddleware = () => (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    recordHttpRequest({
      method: req.method,
      route: resolveRouteLabel(req),
      status: res.statusCode,
      durationSeconds,
    });
  });

  next();
};

const renderMetricBlock = (name, type, description, store) => {
  const lines = [];
  if (description) {
    lines.push(`# HELP ${name} ${description}`);
  }
  lines.push(`# TYPE ${name} ${type}`);

  const sortedEntries = [...store.entries()]
    .filter(([key]) => key.startsWith(`${name}|`))
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

  for (const [key, value] of sortedEntries) {
    const [metricName, rawLabelsJson] = key.split('|');
    const labels = JSON.parse(rawLabelsJson || '{}');
    lines.push(`${metricName}${buildLabelString(labels)} ${Number(value)}`);
  }

  return lines;
};

export const renderPrometheusMetrics = () => {
  const blocks = [
    renderMetricBlock('http_requests_total', 'counter', 'Total de requests HTTP recibidas', stores.httpRequests),
    renderMetricBlock('http_request_duration_seconds_sum', 'counter', 'Suma de duraciones HTTP en segundos', stores.httpDurations),
    renderMetricBlock('http_request_duration_seconds_count', 'counter', 'Cantidad de requests HTTP medidas', stores.httpDurations),
    renderMetricBlock('http_request_errors_total', 'counter', 'Total de requests HTTP con error', stores.httpErrors),
    renderMetricBlock('whatsapp_messages_total', 'counter', 'Cantidad de mensajes WhatsApp procesados', stores.whatsappMessages),
    renderMetricBlock('login_failures_total', 'counter', 'Cantidad de fallos de login OTP', stores.loginFailures),
  ];

  return blocks.flat().join('\n');
};

export const resetMetrics = () => {
  Object.values(stores).forEach((store) => store.clear());
};
