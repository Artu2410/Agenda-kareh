#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const env = { ...process.env };

if (process.platform === 'linux' && !env.PUPPETEER_CACHE_DIR) {
  env.PUPPETEER_CACHE_DIR = '/opt/render/.cache/puppeteer';
}

console.log('Installing Puppeteer Chrome using cache dir:', env.PUPPETEER_CACHE_DIR || '<default>');

const result = spawnSync(npxCommand, ['puppeteer', 'install', 'chrome'], {
  stdio: 'inherit',
  env,
});

if (result.status !== 0) {
  throw new Error(`puppeteer install chrome failed with exit code ${result.status ?? 1}`);
}
