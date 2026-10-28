#!/usr/bin/env node
/** Resolve a Bare binary (global, env, or pnpm platform package) and run a script. */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = process.argv[2];
if (!script) {
  console.error('usage: node scripts/run-bare.mjs <script> [args...]');
  process.exit(2);
}

function localBare() {
  const root = join(process.cwd(), 'node_modules', '.pnpm');
  if (!existsSync(root)) return null;
  const prefix = `bare-runtime-${process.platform}-${process.arch}@`;
  for (const entry of readdirSync(root)) {
    if (!entry.startsWith(prefix)) continue;
    const bin = join(root, entry, 'node_modules', `bare-runtime-${process.platform}-${process.arch}`, 'bin', 'bare');
    if (existsSync(bin)) return bin;
  }
  return null;
}

const binary = process.env.BARE_BIN || localBare() || 'bare';
const result = spawnSync(binary, process.argv.slice(2), { stdio: 'inherit' });
if (result.error) {
  console.error(`[bare] unable to run ${binary}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
