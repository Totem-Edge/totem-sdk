/**
 * Entry point for `npm run test:bare` / `node src/__tests__/bare/run-bare.mjs`.
 *
 * Builds TypeScript source to dist/, then runs each bare-test file via
 * plain Node.js, acting as a CI proxy for the Bare runtime.
 *
 * When `bare` is installed the individual files can be run directly:
 *   bare src/__tests__/bare/storage.bare.mjs
 *   bare src/__tests__/bare/lifecycle.bare.mjs
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkgRoot = resolve(__dirname, '../../..');

// ── 1. Compile TypeScript (skip if dist/ is already up to date) ──────────────
function findTsc() {
  const candidates = [
    join(pkgRoot, 'node_modules/.bin/tsc'),
    join(pkgRoot, '../../node_modules/.bin/tsc'),       // totem-sdk root
    join(pkgRoot, '../../../../node_modules/.bin/tsc'),  // workspace root
    '/home/runner/workspace/node_modules/.bin/tsc',
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return 'tsc';
}

const tsc = findTsc();
console.log('Building TypeScript...');
try {
  execFileSync(tsc, ['--project', join(pkgRoot, 'tsconfig.json')], { stdio: 'inherit' });
} catch (e) {
  console.error('TypeScript build failed:', e.message);
  process.exitCode = 1;
  process.exit();
}
console.log('Build complete.\n');

// ── 2. Run each bare test file via plain Node.js ──────────────────────────────
const files = [
  join(__dirname, 'storage.bare.mjs'),
  join(__dirname, 'lifecycle.bare.mjs'),
];

let failed = 0;
for (const f of files) {
  console.log(`\n--- ${f} ---`);
  try {
    execFileSync(process.execPath, [f], { stdio: 'inherit' });
  } catch {
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} bare test file(s) failed`);
  process.exitCode = 1;
} else {
  console.log('\nAll bare tests passed.');
}
