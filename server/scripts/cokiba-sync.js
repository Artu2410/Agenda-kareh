#!/usr/bin/env node
// ---------------------------------------------------------
// COKIBA → Obras Sociales · Scraper + Sync con Prisma
// ---------------------------------------------------------
// Uso:  node scripts/cokiba-sync.js
// Env:  COKIBA_DNI, COKIBA_CLAVE  (ver .env.example)
// ---------------------------------------------------------

import 'dotenv/config';
import puppeteer from 'puppeteer';
import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------
// 0. CONFIGURACIÓN
// ---------------------------------------------------------
const COKIBA_LOGIN_URL = 'https://autogestion.cokiba.org.ar/web/?q=login';
const COKIBA_OS_URL    = 'https://autogestion.cokiba.org.ar/web/?q=form_os';

const COKIBA_DNI   = process.env.COKIBA_DNI;
const COKIBA_CLAVE = process.env.COKIBA_CLAVE;

// Plazo de pago por defecto (configurable vía env)
const DEFAULT_PLAZO_PAGO = parseInt(process.env.COKIBA_PLAZO_PAGO || '60', 10);

// Estados a filtrar (ignorar estas obras sociales)
const ESTADOS_EXCLUIDOS = ['baja', 'suspendida', 'falta de pago'];

// Lista blanca de obras sociales atendibles en San Miguel / Bella Vista
// El usuario puede editar esta lista con los nombres exactos que aparecen en COKIBA
const WHITELIST_SAN_MIGUEL = [
  // Agregar aquí los nombres exactos de las OS atendibles en la zona
  // Ejemplo:
  // 'OSDE',
  // 'SWISS MEDICAL',
  // 'GALENO',
  // 'MEDICUS',
  // 'OMINT',
  // 'HOSPITAL ITALIANO',
  // 'UNION PERSONAL',
  // 'OSPRERA',
  // 'OSECAC',
  // 'OSDEPYM',
  // 'ACCORD SALUD',
  // 'MEDIFE',
  // 'SANCOR SALUD',
  // 'PAMI',
];

// ---------------------------------------------------------
// 1. VALIDAR CREDENCIALES
// ---------------------------------------------------------
function validarCredenciales() {
  if (!COKIBA_DNI || !COKIBA_CLAVE) {
    throw new Error(
      '❌ Faltan credenciales COKIBA. Configurá COKIBA_DNI y COKIBA_CLAVE en tu archivo .env'
    );
  }
}

// ---------------------------------------------------------
// 2. LOGIN EN COKIBA
// ---------------------------------------------------------
async function login(page) {
  console.log('🔐 Navegando al login de COKIBA...');
  await page.goto(COKIBA_LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30000 });

  // Esperar que cargue el formulario de login
  await page.waitForSelector('input[name="dni"], input[name="username"], input#edit-name', {
    timeout: 15000,
  });

  // COKIBA usa Drupal: los campos suelen ser #edit-name y #edit-pass
  // Intentamos ambos selectores por si el portal cambia
  const dniSelector = await page.$('input#edit-name')
    ? 'input#edit-name'
    : 'input[name="dni"]';

  const passSelector = await page.$('input#edit-pass')
    ? 'input#edit-pass'
    : 'input[name="clave"]';

  await page.type(dniSelector, COKIBA_DNI, { delay: 50 });
  await page.type(passSelector, COKIBA_CLAVE, { delay: 50 });

  console.log('🔑 Enviando credenciales...');

  // Buscar botón de submit
  const submitBtn = await page.$('input#edit-submit, button[type="submit"], input[type="submit"]');
  if (!submitBtn) throw new Error('❌ No se encontró el botón de login');

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
    submitBtn.click(),
  ]);

  // Verificar login exitoso: no debería seguir en la página de login
  const currentUrl = page.url();
  if (currentUrl.includes('q=login') || currentUrl.includes('user/login')) {
    throw new Error('❌ Login fallido. Verificá las credenciales COKIBA_DNI y COKIBA_CLAVE.');
  }

  console.log('✅ Login exitoso en COKIBA');
}

// ---------------------------------------------------------
// 3. LOGOUT (cerrar sesión para no bloquear el usuario)
// ---------------------------------------------------------
async function logout(page) {
  try {
    console.log('🚪 Cerrando sesión en COKIBA...');
    await page.goto('https://autogestion.cokiba.org.ar/web/?q=user/logout', {
      waitUntil: 'networkidle2',
      timeout: 15000,
    });
    console.log('✅ Sesión cerrada correctamente');
  } catch (err) {
    console.warn('⚠️ No se pudo cerrar sesión:', err.message);
  }
}

// ---------------------------------------------------------
// 4. SCRAPING DE OBRAS SOCIALES
// ---------------------------------------------------------
async function scrapearObrasSociales(page) {
  console.log('📋 Navegando a la sección de Obras Sociales...');
  await page.goto(COKIBA_OS_URL, { waitUntil: 'networkidle2', timeout: 30000 });

  // Esperar que la tabla principal cargue
  await page.waitForSelector('table', { timeout: 15000 });

  console.log('🔍 Extrayendo datos de la tabla...');

  // Extraer toda la data de la tabla desde el contexto del navegador
  const rawData = await page.evaluate(() => {
    const rows = [];
    const tables = document.querySelectorAll('table');

    for (const table of tables) {
      const trs = table.querySelectorAll('tbody tr, tr');
      for (const tr of trs) {
        const cells = tr.querySelectorAll('td, th');
        if (cells.length < 2) continue;

        const rowData = Array.from(cells).map((td) => td.innerText.trim());
        rows.push(rowData);
      }
    }

    return rows;
  });

  console.log(`📊 Se encontraron ${rawData.length} filas en la tabla`);
  return rawData;
}

// ---------------------------------------------------------
// 5. PARSEAR Y TRANSFORMAR DATOS
// ---------------------------------------------------------
function parsearDatos(rawRows) {
  const obrasSociales = [];

  for (const row of rawRows) {
    // Necesitamos al menos: código, nombre, categoría, honorario, coseguro
    // La estructura exacta puede variar; hacemos best-effort parsing
    if (row.length < 3) continue;

    // Buscar si alguna celda contiene un estado excluido
    const textoCompleto = row.join(' ').toLowerCase();
    const estaExcluida = ESTADOS_EXCLUIDOS.some((estado) =>
      textoCompleto.includes(estado)
    );

    if (estaExcluida) {
      console.log(`  ⏭️  Ignorada (estado excluido): ${row[0] || row[1]}`);
      continue;
    }

    // Intentar extraer campos — el layout típico de COKIBA es:
    // [código, nombre, plan/categoría, honorario, coseguro, ...]
    // Ajustar índices según la estructura real del portal
    const codigo = extraerCodigo(row);
    const nombre = extraerNombre(row);
    const categoria = extraerCategoria(row);
    const honorario = extraerMonto(row, 'honorario');
    const coseguro = extraerMonto(row, 'coseguro');

    // Solo nos interesan las de Categoría Básica
    if (categoria && !categoria.toLowerCase().includes('básica') && !categoria.toLowerCase().includes('basica')) {
      continue;
    }

    if (!nombre || nombre.length < 2) continue;

    // Buscar zona en toda la fila o en el nombre
    const textoFila = row.join(' ').toUpperCase();
    const esAtendibleSanMiguel = 
      textoFila.includes('PROVINCIA DE BUENOS AIRES') ||
      textoFila.includes('SAN MIGUEL') ||
      textoFila.includes('BELLA VISTA') ||
      WHITELIST_SAN_MIGUEL.some((ws) => nombre.toUpperCase().includes(ws.toUpperCase()));

    obrasSociales.push({
      codigo_cokiba: codigo || generarCodigo(nombre),
      nombre_os: nombre,
      coseguro_valor: coseguro,
      honorario_estimado: honorario,
      plazo_pago: DEFAULT_PLAZO_PAGO,
      estado: 'Activa',
      atendible_san_miguel: esAtendibleSanMiguel,
      raw_categoria: categoria || 'Básica',
    });
  }

  console.log(`✅ ${obrasSociales.length} obras sociales activas extraídas`);
  return obrasSociales;
}

// Helpers de extracción
function extraerCodigo(row) {
  // El código suele ser la primera celda numérica o alfanumérica corta
  for (const cell of row) {
    if (/^\d{1,6}$/.test(cell.trim())) return cell.trim();
    if (/^[A-Z0-9]{2,10}$/i.test(cell.trim()) && cell.trim().length <= 10) return cell.trim();
  }
  return null;
}

function extraerNombre(row) {
  // El nombre suele ser la celda más larga que no sea número ni monto
  let mejor = '';
  for (const cell of row) {
    const limpia = cell.trim();
    if (/^\$?\s*[\d.,]+$/.test(limpia)) continue; // Es un monto
    if (/^\d{1,6}$/.test(limpia)) continue; // Es un código
    if (limpia.length > mejor.length) mejor = limpia;
  }
  return mejor;
}

function extraerCategoria(row) {
  const keywords = ['básica', 'basica', 'superior', 'premium', 'especial', 'categoría', 'categoria'];
  for (const cell of row) {
    if (keywords.some((kw) => cell.toLowerCase().includes(kw))) {
      return cell.trim();
    }
  }
  return null;
}

function extraerMonto(row, tipo) {
  // Buscar celdas con formato monetario: $1.234,56 o 1234.56
  const montos = [];
  for (const cell of row) {
    const limpio = cell.replace(/\$/g, '').replace(/\s/g, '').trim();
    // Formato argentino: 1.234,56 → convertir a 1234.56
    const match = limpio.match(/^[\d.]+,\d{2}$/);
    if (match) {
      const valor = parseFloat(limpio.replace(/\./g, '').replace(',', '.'));
      if (!isNaN(valor)) montos.push(valor);
    }
    // Formato decimal estándar: 1234.56
    const matchDec = limpio.match(/^\d+(\.\d{1,2})?$/);
    if (matchDec && !match) {
      const valor = parseFloat(limpio);
      if (!isNaN(valor) && valor > 0) montos.push(valor);
    }
  }

  // Heurística: el coseguro suele ser menor que el honorario
  if (montos.length === 0) return 0;
  if (montos.length === 1) return montos[0];

  montos.sort((a, b) => a - b);
  if (tipo === 'coseguro') return montos[0]; // El menor
  if (tipo === 'honorario') return montos[montos.length - 1]; // El mayor

  return montos[0];
}

function generarCodigo(nombre) {
  // Generar código a partir del nombre si no viene en la tabla
  return nombre
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 10)
    + '_' + Date.now().toString(36);
}

// ---------------------------------------------------------
// 6. SINCRONIZAR CON BASE DE DATOS (PRISMA UPSERT)
// ---------------------------------------------------------
async function sincronizarConDB(obrasSociales) {
  const prisma = new PrismaClient();

  try {
    console.log('💾 Sincronizando con la base de datos...');

    let creadas = 0;
    let actualizadas = 0;

    for (const os of obrasSociales) {
      const result = await prisma.obraSocial.upsert({
        where: { codigoCokiba: os.codigo_cokiba },
        update: {
          nombreOs:           os.nombre_os,
          coseguroValor:      os.coseguro_valor,
          honorarioEstimado:  os.honorario_estimado,
          plazoPago:          os.plazo_pago,
          estado:             os.estado,
          atendibleSanMiguel: os.atendible_san_miguel,
          rawCategoria:       os.raw_categoria,
          ultimaSync:         new Date(),
        },
        create: {
          codigoCokiba:       os.codigo_cokiba,
          nombreOs:           os.nombre_os,
          coseguroValor:      os.coseguro_valor,
          honorarioEstimado:  os.honorario_estimado,
          plazoPago:          os.plazo_pago,
          estado:             os.estado,
          atendibleSanMiguel: os.atendible_san_miguel,
          rawCategoria:       os.raw_categoria,
          ultimaSync:         new Date(),
        },
      });

      // Si el registro ya existía (tiene updatedAt != createdAt) cuenta como actualización
      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        creadas++;
      } else {
        actualizadas++;
      }
    }

    console.log(`✅ Sincronización completada: ${creadas} nuevas, ${actualizadas} actualizadas`);
    return { creadas, actualizadas, total: obrasSociales.length };
  } finally {
    await prisma.$disconnect();
  }
}

// ---------------------------------------------------------
// 7. EXPORTAR JSON A ARCHIVO (opcional, para debug)
// ---------------------------------------------------------
function exportarJSON(obrasSociales) {
  const output = JSON.stringify(obrasSociales, null, 2);
  const filename = `cokiba-sync-${new Date().toISOString().slice(0, 10)}.json`;
  const path = new URL(filename, import.meta.url);

  // Solo imprimir en consola para no ensuciar el proyecto
  console.log('\n📄 JSON resultante:');
  console.log(output);
  return obrasSociales;
}

// ---------------------------------------------------------
// 8. ORQUESTADOR PRINCIPAL
// ---------------------------------------------------------
async function main() {
  let browser = null;

  try {
    // Validar credenciales
    validarCredenciales();

    // Lanzar navegador
    console.log('🚀 Iniciando scraper COKIBA...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      defaultViewport: { width: 1280, height: 800 },
    });

    const page = await browser.newPage();

    // Configurar timeout y user-agent
    page.setDefaultNavigationTimeout(30000);
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // 1. Login
    await login(page);

    // 2. Scraping
    const rawRows = await scrapearObrasSociales(page);

    // 3. Logout (SIEMPRE antes de cerrar)
    await logout(page);

    // 4. Parsear y filtrar
    const obrasSociales = parsearDatos(rawRows);

    if (obrasSociales.length === 0) {
      console.warn('⚠️ No se encontraron obras sociales activas. Revisa el portal manualmente.');
      return;
    }

    // 5. Exportar JSON (debug)
    exportarJSON(obrasSociales);

    // 6. Sincronizar con DB
    const resultado = await sincronizarConDB(obrasSociales);

    console.log('\n🎉 Proceso completado exitosamente');
    console.log(`   📊 Total: ${resultado.total} | Nuevas: ${resultado.creadas} | Actualizadas: ${resultado.actualizadas}`);
  } catch (error) {
    console.error('\n❌ Error en el scraper COKIBA:', error.message);
    console.error(error.stack);
    process.exitCode = 1;
  } finally {
    // SIEMPRE cerrar el navegador para no bloquear el usuario
    if (browser) {
      try {
        await browser.close();
        console.log('🧹 Navegador cerrado correctamente');
      } catch (closeErr) {
        console.error('⚠️ Error cerrando navegador:', closeErr.message);
      }
    }
  }
}

// Ejecutar
main();
