#!/usr/bin/env node
/**
 * Verify clean consumer installs for every publishable package.
 *
 * Iterates scripts/workspace-gates.config.json and runs
 * scripts/verify-consumer-pack.mjs against each publishable package, so the
 * PR CI pack gate exercises real `pnpm pack` → `npm install` from the tarball
 * instead of only `npm pack --dry-run`.
 *
 * Usage:
 *   node scripts/verify-consumer-pack-all.mjs
 *
 * Exit code is non-zero if any publishable package fails its consumer check.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const config = JSON.parse(readFileSync(join(__dirname, 'workspace-gates.config.json'), 'utf8'));
const publishable = Object.entries(config.packages).filter(([, v]) => v.status === 'publishable');

let failures = 0;
for (const [dir] of publishable) {
  const script = join(__dirname, 'verify-consumer-pack.mjs');
  const pkgDir = join(ROOT, dir);
  const result = spawnSync(process.execPath, [script, pkgDir], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  const ok = result.status === 0;
  if (!ok) failures += 1;
  process.stdout.write(ok ? `ok: consumer pack ${dir}\n` : `FAIL: consumer pack ${dir}\n`);
}

if (failures > 0) {
  process.stderr.write(`Consumer pack verification failed for ${failures} package(s)\n`);
  process.exit(1);
}
process.stdout.write(`Consumer pack verification passed for ${publishable.length} package(s)\n`);
