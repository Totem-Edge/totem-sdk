#!/usr/bin/env node
/**
 * One-shot mechanical workspace reconciliation (Phase 1):
 *  - Convert internal @totemsdk/* dependency ranges to workspace:^ protocol
 *  - Remove --passWithNoTests from test scripts
 *  - Normalize "node ../../node_modules/jest/bin/jest.js --config jest.config.cjs"
 *    invocation style to "jest" (the root jest bin is resolved via workspace)
 *
 * Safe, deterministic, idempotent. Only touches package.json "dependencies",
 * "devDependencies", "peerDependencies", "optionalDependencies" for names that
 * exist elsewhere in the pnpm workspace, plus the "scripts" block.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const workspaceDirs = [];
for (const top of ['packages', 'extensions']) {
  for (const d of readdirSync(join(ROOT, top))) {
    const pj = join(ROOT, top, d, 'package.json');
    if (existsSync(pj)) workspaceDirs.push({ dir: `${top}/${d}`, path: pj });
  }
}
const workspaceNames = new Set(
  workspaceDirs.map(({ path }) => JSON.parse(readFileSync(path, 'utf8')).name).filter(Boolean),
);

let changed = 0;
for (const { dir, path } of workspaceDirs) {
  const m = JSON.parse(readFileSync(path, 'utf8'));
  let dirty = false;
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const deps = m[section];
    if (!deps) continue;
    for (const [name, range] of Object.entries(deps)) {
      if (workspaceNames.has(name) && typeof range === 'string' && !range.startsWith('workspace:') && range !== '*') {
        deps[name] = 'workspace:^';
        dirty = true;
      }
    }
  }
  const scripts = m.scripts ?? {};
  for (const [k, v] of Object.entries(scripts)) {
    if (typeof v !== 'string') continue;
    const cleaned = v
      .replace(/\s*--passWithNoTests/g, '')
      .replace(/\s*--no-coverage/g, '')
      .replace(/node (\.\.\/)*\.\.\/node_modules\/jest\/bin\/jest\.js --config [\w./-]+/g, 'jest')
      .replace(/node --experimental-vm-modules (\.\.\/)*node_modules\/jest\/bin\/jest\.js/g, 'jest')
      .replace(/node --experimental-vm-modules node_modules\/jest\/bin\/jest\.js/g, 'jest');
    if (cleaned !== v) { scripts[k] = cleaned; dirty = true; }
  }
  if (dirty) {
    writeFileSync(path, JSON.stringify(m, null, 2) + '\n');
    changed += 1;
    process.stdout.write(`updated ${dir}\n`);
  }
}
process.stdout.write(`\nReconciled ${changed} package manifests\n`);
