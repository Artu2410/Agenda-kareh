import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const coverageSummaryPath = resolve(__dirname, '../coverage/coverage-summary.json');
const minimumLines = 55;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

try {
  const raw = await readFile(coverageSummaryPath, 'utf8');
  const summary = JSON.parse(raw);
  const lines = Number(summary?.total?.lines?.pct || 0);

  if (!Number.isFinite(lines)) {
    fail('No se pudo leer la cobertura de líneas.');
  }

  if (lines < minimumLines) {
    fail(`Cobertura de líneas insuficiente: ${lines}% < ${minimumLines}%`);
  }

  console.log(`Cobertura de líneas OK: ${lines}% >= ${minimumLines}%`);
} catch (error) {
  fail(`No se pudo validar la cobertura: ${error.message}`);
}
