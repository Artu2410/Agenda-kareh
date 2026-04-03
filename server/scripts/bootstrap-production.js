import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';

dotenv.config();

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const buildPrismaEnv = () => {
  const nextEnv = { ...process.env };
  const databaseUrl = String(nextEnv.DATABASE_URL || '').trim();
  const directUrl = String(nextEnv.DIRECT_URL || '').trim();

  if (directUrl || !databaseUrl) {
    return nextEnv;
  }

  try {
    const parsed = new URL(databaseUrl);
    if (parsed.hostname.includes('-pooler.')) {
      parsed.hostname = parsed.hostname.replace('-pooler.', '.');
      nextEnv.DIRECT_URL = parsed.toString();
      return nextEnv;
    }
  } catch (error) {
    console.warn('Prisma bootstrap: no se pudo interpretar DATABASE_URL para derivar DIRECT_URL.', error.message);
  }

  nextEnv.DIRECT_URL = databaseUrl;
  return nextEnv;
};

const prismaEnv = buildPrismaEnv();
process.env.DIRECT_URL = prismaEnv.DIRECT_URL;

const runOrThrow = (args, label) => {
  const result = spawnSync(npxCommand, args, {
    stdio: 'inherit',
    env: prismaEnv,
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
    if (process.env.DIRECT_URL && process.env.DIRECT_URL !== process.env.DATABASE_URL) {
      console.log('Prisma bootstrap: using DIRECT_URL for CLI commands');
    }

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
