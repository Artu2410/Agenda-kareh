import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer';

const COKIBA_LOGIN_URL = 'https://autogestion.cokiba.org.ar/web/?q=login';
const COKIBA_OS_URL = 'https://autogestion.cokiba.org.ar/web/?q=form_os';

const ESTADOS_EXCLUIDOS = ['baja', 'suspendida', 'falta de pago'];

const WHITELIST_SAN_MIGUEL = [
  'OSDE',
  'SWISS MEDICAL',
  'GALENO',
  'MEDICUS',
  'OMINT',
  'HOSPITAL ITALIANO',
  'UNION PERSONAL',
  'OSPRERA',
  'OSECAC',
  'OSDEPYM',
  'ACCORD SALUD',
  'MEDIFE',
  'SANCOR SALUD',
  'PAMI',
];

const DEFAULT_LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
];

const LOOKS_LIKE_PLACEHOLDER = /^(tu_|your_|example|demo|test)/i;

const getCokibaConfig = () => ({
  dni: String(process.env.COKIBA_DNI || '').trim(),
  clave: String(process.env.COKIBA_CLAVE || '').trim(),
  plazoPago: Number.parseInt(process.env.COKIBA_PLAZO_PAGO || '60', 10) || 60,
});

const buildConfigStatus = () => {
  const config = getCokibaConfig();
  const missingFields = [];
  const placeholderFields = [];

  if (!config.dni) missingFields.push('COKIBA_DNI');
  if (!config.clave) missingFields.push('COKIBA_CLAVE');

  if (config.dni && LOOKS_LIKE_PLACEHOLDER.test(config.dni)) {
    placeholderFields.push('COKIBA_DNI');
  }
  if (config.clave && LOOKS_LIKE_PLACEHOLDER.test(config.clave)) {
    placeholderFields.push('COKIBA_CLAVE');
  }

  return {
    configured: missingFields.length === 0,
    missingFields,
    placeholderFields,
    canSync: missingFields.length === 0 && placeholderFields.length === 0,
    plazoPago: config.plazoPago,
  };
};

const ensureCredentials = () => {
  const status = buildConfigStatus();

  if (status.missingFields.length > 0) {
    throw new Error(`Faltan credenciales COKIBA: ${status.missingFields.join(', ')}`);
  }

  if (status.placeholderFields.length > 0) {
    throw new Error(`Las credenciales COKIBA siguen con placeholders: ${status.placeholderFields.join(', ')}`);
  }

  return getCokibaConfig();
};

const normalizeMoney = (value) => {
  if (!value) return 0;

  const clean = String(value).replace(/\$/g, '').replace(/\s/g, '').trim();

  if (/^[\d.]+,\d{2}$/.test(clean)) {
    const parsed = Number.parseFloat(clean.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (/^\d+(\.\d{1,2})?$/.test(clean)) {
    const parsed = Number.parseFloat(clean);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const extractCode = (row) => {
  for (const cell of row) {
    const value = String(cell || '').trim();
    if (/^\d{1,6}$/.test(value)) return value;
    if (/^[A-Z0-9]{2,10}$/i.test(value) && value.length <= 10) return value;
  }
  return null;
};

const extractName = (row) => {
  let candidate = '';

  for (const cell of row) {
    const value = String(cell || '').trim();
    if (!value) continue;
    if (/^\$?\s*[\d.,]+$/.test(value)) continue;
    if (/^\d{1,6}$/.test(value)) continue;
    if (value.length > candidate.length) candidate = value;
  }

  return candidate;
};

const extractCategory = (row) => {
  const keywords = ['básica', 'basica', 'superior', 'premium', 'especial', 'categoría', 'categoria'];

  for (const cell of row) {
    const value = String(cell || '').toLowerCase();
    if (keywords.some((keyword) => value.includes(keyword))) {
      return String(cell).trim();
    }
  }

  return null;
};

const extractAmount = (row, type) => {
  const amounts = row
    .map((cell) => normalizeMoney(cell))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (amounts.length === 0) return 0;
  if (amounts.length === 1) return amounts[0];

  return type === 'honorario' ? amounts[amounts.length - 1] : amounts[0];
};

const generateCode = (name) => (
  `${String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 10)}_${Date.now().toString(36)}`
);

const parseRows = (rawRows, plazoPago, logger) => {
  const obrasSociales = [];

  for (const row of rawRows) {
    if (!Array.isArray(row) || row.length < 3) continue;

    const fullText = row.join(' ').toLowerCase();
    const excluded = ESTADOS_EXCLUIDOS.some((estado) => fullText.includes(estado));
    if (excluded) continue;

    const codigo = extractCode(row);
    const nombre = extractName(row);
    const categoria = extractCategory(row);
    const honorario = extractAmount(row, 'honorario');
    const coseguro = extractAmount(row, 'coseguro');

    if (categoria && !categoria.toLowerCase().includes('básica') && !categoria.toLowerCase().includes('basica')) {
      continue;
    }

    if (!nombre || nombre.length < 2) continue;

    const rowText = row.join(' ').toUpperCase();
    const atendibleSanMiguel =
      rowText.includes('PROVINCIA DE BUENOS AIRES') ||
      rowText.includes('SAN MIGUEL') ||
      rowText.includes('BELLA VISTA') ||
      WHITELIST_SAN_MIGUEL.some((item) => nombre.toUpperCase().includes(item));

    obrasSociales.push({
      codigoCokiba: codigo || generateCode(nombre),
      nombreOs: nombre,
      coseguroValor: coseguro,
      honorarioEstimado: honorario,
      plazoPago,
      estado: 'Activa',
      atendibleSanMiguel,
      rawCategoria: categoria || 'Básica',
    });
  }

  logger.info(`✅ ${obrasSociales.length} obras sociales activas extraídas`);
  return obrasSociales;
};

const login = async (page, logger, credentials) => {
  logger.info('🔐 Navegando al login de COKIBA...');
  await page.goto(COKIBA_LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('input[name="dni"], input[name="username"], input#edit-name', {
    timeout: 15000,
  });

  const dniSelector = (await page.$('input#edit-name')) ? 'input#edit-name' : 'input[name="dni"]';
  const passSelector = (await page.$('input#edit-pass')) ? 'input#edit-pass' : 'input[name="clave"]';
  const submitBtn = await page.$('input#edit-submit, button[type="submit"], input[type="submit"]');

  if (!submitBtn) {
    throw new Error('No se encontró el botón de login de COKIBA');
  }

  await page.type(dniSelector, credentials.dni, { delay: 30 });
  await page.type(passSelector, credentials.clave, { delay: 30 });

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
    submitBtn.click(),
  ]);

  const loginState = await page.evaluate(() => {
    const bodyText = document.body.innerText || '';
    const hasPasswordField = Boolean(document.querySelector('input#edit-pass, input[name="pass"]'));
    const hasLogoutLink = Array.from(document.querySelectorAll('a'))
      .some((link) => /logout|cerrar sesi[oó]n/i.test((link.getAttribute('href') || '') + ' ' + (link.textContent || '')));

    return {
      bodyText,
      hasPasswordField,
      hasLogoutLink,
    };
  });

  const looksLoggedIn =
    loginState.hasLogoutLink ||
    /cerrar sesi[oó]n/i.test(loginState.bodyText) ||
    /usuario:/i.test(loginState.bodyText);

  if (!looksLoggedIn && loginState.hasPasswordField) {
    throw new Error('Login fallido en COKIBA. Verificá COKIBA_DNI y COKIBA_CLAVE.');
  }

  logger.info('✅ Login exitoso en COKIBA');
};

const logout = async (page, logger) => {
  try {
    await page.goto('https://autogestion.cokiba.org.ar/web/?q=user/logout', {
      waitUntil: 'networkidle2',
      timeout: 15000,
    });
    logger.info('✅ Sesión COKIBA cerrada');
  } catch (error) {
    logger.warn(`⚠️ No se pudo cerrar sesión COKIBA: ${error.message}`);
  }
};

const fetchOptionCatalog = async (page, logger) => {
  logger.info('📋 Navegando a la sección de Obras Sociales...');
  await page.goto(COKIBA_OS_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('#edit-seleccion-os-obrasocial', { timeout: 15000 });

  const catalog = await page.evaluate(() => {
    const select = document.querySelector('#edit-seleccion-os-obrasocial');
    const form = document.querySelector('form');
    if (!select || !form) return null;

    return {
      action: form.getAttribute('action') || location.href,
      formBuildId: form.querySelector('input[name="form_build_id"]')?.value || '',
      formToken: form.querySelector('input[name="form_token"]')?.value || '',
      formId: form.querySelector('input[name="form_id"]')?.value || '',
      options: Array.from(select.querySelectorAll('option'))
        .map((option) => ({
          value: option.value,
          label: option.textContent.trim(),
        }))
        .filter((option) => option.value && option.label),
    };
  });

  if (!catalog) {
    throw new Error('No se pudo leer el selector de obras sociales en COKIBA.');
  }

  logger.info(`📊 Se encontraron ${catalog.options.length} obras sociales en el selector`);
  return catalog;
};

const parseCoseguroFromText = (text) => {
  const normalized = String(text || '').trim();
  if (!normalized || /no posee|sin coseguro|no\s*$/i.test(normalized)) {
    return 0;
  }

  return normalizeMoney(normalized);
};

const extractDetailRecord = (detail, option, plazoPago) => {
  const bodyText = detail.bodyText || '';
  const relevantHeading = (detail.headings || []).find(
    (heading) =>
      heading &&
      !/novedades|aranceles y normas|cuit:|area de cobertura:|coseguro:|observaciones:|convenio|superior|aqui/i.test(
        heading
      )
  );

  const tariffTable = [...(detail.tables || [])].sort((a, b) => b.length - a.length)[0] || [];
  const consultorioRow = tariffTable.find((row) => /consultorio/i.test(String(row?.[0] || '')));
  const categoriaBasica = normalizeMoney(consultorioRow?.[1] || 0);
  const coseguroMatch = bodyText.match(/Coseguro:\s*([^\n]+)/i);
  const areaMatch = bodyText.match(/Area de Cobertura:\s*([^\n]+)/i);

  const nombreOs = relevantHeading || option.label;
  const area = areaMatch?.[1]?.trim() || '';
  const combinedZoneText = `${nombreOs} ${area}`.toUpperCase();

  return {
    codigoCokiba: option.value,
    nombreOs,
    coseguroValor: parseCoseguroFromText(coseguroMatch?.[1] || ''),
    honorarioEstimado: categoriaBasica,
    plazoPago,
    estado: 'Activa',
    atendibleSanMiguel:
      combinedZoneText.includes('PROVINCIA DE BUENOS AIRES') ||
      combinedZoneText.includes('SAN MIGUEL') ||
      combinedZoneText.includes('BELLA VISTA') ||
      WHITELIST_SAN_MIGUEL.some((item) => combinedZoneText.includes(item)),
    rawCategoria: 'Básica',
  };
};

const fetchOptionDetails = async (page, catalog, option, plazoPago, logger) => {
  const detail = await page.evaluate(async (payload) => {
    const targetUrl = new URL(payload.action, window.location.origin).toString();
    const params = new URLSearchParams();
    params.set('seleccion_OS[obrasocial]', payload.optionValue);
    params.set('op', 'Seleccionar');
    params.set('form_build_id', payload.formBuildId);
    params.set('form_token', payload.formToken);
    params.set('form_id', payload.formId);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      credentials: 'include',
    });

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    return {
      ok: response.ok,
      status: response.status,
      headings: Array.from(doc.querySelectorAll('h1,h2,h3,h4,strong,b'))
        .map((element) => element.textContent.trim())
        .filter(Boolean),
      tables: Array.from(doc.querySelectorAll('table'))
        .map((table) =>
          Array.from(table.querySelectorAll('tr')).map((tr) =>
            Array.from(tr.children).map((cell) => cell.textContent.trim())
          )
        )
        .filter((table) => table.length > 1),
      bodyText: doc.body?.innerText || doc.body?.textContent || '',
    };
  }, {
    action: catalog.action,
    formBuildId: catalog.formBuildId,
    formToken: catalog.formToken,
    formId: catalog.formId,
    optionValue: option.value,
  });

  if (!detail.ok) {
    throw new Error(`Respuesta HTTP ${detail.status}`);
  }

  const record = extractDetailRecord(detail, option, plazoPago);
  return record;
};

const collectObrasSociales = async (page, plazoPago, logger) => {
  const catalog = await fetchOptionCatalog(page, logger);
  const result = [];

  for (const [index, option] of catalog.options.entries()) {
    try {
      const detail = await fetchOptionDetails(page, catalog, option, plazoPago, logger);
      result.push(detail);
      if ((index + 1) % 10 === 0 || index === catalog.options.length - 1) {
        logger.info(`✔ Progreso COKIBA: ${index + 1}/${catalog.options.length}`);
      }
    } catch (error) {
      logger.warn(`⚠️ No se pudo extraer ${option.value} · ${option.label}: ${error.message}`);
    }
  }

  logger.info(`✅ ${result.length} obras sociales extraídas con detalle`);
  return result;
};

const synchronizeRows = async (prisma, obrasSociales, logger) => {
  let created = 0;
  let updated = 0;

  for (const obraSocial of obrasSociales) {
    const existing = await prisma.obraSocial.findUnique({
      where: { codigoCokiba: obraSocial.codigoCokiba },
      select: { id: true },
    });

    await prisma.obraSocial.upsert({
      where: { codigoCokiba: obraSocial.codigoCokiba },
      update: {
        nombreOs: obraSocial.nombreOs,
        coseguroValor: obraSocial.coseguroValor,
        honorarioEstimado: obraSocial.honorarioEstimado,
        plazoPago: obraSocial.plazoPago,
        estado: obraSocial.estado,
        atendibleSanMiguel: obraSocial.atendibleSanMiguel,
        rawCategoria: obraSocial.rawCategoria,
        ultimaSync: new Date(),
      },
      create: {
        ...obraSocial,
        ultimaSync: new Date(),
      },
    });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  logger.info(`✅ Sincronización completada: ${created} nuevas, ${updated} actualizadas`);
  return { created, updated, total: obrasSociales.length };
};

const defaultLogger = {
  info: console.log,
  warn: console.warn,
  error: console.error,
};

export const getCokibaSyncStatus = async (prisma) => {
  const config = buildConfigStatus();
  const [total, activas, latest] = await Promise.all([
    prisma.obraSocial.count(),
    prisma.obraSocial.count({ where: { estado: 'Activa' } }),
    prisma.obraSocial.findFirst({
      orderBy: { ultimaSync: 'desc' },
      select: {
        ultimaSync: true,
        nombreOs: true,
      },
    }),
  ]);

  return {
    source: 'COKIBA',
    total,
    activas,
    lastSyncAt: latest?.ultimaSync || null,
    lastSyncedRecord: latest?.nombreOs || null,
    config,
  };
};

export const runCokibaSync = async ({ prisma, logger = defaultLogger } = {}) => {
  const credentials = ensureCredentials();
  const localPrisma = prisma || new PrismaClient();
  const ownsPrisma = !prisma;
  let browser = null;

  try {
    logger.info('🚀 Iniciando sincronización COKIBA...');

    browser = await puppeteer.launch({
      headless: 'new',
      args: DEFAULT_LAUNCH_ARGS,
      defaultViewport: { width: 1280, height: 800 },
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(30000);
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await login(page, logger, credentials);
    const obrasSociales = await collectObrasSociales(page, credentials.plazoPago, logger);
    await logout(page, logger);

    if (obrasSociales.length === 0) {
      throw new Error('No se pudieron extraer obras sociales desde COKIBA.');
    }

    const syncResult = await synchronizeRows(localPrisma, obrasSociales, logger);
    const status = await getCokibaSyncStatus(localPrisma);

    return {
      ...syncResult,
      extracted: obrasSociales.length,
      status,
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        logger.warn(`⚠️ No se pudo cerrar el navegador de COKIBA: ${error.message}`);
      }
    }

    if (ownsPrisma) {
      await localPrisma.$disconnect();
    }
  }
};
