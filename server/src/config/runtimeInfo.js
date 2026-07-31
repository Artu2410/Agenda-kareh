import fs from 'node:fs';
import path from 'node:path';

const UNKNOWN_VALUE = 'unknown';
const packageJsonPath = path.resolve(process.cwd(), 'package.json');

let cachedPackageVersion = UNKNOWN_VALUE;

try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  cachedPackageVersion = typeof packageJson.version === 'string' && packageJson.version.trim()
    ? packageJson.version.trim()
    : UNKNOWN_VALUE;
} catch {
  cachedPackageVersion = UNKNOWN_VALUE;
}

const getFirstNonEmptyValue = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return UNKNOWN_VALUE;
};

export const getRuntimeVersionInfo = ({ deployedAt } = {}) => ({
  version: getFirstNonEmptyValue(
    process.env.APP_VERSION,
    process.env.npm_package_version,
    cachedPackageVersion,
  ),
  commit: getFirstNonEmptyValue(
    process.env.COMMIT_SHA,
    process.env.RENDER_GIT_COMMIT,
    process.env.VERCEL_GIT_COMMIT_SHA,
  ),
  environment: getFirstNonEmptyValue(process.env.NODE_ENV, 'development'),
  deployedAt: getFirstNonEmptyValue(
    process.env.DEPLOYED_AT,
    process.env.RENDER_DEPLOY_TIMESTAMP,
    deployedAt,
  ),
});

export const getStartupMetadata = (port, startedAt = new Date().toISOString()) => ({
  ...getRuntimeVersionInfo({ deployedAt: startedAt }),
  startedAt,
  port: Number(port) || Number(process.env.PORT) || 0,
});
