import { spawnSync } from 'node:child_process';

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const run = (args, { capture = false } = {}) => spawnSync(npxCommand, args, {
  stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  env: process.env,
  encoding: 'utf8',
});

const runOrThrow = (args, label) => {
  const result = run(args);
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 1}`);
  }
};

const shouldPreparePrisma =
  process.env.SKIP_PRISMA_BOOTSTRAP !== 'true' &&
  Boolean(process.env.DATABASE_URL);

// Aplicar migraciones al arrancar es cómodo pero riesgoso: una migración defectuosa
// llega directo a la base real. Recomendado: RUN_MIGRATIONS_ON_START=false y correr
// `npm run prisma:migrate:deploy --workspace server` como paso previo al deploy,
// después de confirmar un backup/punto de restauración de Neon (ver README).
const shouldMigrateOnStart = process.env.RUN_MIGRATIONS_ON_START !== 'false';

try {
  if (shouldPreparePrisma) {
    console.log('Prisma bootstrap: generating client');
    runOrThrow(['prisma', 'generate'], 'prisma generate');

    const status = run(['prisma', 'migrate', 'status'], { capture: true });
    const statusOutput = `${status.stdout || ''}${status.stderr || ''}`.trim();
    const hasPending = status.status !== 0;
    console.log(`Prisma bootstrap: migrate status\n${statusOutput}`);

    if (hasPending && shouldMigrateOnStart) {
      console.log('Prisma bootstrap: applying pending migrations (RUN_MIGRATIONS_ON_START != false)');
      runOrThrow(['prisma', 'migrate', 'deploy'], 'prisma migrate deploy');
    } else if (hasPending) {
      console.warn('Prisma bootstrap: hay migraciones pendientes y RUN_MIGRATIONS_ON_START=false; no se aplican. Corré el paso de migración antes de este deploy.');
    }
  }

  await import('../server.js');
} catch (error) {
  console.error('Prisma bootstrap failed:', error.message);
  process.exit(1);
}
