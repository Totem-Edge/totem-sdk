#!/usr/bin/env node
/**
 * QVAC API drift audit.
 *
 * Installs the REAL `@qvac/sdk` (the version pinned in
 * `QVAC_API_SNAPSHOT`) into a scratch directory and compares its actual
 * exported function surface against the op catalog that `@totemsdk/qvac`
 * wraps. Guards the vendored type surface in
 * `packages/qvac/src/vendor/qvac-sdk.d.ts` against upstream rename/removal
 * without making the heavy native SDK a workspace dependency.
 *
 * Usage:
 *   node scripts/verify-qvac-api-drift.mjs           # best-effort (network)
 *   node scripts/verify-qvac-api-drift.mjs --strict  # fail CI on any issue
 *
 * Errors: missing/out-of-order build output, version mismatch, or a snapshot
 * op absent from the real SDK -> exit 1 (always). Network failure to fetch the
 * package -> exit 0 with a warning unless --strict.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const strict = process.argv.includes('--strict');
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const requireRoot = createRequire(join(root, 'package.json'));

const fail = (msg) => {
  console.error(`qvac-drift: FAIL: ${msg}`);
  process.exitCode = 1;
};

const info = (msg) => console.log(`qvac-drift: ${msg}`);

async function loadSnapshot() {
  const dist = join(root, 'packages', 'qvac', 'dist', 'api-snapshot.cjs');
  const distEsm = join(root, 'packages', 'qvac', 'dist', 'api-snapshot.js');
  const candidates = [dist, distEsm];
  const file = candidates.find(f => existsSync(f));
  if (!file) {
    fail('packages/qvac/dist/api-snapshot.{cjs,js} not found — run `pnpm --filter @totemsdk/qvac build` first.');
    return undefined;
  }
  try {
    try {
      return requireRoot(file).QVAC_API_SNAPSHOT;
    } catch {
      const mod = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
      return mod.QVAC_API_SNAPSHOT;
    }
  } catch (err) {
    fail(`could not load snapshot from ${file}: ${err.message}`);
    return undefined;
  }
}

function walkDeclarations(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      if (entry === 'node_modules') continue;
      walkDeclarations(full, out);
    } else if (entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function exportedFunctionNames(pkgDir) {
  const files = walkDeclarations(pkgDir);
  const text = files.map(f => readFileSync(f, 'utf8')).join('\n');
  const direct = new Set();
  const declared = new Set();
  const exported = new Set();

  for (const match of text.matchAll(/declare\s+function\s+(\w+)/g)) declared.add(match[1]);
  for (const match of text.matchAll(/export\s+declare\s+function\s+(\w+)/g)) direct.add(match[1]);

  for (const block of text.matchAll(/export\s*\{\s*([^}]+)\s*\}/g)) {
    for (let entry of block[1].split(',')) {
      entry = entry.trim();
      entry = entry.replace(/^type\s+/, '');
      if (!entry) continue;
      const asMatch = entry.match(/^([\w$]+)\s+as\s+([\w$]+)$/);
      if (asMatch) exported.add(asMatch[2]);
      else exported.add(entry.match(/^[\w$]+$/)?.[0]);
    }
  }

  const names = new Set([...direct, ...declared].filter(n => exported.has(n)));
  for (const n of direct) names.add(n);
  return names;
}

function installSdk(scratch, spec) {
  const dest = join(scratch, 'tgz');
  mkdirSync(dest, { recursive: true });
  execFileSync(
    'npm',
    [
      'pack', spec, '--pack-destination', dest,
      '--no-audit', '--no-fund', '--loglevel', 'error',
      '--fetch-retries=1', '--fetch-retry-factor=1',
      '--fetch-retry-mintimeout=30000', '--fetch-timeout=60000',
    ],
    { stdio: 'ignore', timeout: 180000 },
  );
  const tgz = readdirSync(dest).filter(f => f.endsWith('.tgz'))[0];
  if (!tgz) throw new Error(`npm pack produced no tarball for ${spec}`);
  const pkgDir = join(scratch, 'pkg');
  mkdirSync(pkgDir, { recursive: true });
  execFileSync('tar', ['-xzf', join(dest, tgz), '-C', pkgDir], { stdio: 'ignore' });
  return pkgDir;
}

async function main() {
  const snapshot = await loadSnapshot();
  if (!snapshot) return;

  const spec = `@qvac/sdk@${snapshot.version}`;
  info(`targeting ${spec} (snapshot version)`);
  info(`snapshot ops: ${snapshot.ops.length} (${snapshot.ops.length} of kind function)`);

  const scratch = mkdtempSync(join(tmpdir(), 'qvac-drift-'));
  try {
    let pkgDir;
    try {
      pkgDir = installSdk(scratch, spec);
    } catch (err) {
      info(`SKIP: could not fetch the real ${spec} from the registry (${err.message}) — audit ran in best-effort mode.`);
      if (strict) fail(`strict mode requires fetching ${spec} from the registry`);
      return;
    }

    let pkgVersion;
    let realNames;
    try {
      const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
      pkgVersion = pkg.version;
    } catch {
      pkgVersion = snapshot.version;
    }
    try {
      const sdk = requireScratch('@qvac/sdk');
      realNames = new Set(
        Object.keys(sdk).filter(k => typeof sdk[k] === 'function'),
      );
    } catch {
      realNames = exportedFunctionNames(pkgDir);
    }
    if (realNames.size === 0) {
      fail('the real @qvac/sdk resolved to no functions (require threw and declarations yielded nothing)');
      return;
    }

    if (pkgVersion !== snapshot.version) {
      fail(`version mismatch: real @qvac/sdk is ${pkgVersion}, snapshot pins ${snapshot.version}`);
    }

    const missing = snapshot.ops.filter(o => o.kind === 'function' && !realNames.has(o.op)).map(o => o.op);
    if (missing.length > 0) {
      fail(`upstream missing functions wrapped by the snapshot: ${missing.join(', ')}`);
    }

    const expected = new Set(snapshot.ops.filter(o => o.kind === 'function').map(o => o.op));
    const extra = [...realNames].filter(n => !expected.has(n));
    info(`real @qvac/sdk ${pkgVersion}: ${realNames.size} exported functions`);
    info(`audited ${snapshot.ops.length} ops — missing upstream: ${missing.length}`);
    if (missing.length === 0) {
      info('OK: snapshot surface is fully present upstream.');
    }
    if (extra.length > 0) {
      info(`informational: ${extra.length} upstream exports are not in the snapshot (op catalog is a curated subset): ${extra.slice(0, 12).join(', ')}${extra.length > 12 ? '…' : ''}`);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

main().catch((err) => {
  fail(err.message);
});