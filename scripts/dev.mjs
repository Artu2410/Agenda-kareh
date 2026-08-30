import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [
  spawn(npmCommand, ['run', 'dev', '--workspace', 'client'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }),
  spawn(npmCommand, ['run', 'dev', '--workspace', 'server'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }),
];

let shuttingDown = false;

const shutdown = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  children.forEach((child) => child.kill('SIGINT'));
  setTimeout(() => process.exit(code), 250);
};

children.forEach((child) => {
  child.on('exit', (code) => {
    if (!shuttingDown && code && code !== 130) shutdown(code);
  });
  child.on('error', () => shutdown(1));
});

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
