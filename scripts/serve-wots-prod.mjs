#!/usr/bin/env node
// Start API server in production mode (no dev flags)
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiDir = join(__dirname, '..', 'packages', 'axia-api');

console.log('Starting API server in production mode...');
console.log('No WOTS_DEV_FINALIZE_SIG flag - full transaction hex required');

const server = spawn('npm', ['run', 'prod'], {
  cwd: apiDir,
  env: {
    ...process.env,
    PORT: process.env.PORT || '5000',
    // Explicitly NOT setting WOTS_DEV_FINALIZE_SIG
  },
  stdio: 'inherit'
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

process.on('SIGINT', () => {
  server.kill('SIGINT');
  process.exit(0);
});