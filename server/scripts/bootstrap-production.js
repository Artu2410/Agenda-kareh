import { spawnSync } from 'node:child_process';

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const runOrThrow = (args, label) => {
  const result = spawnSync(npxCommand, args, {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 1}`);
  }
};

const shouldPreparePrisma =
  process.env.SKIP_PRISMA_BOOTSTRAP !== 'true' &&
  Boolean(process.env.DATABASE_URL);

try {
  if (shouldPreparePrisma) {
    console.log('Prisma bootstrap: generating client');
    runOrThrow(['prisma', 'generate'], 'prisma generate');

    console.log('Prisma bootstrap: applying migrations');
    runOrThrow(['prisma', 'migrate', 'deploy'], 'prisma migrate deploy');
  }

  await import('../server.js');
} catch (error) {
  console.error('Prisma bootstrap failed:', error.message);
  process.exit(1);
}
