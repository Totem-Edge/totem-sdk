#!/usr/bin/env node
/**
 * CAN-008 (b) — flat whole-family install guard.
 *
 * Installs EVERY publishable @totemsdk package at its maturity dist-tag
 * (`latest` for v1, `next` for rc, `beta`, `alpha`) into one throwaway project
 * with default npm peer resolution (no `--legacy-peer-deps`, no overrides), so
 * any cross-package ERESOLVE (e.g. two packages demanding mutually exclusive
 * 0.x ranges of one dependency) fails the release instead of a consumer's
 * `npm install`. This is the SDK-side port of Canary scenario `00-install-smoke`.
 *
 * Usage: node scripts/check-family-install.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(ROOT, 'scripts', 'workspace-gates.config.json'), 'utf8'));

const EXPECTED_TAG = { v1: 'latest', rc: 'next', beta: 'beta', alpha: 'alpha' };

function readTags(name) {
  try {
    const out = execFileSync('npm', ['view', name, 'dist-tags', '--json'], {
      encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(out);
  } catch {
    return null;
  }
}

const entries = [];
for (const [dir, meta] of Object.entries(config.packages)) {
  if (meta.status !== 'publishable') continue;
  const pj = join(ROOT, dir, 'package.json');
  if (!existsSync(pj)) continue;
  const pkg = JSON.parse(readFileSync(pj, 'utf8'));
  if (!pkg.name) continue;
  const expected = EXPECTED_TAG[meta.maturity] ?? 'latest';
  const tags = readTags(pkg.name);
  const tag = tags?.[expected] ? expected : 'latest';
  entries.push({ name: pkg.name, tag });
}
entries.sort((a, b) => a.name.localeCompare(b.name));

if (entries.length === 0) {
  console.error('✗ no publishable packages found');
  process.exit(1);
}
const specs = entries.map((entry) => `${entry.name}@${entry.tag}`);

const dir = mkdtempSync(join(tmpdir(), 'totem-family-install-'));
try {
  execFileSync('npm', ['init', '-y'], { cwd: dir, stdio: 'ignore' });
  console.log(`family install: installing ${entries.length} packages at maturity tags (${entries.filter(e => e.tag !== 'latest').length} non-latest) …`);
  execFileSync('npm', ['install', '--no-audit', '--no-fund', ...specs], {
    cwd: dir,
    stdio: 'inherit',
    // Default peer resolution: do NOT set legacy-peer-deps.
    env: { ...process.env, npm_config_legacy_peer_deps: 'false' },
  });
  console.log(`family install: OK — ${entries.length} packages co-install with default peer resolution.`);
} catch {
  console.error('✗ family install FAILED — likely ERESOLVE across the published family.');
  process.exit(1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
