#!/usr/bin/env node
/**
 * RFC-031 P3 — write the WASM artifact hash manifest (provenance).
 *
 * Records the SHA-256 of each target's wasm plus the pinned toolchain versions,
 * so a rebuild can be checked byte-for-byte (Gate G3). Regenerate after a
 * deliberate rebuild:
 *
 *   node scripts/write-artifacts.mjs
 */

import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const targets = ['pkg', 'pkg-node', 'pkg-web'];
const wasmName = 'totemsdk_core_wasm_bg.wasm';

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function version(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const cargoLock = readFileSync(join(root, 'Cargo.lock'), 'utf8');
const wasmBindgen = /name = "wasm-bindgen"\nversion = "([^"]+)"/.exec(cargoLock)?.[1] ?? 'unknown';

const artifacts = {};
for (const target of targets) {
  const wasmPath = join(root, target, wasmName);
  if (!existsSync(wasmPath)) throw new Error(`missing artifact: ${target}/${wasmName}`);
  artifacts[`${target}/${wasmName}`] = sha256(wasmPath);
}

const manifest = {
  note: 'RFC-031 P3 WASM artifact provenance. Verify with: node scripts/verify-artifacts.mjs',
  rustc: version('rustc --version'),
  wasmPack: version('wasm-pack --version'),
  wasmBindgen,
  artifacts,
};

writeFileSync(join(root, 'artifacts.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`wrote artifacts.json: ${Object.keys(artifacts).length} artifacts, wasm-bindgen ${wasmBindgen}`);
