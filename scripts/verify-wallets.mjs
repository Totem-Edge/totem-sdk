#!/usr/bin/env node
/**
 * Wallet verification gate (RFC-013 §16/P6).
 *
 * The two wallet implementations live under `extensions/*` and are intentionally
 * excluded from the package-level Jest roots. This script gives them an explicit,
 * CI-runnable gate:
 *
 *   1. Extension self-hosted mode unit tests (jsdom Jest project).
 *   2. PWA TypeScript typecheck (its tsconfig is `noEmit`).
 *   3. Self-hosted safety policy checks (RFC-013 §11):
 *        - the extension's *required* host permissions stay Axia-scoped
 *          (no `<all_urls>` / http(s) wildcards);
 *        - self-hosted hosts are only reachable via optional permissions;
 *        - the PWA CSP `connect-src` carries no bare wildcard.
 *   4. Presence of the self-hosted config/consent seams in both wallets.
 *
 * Usage:
 *   node scripts/verify-wallets.mjs            # check only
 *   node scripts/verify-wallets.mjs --skip-tests
 *   node scripts/verify-wallets.mjs --skip-pwa
 */

import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const EXT = join(ROOT, 'extensions/totem-extension');
const PWA = join(ROOT, 'extensions/totem-pwa-wallet');

const args = process.argv.slice(2);
const skipTests = args.includes('--skip-tests');
const skipPwa = args.includes('--skip-pwa');

const failures = [];
function fail(label) {
  failures.push(label);
  console.error(`  FAIL  ${label}`);
}
function ok(label) {
  console.log(`  ok    ${label}`);
}
function run(cwd, cmd, label) {
  const r = spawnSync(cmd, { cwd, shell: true, encoding: 'utf8' });
  if (r.status === 0) {
    ok(label);
    return true;
  }
  fail(`${label}\n${(r.stdout + r.stderr).slice(-3000)}`);
  return false;
}

// ── 1. Extension typecheck + self-hosted tests ─────────────────────────────
console.log('── extension: typecheck ───────────────────────────────────');
run(EXT, 'npx tsc --noEmit -p tsconfig.json', 'extension typecheck');

if (!skipTests) {
  console.log('\n── extension: unit tests ──────────────────────────────────');
  run(EXT, 'npm run test:unit', 'extension unit tests');

  console.log('\n── extension: self-hosted + connect-runtime tests ────────');
  const extTests = ['test/self-hosted.test.ts', 'test/connect-runtime.test.ts'].filter((f) =>
    existsSync(join(EXT, f)),
  );
  if (extTests.length > 0) {
    run(EXT, `npx jest ${extTests.join(' ')} --reporters=default`, 'extension self-hosted + connect-runtime tests');
  } else {
    fail('extension self-hosted test missing');
  }
}

// ── 2. PWA typecheck ───────────────────────────────────────────────────────
if (!skipPwa) {
  console.log('\n── pwa: typecheck ─────────────────────────────────────────');
  run(PWA, 'npx tsc --noEmit -p tsconfig.json', 'pwa typecheck');
}

// ── 2b. Shared connect wallet runtime conformance (RFC-014) ────────────────
console.log('\n── shared connect wallet runtime ──────────────────────────');
run(join(ROOT, 'packages/connect'), 'npx jest src/__tests__/wallet.test.ts --reporters=default', 'connect/wallet conformance');

// ── 3. Manifest / CSP policy ───────────────────────────────────────────────
console.log('\n── self-hosted safety policy ─────────────────────────────');
const manifestPath = join(EXT, 'manifest.json');
if (!existsSync(manifestPath)) {
  fail('extension manifest.json missing');
} else {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const required = manifest.host_permissions ?? [];
  const isBroad = (p) => {
    if (p === '<all_urls>') return true;
    const m = /^(\*|https?|wss?):\/\/([^/]*)\//.exec(p);
    if (!m) return p.includes('*');
    const host = m[2];
    return host === '*' || host.includes('*');
  };
  const broad = required.filter(isBroad);
  if (broad.length === 0) {
    ok('extension required host_permissions are Axia-scoped (no wildcards)');
  } else {
    fail(`extension required host_permissions contain wildcards: ${broad.join(', ')}`);
  }
  const optional = manifest.optional_host_permissions ?? [];
  if (optional.length > 0) {
    ok('extension exposes optional_host_permissions for consented self-hosted nodes');
  } else {
    fail('extension has no optional_host_permissions for self-hosted nodes');
  }
}

const headersPath = join(PWA, 'public/_headers');
if (existsSync(headersPath)) {
  const headers = readFileSync(headersPath, 'utf8');
  const connect = headers.split('\n').find((l) => l.includes('connect-src')) ?? '';
  if (/connect-src[^;]*\s\*(\s|;|$)/.test(connect)) {
    fail('pwa CSP connect-src contains a bare wildcard');
  } else {
    ok('pwa CSP connect-src has no bare wildcard');
  }
}

// ── 4. Self-hosted seams present ───────────────────────────────────────────
console.log('\n── self-hosted seams ──────────────────────────────────────');
const seams = [
  join(EXT, 'src/core/config/selfHosted.ts'),
  join(EXT, 'src/core/security/consentRegistry.ts'),
];
for (const seam of seams) {
  if (existsSync(seam)) ok(`present: ${seam.replace(ROOT + '/', '')}`);
  else fail(`missing: ${seam.replace(ROOT + '/', '')}`);
}
if (!skipPwa) {
  const pwaSeam = join(PWA, 'src/core/config/selfHosted.ts');
  if (existsSync(pwaSeam)) ok('present: extensions/totem-pwa-wallet/src/core/config/selfHosted.ts');
  else fail('missing: extensions/totem-pwa-wallet/src/core/config/selfHosted.ts');
}

console.log('');
if (failures.length === 0) {
  console.log('Wallet gate: all checks passed');
  process.exit(0);
}
console.error(`Wallet gate: ${failures.length} check(s) failed`);
process.exit(1);
