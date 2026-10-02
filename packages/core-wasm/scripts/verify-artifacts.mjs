#!/usr/bin/env node
/**
 * RFC-031 P3 — verify the WASM artifact hash manifest (Gate G3).
 *
 * Fails if any committed wasm's SHA-256 differs from `artifacts.json`, or if the
 * recorded wasm-bindgen version differs from Cargo.lock, or if the three targets
 * do not share one wasm core. Run in CI after a build:
 *
 *   node scripts/verify-artifacts.mjs
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'artifacts.json'), 'utf8'));

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const failures = [];

for (const [rel, expected] of Object.entries(manifest.artifacts)) {
  const actual = sha256(join(root, rel));
  if (actual !== expected) {
    failures.push(`${rel}: ${actual} != ${expected}`);
  }
}

const cargoLock = readFileSync(join(root, 'Cargo.lock'), 'utf8');
const wasmBindgen = /name = "wasm-bindgen"\nversion = "([^"]+)"/.exec(cargoLock)?.[1];
if (wasmBindgen && wasmBindgen !== manifest.wasmBindgen) {
  failures.push(`wasm-bindgen ${wasmBindgen} != manifest ${manifest.wasmBindgen}`);
}

const hashes = Object.values(manifest.artifacts);
if (new Set(hashes).size !== 1) {
  failures.push(`target wasm hashes differ: ${[...new Set(hashes)].join(', ')}`);
}

if (failures.length > 0) {
  console.error('WASM artifact provenance FAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  `WASM artifact provenance OK: ${Object.keys(manifest.artifacts).length} artifacts, ` +
    `wasm-bindgen ${manifest.wasmBindgen}, rustc ${manifest.rustc}`,
);
