#!/usr/bin/env node
/**
 * SDK_MANIFEST verification gate.
 *
 * SDK_MANIFEST.json is the machine-readable catalog for the docs site and AI
 * tools. This gate keeps its machine-checkable fields (name, version, export
 * subpaths, @totemsdk/* dependency coverage) in sync with the real
 * package.jsons, so version bumps and new subpath exports can never drift
 * silently.
 *
 * Usage:
 *   node scripts/verify-sdk-manifest.mjs           # check only (exit 1 on drift)
 *   node scripts/verify-sdk-manifest.mjs --write   # repair drift in place, then re-check
 *
 * Curated fields (description, domain, keywords, exportsDescription, and any
 * non-@totemsdk/* dependencies) are always preserved; only the
 * machine-checkable fields are repaired.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MANIFEST_PATH = join(ROOT, 'SDK_MANIFEST.json');
const CONFIG_PATH = join(__dirname, 'workspace-gates.config.json');

const write = process.argv.includes('--write');
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));

// name -> on-disk package metadata (only classified workspace entries)
const byName = new Map();
for (const [dir, meta] of Object.entries(config.packages)) {
  const pj = join(ROOT, dir, 'package.json');
  if (!existsSync(pj)) continue;
  const pkg = JSON.parse(readFileSync(pj, 'utf8'));
  if (!pkg.name) continue;
  byName.set(pkg.name, { dir, meta, pkg });
}

const PUBLISHABLE = [...byName.values()].filter(({ meta }) => meta.status === 'publishable');
const entryByName = new Map(manifest.packages.map((entry) => [entry.name, entry]));

const errors = [];
let checked = 0;

function fail(msg) { errors.push(msg); }
function countCheck() { checked += 1; }

function sdkDeps(pkg) {
  const groups = [pkg.dependencies, pkg.peerDependencies, pkg.optionalDependencies];
  const out = new Set();
  for (const g of groups) {
    for (const name of Object.keys(g ?? {})) {
      if (name.startsWith('@totemsdk/')) out.add(name);
    }
  }
  return [...out].sort();
}

function exportKeys(pkg) {
  return pkg.exports ? Object.keys(pkg.exports).sort() : [];
}

function verify() {
  // 1. Completeness: every publishable package must have a manifest entry.
  for (const { dir, meta, pkg } of PUBLISHABLE) {
    if (!entryByName.has(pkg.name)) {
      fail(`${pkg.name} (${dir}): publishable but missing from SDK_MANIFEST.json`);
    }
  }

  // 2. Every manifest entry must map to a real, publishable workspace package.
  for (const entry of manifest.packages) {
    const found = byName.get(entry.name);
    if (!found) {
      fail(`${entry.name}: manifest entry has no matching workspace package`);
    } else if (found.meta.status !== 'publishable') {
      fail(`${entry.name}: manifest entry is not classified publishable (${found.dir})`);
    }
  }

  // 3-5. Field-level drift for entries that resolve.
  for (const entry of manifest.packages) {
    const found = byName.get(entry.name);
    if (!found || found.meta.status !== 'publishable') continue;
    const { dir, pkg } = found;
    const label = `${pkg.name} (${dir})`;

    countCheck();
    if (entry.version !== pkg.version) {
      fail(`${label}: version ${entry.version} ≠ package.json ${pkg.version}`);
    }
    const wantExports = exportKeys(pkg);
    const gotExports = entry.exports ? Object.keys(entry.exports).sort() : [];
    if (wantExports.length > 0 && JSON.stringify(wantExports) !== JSON.stringify(gotExports)) {
      fail(`${label}: export subpaths differ — package=[${wantExports.join(',')}] manifest=[${gotExports.join(',')}]`);
    }
    const wantDeps = sdkDeps(pkg);
    const gotDeps = Object.keys(entry.dependencies ?? {}).filter((name) => name.startsWith('@totemsdk/')).sort();
    if (JSON.stringify(wantDeps) !== JSON.stringify(gotDeps)) {
      fail(`${label}: @totemsdk/* deps differ — package=[${wantDeps.join(',')}] manifest=[${gotDeps.join(',')}]`);
    }
  }
}

function repair() {
  for (const entry of manifest.packages) {
    const found = byName.get(entry.name);
    if (!found || found.meta.status !== 'publishable') continue;
    const { pkg } = found;

    entry.name = pkg.name;
    entry.version = pkg.version;

    const wantExports = exportKeys(pkg);
    if (wantExports.length > 0) {
      entry.exports = Object.fromEntries(wantExports.map((key) => [key, entry.exports?.[key] ?? pkg.exports[key]]));
    } else {
      entry.exports = {};
    }

    const wantDeps = sdkDeps(pkg);
    const repairedDeps = { ...(entry.dependencies ?? {}) };
    for (const key of Object.keys(repairedDeps)) {
      if (key.startsWith('@totemsdk/')) delete repairedDeps[key];
    }
    for (const name of wantDeps) {
      repairedDeps[name] = `^${byName.get(name)?.pkg.version ?? ''}`;
    }
    entry.dependencies = repairedDeps;
  }
}

verify();
if (errors.length > 0 && write) {
  const before = errors.length;
  repair();
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Repaired ${before} drift(s) in SDK_MANIFEST.json`);
  errors.length = 0;
  checked = 0;
  verify();
}

for (const msg of errors) console.error(`✗ ${msg}`);
if (errors.length === 0) {
  console.log(`SDK_MANIFEST gate: ${checked} entries in sync with package.json`);
  process.exit(0);
} else {
  console.error(`SDK_MANIFEST gate: ${checked - errors.length}/${checked} entries in sync, ${errors.length} drift(s)`);
  process.exit(1);
}