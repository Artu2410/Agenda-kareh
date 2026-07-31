#!/usr/bin/env node
import { existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import puppeteer from 'puppeteer';

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const env = { ...process.env };

if (env.PUPPETEER_SKIP_DOWNLOAD || env.PUPPETEER_SKIP_CHROME_DOWNLOAD) {
  console.log('Skipping Puppeteer Chrome install because download is disabled by environment.');
  process.exit(0);
}

if (process.platform === 'linux' && !env.PUPPETEER_CACHE_DIR) {
  env.PUPPETEER_CACHE_DIR = '/opt/render/.cache/puppeteer';
}

if (env.PUPPETEER_CACHE_DIR) {
  mkdirSync(env.PUPPETEER_CACHE_DIR, { recursive: true });
}

const configuredExecutablePath = env.PUPPETEER_EXECUTABLE_PATH || env.CHROME_PATH;

if (configuredExecutablePath) {
  if (!existsSync(configuredExecutablePath)) {
    throw new Error(
      `Configured Chrome executable path does not exist: ${configuredExecutablePath}. ` +
      'Update PUPPETEER_EXECUTABLE_PATH/CHROME_PATH or remove it so Puppeteer can install Chrome.'
    );
  }

  console.log('Skipping Puppeteer Chrome install because a host browser is already configured:', configuredExecutablePath);
  process.exit(0);
}

let bundledExecutablePath = '';

try {
  bundledExecutablePath = puppeteer.executablePath();
} catch {
  bundledExecutablePath = '';
}

if (bundledExecutablePath && existsSync(bundledExecutablePath)) {
  console.log('Skipping Puppeteer Chrome install because Chrome is already available at:', bundledExecutablePath);
  process.exit(0);
}

console.log('Installing Puppeteer Chrome using cache dir:', env.PUPPETEER_CACHE_DIR || '<default>');

const result = spawnSync(npxCommand, ['puppeteer', 'browsers', 'install', 'chrome'], {
  stdio: 'inherit',
  env,
});

if (result.status !== 0) {
  const details = [
    `puppeteer browsers install chrome failed with exit code ${result.status ?? 1}.`,
    result.error ? `Spawn error: ${result.error.message}.` : '',
    `Platform: ${process.platform}.`,
    `Cache dir: ${env.PUPPETEER_CACHE_DIR || '<default>'}.`,
    'If this environment already has Chrome, set PUPPETEER_EXECUTABLE_PATH or CHROME_PATH.',
    'If the browser should not be downloaded here, set PUPPETEER_SKIP_DOWNLOAD=1.',
  ]
    .filter(Boolean)
    .join(' ');

  throw new Error(details);
}

