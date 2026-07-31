import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCAN_DIRS = [
  path.resolve(__dirname, '../data'),
];
const IGNORED_DIRS = new Set(['node_modules', 'coverage', '.git', 'logs', 'private']);
const COMMON_PATTERNS = [
  /ARANCEL/i,
  /AUTORIZACION/i,
  /VIGENCIA/i,
  /CONTRATO/i,
  /COBERTURA_PRIVADA/i,
  /COKIBA/i,
  /OSDE/i,
  /PAMI/i,
];
const DOLLAR_PATTERN = /\$/m;

const shouldIgnore = (relativePath) => {
  const parts = relativePath.split(/[\\/]/);
  return parts.some((part) => IGNORED_DIRS.has(part) || part.startsWith('.'));
};

const scanFile = async (filePath) => {
  const content = await fs.readFile(filePath, 'utf8');
  const violations = [];

  COMMON_PATTERNS.forEach((pattern) => {
    if (pattern.test(content)) {
      violations.push(pattern.source);
    }
  });

  if (DOLLAR_PATTERN.test(content) && /\.(md|txt|json)$/i.test(filePath)) {
    violations.push('$');
  }

  return violations;
};

const walk = async (dir, rootDir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(rootDir, fullPath);

    if (shouldIgnore(relativePath)) continue;
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath, rootDir));
      continue;
    }

    if (/\.(js|json|md|txt)$/i.test(entry.name)) {
      files.push(relativePath);
    }
  }

  return files;
};

const main = async () => {
  const violations = [];

  for (const scanDir of SCAN_DIRS) {
    const files = await walk(scanDir, scanDir);

    for (const relativePath of files) {
      const fullPath = path.join(scanDir, relativePath);
      const fileViolations = await scanFile(fullPath);
      if (fileViolations.length > 0) {
        violations.push({ file: path.join(path.relative(path.resolve(__dirname, '..'), scanDir), relativePath), patterns: fileViolations });
      }
    }
  }

  if (violations.length > 0) {
    console.error('Compliance check failed: se detectaron patrones prohibidos en archivos públicos.');
    violations.forEach(({ file, patterns }) => {
      console.error(`- ${file}: ${patterns.join(', ')}`);
    });
    process.exit(1);
  }

  console.log('Compliance check passed: no se encontraron patrones prohibidos en archivos públicos.');
};

main().catch((error) => {
  console.error('Error ejecutando compliance-check:', error.message);
  process.exit(1);
});
