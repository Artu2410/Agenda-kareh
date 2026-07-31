const DEFAULT_TIMEOUT_MS = 15_000;

const normalizeBaseUrl = (value, label) => {
  const normalized = String(value || '').trim().replace(/\/+$/, '');
  if (!normalized) {
    throw new Error(`${label} no configurado`);
  }

  try {
    return new URL(normalized).toString().replace(/\/+$/, '');
  } catch {
    throw new Error(`${label} no es una URL valida`);
  }
};

const getRequiredUrl = (name) => normalizeBaseUrl(process.env[name], name);

const withTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    return await fetch(url, {
      redirect: 'follow',
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const assertOk = async (url, options = {}, expectedStatuses = [200]) => {
  const response = await withTimeout(url, options);

  if (!expectedStatuses.includes(response.status)) {
    const body = await response.text().catch(() => '');
    throw new Error(`${url} devolvio ${response.status}. Body: ${body.slice(0, 300)}`);
  }

  return response;
};

const checkFrontend = async (frontendUrl) => {
  const response = await assertOk(frontendUrl, {}, [200]);
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('text/html')) {
    throw new Error(`Frontend sin HTML valido en ${frontendUrl}`);
  }

  console.log(`OK frontend: ${frontendUrl}`);
};

const checkBackendHealth = async (backendUrl) => {
  const healthUrl = `${backendUrl}/health`;
  const apiHealthUrl = `${backendUrl}/api/health`;

  const [healthResponse, apiHealthResponse] = await Promise.all([
    assertOk(healthUrl),
    assertOk(apiHealthUrl),
  ]);

  const [healthBody, apiHealthBody] = await Promise.all([
    healthResponse.json(),
    apiHealthResponse.json(),
  ]);

  if (healthBody?.status !== 'ok') {
    throw new Error(`/health no devolvio status ok`);
  }

  if (apiHealthBody?.status !== 'ok') {
    throw new Error(`/api/health no devolvio status ok`);
  }

  console.log(`OK backend health: ${healthUrl}`);
  console.log(`OK backend api health: ${apiHealthUrl}`);
};

const checkCors = async (backendUrl, origin) => {
  const response = await assertOk(`${backendUrl}/api/health`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'GET',
    },
  }, [204]);

  const allowedOrigin = response.headers.get('access-control-allow-origin');
  const allowCredentials = response.headers.get('access-control-allow-credentials');

  if (allowedOrigin !== origin) {
    throw new Error(`CORS origin esperado ${origin}, recibido ${allowedOrigin || 'vacio'}`);
  }

  if (allowCredentials !== 'true') {
    throw new Error('CORS no expone access-control-allow-credentials=true');
  }

  console.log(`OK CORS: ${origin}`);
};

const run = async () => {
  const frontendUrl = getRequiredUrl('FRONTEND_URL');
  const backendUrl = getRequiredUrl('BACKEND_URL');
  const corsOrigin = normalizeBaseUrl(process.env.ORIGIN_HEADER || frontendUrl, 'ORIGIN_HEADER');

  console.log('Iniciando smoke checks de deploy...');
  await checkFrontend(frontendUrl);
  await checkBackendHealth(backendUrl);
  await checkCors(backendUrl, corsOrigin);
  console.log('Smoke checks completados correctamente.');
};

run().catch((error) => {
  console.error(`Smoke checks fallaron: ${error.message}`);
  process.exit(1);
});
