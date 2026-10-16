#!/usr/bin/env node
/**
 * CAN-003 / CAN-008(a) — upstream publish guard.
 *
 * A dependent must never be released against a first-party workspace version
 * that is not on npm. That is the CAN-003 shape: omnia-host@0.5.0 was built
 * against a `manifest` whose TreeKey `signManifest` existed only in the repo,
 * while published `manifest@1.0.0` still shipped the old seed API.
 *
 * For every publishable package, every `@totemsdk/*` dependency/peer/optional
 * must resolve to a version that is actually published. Fails otherwise.
 *
 * Usage: node scripts/check-upstream-published.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(ROOT, 'scripts', 'workspace-gates.config.json'), 'utf8'));

const ws = {};
for (const [dir, meta] of Object.entries(config.packages)) {
  if (meta.status !== 'publishable') continue;
  const pj = join(ROOT, dir, 'package.json');
  if (!existsSync(pj)) continue;
  const p = JSON.parse(readFileSync(pj, 'utf8'));
  if (p.name) ws[p.name] = p.version;
}

const cache = new Map();
function isPublished(name, version) {
  const key = `${name}@${version}`;
  if (cache.has(key)) return cache.get(key);
  let ok = false;
  try { execFileSync('npm', ['view', key, 'version'], { stdio: 'ignore' }); ok = true; } catch { /* not published */ }
  cache.set(key, ok);
  return ok;
}

const issues = [];
let checked = 0;
for (const [dir, meta] of Object.entries(config.packages)) {
  if (meta.status !== 'publishable') continue;
  const pj = join(ROOT, dir, 'package.json');
  if (!existsSync(pj)) continue;
  const p = JSON.parse(readFileSync(pj, 'utf8'));
  const deps = new Set();
  for (const group of [p.dependencies, p.peerDependencies, p.optionalDependencies]) {
    for (const name of Object.keys(group ?? {})) {
      if (name.startsWith('@totemsdk/')) deps.add(name);
    }
  }
  for (const dep of deps) {
    const version = ws[dep];
    if (!version) continue;
    checked++;
    if (!isPublished(dep, version)) {
      issues.push(`${p.name} depends on ${dep}@${version}, which is not published`);
    }
  }
}

if (issues.length > 0) {
  console.error('✗ upstream publish drift (CAN-003/CAN-008a) — release the upstream package first:');
  for (const i of issues) console.error(`  - ${i}`);
  process.exit(1);
}
console.log(`upstream publish: ${checked} first-party dependency refs point at published versions.`);
