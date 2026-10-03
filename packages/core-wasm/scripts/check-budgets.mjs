#!/usr/bin/env node
/**
 * RFC-031 G4 — edge bundle-size / cold-start budget gate.
 *
 * Fails when the portable (`pkg-web`) wasm exceeds the size budgets in
 * `budgets.json`; reports (does not fail on) async init time, since CI timing is
 * noisy. Run:
 *
 *   node scripts/check-budgets.mjs
 */

import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const budgets = JSON.parse(readFileSync(join(root, 'budgets.json'), 'utf8'));
const wasmPath = join(root, 'pkg-web', 'totemsdk_core_wasm_bg.wasm');
const bytes = readFileSync(wasmPath);
const gzip = gzipSync(bytes).length;

const failures = [];
if (bytes.length > budgets.wasmBytes) {
  failures.push(`wasm ${bytes.length}B > budget ${budgets.wasmBytes}B`);
}
if (gzip > budgets.wasmGzipBytes) {
  failures.push(`wasm gzip ${gzip}B > budget ${budgets.wasmGzipBytes}B`);
}

// Cold start (informational).
let initMs = NaN;
try {
  const init = (await import(new URL('../pkg-web/totemsdk_core_wasm.js', import.meta.url))).default;
  const t0 = performance.now();
  await init({ module_or_path: bytes });
  initMs = performance.now() - t0;
} catch {
  /* ignore */
}

const sizeMsg = `wasm ${bytes.length}B (gzip ${gzip}B) vs budget ${budgets.wasmBytes}/${budgets.wasmGzipBytes}`;
const initMsg = Number.isFinite(initMs) ? `init ${initMs.toFixed(1)}ms vs ${budgets.initMs}ms (info)` : 'init n/a';

if (failures.length > 0) {
  console.error(`edge budget FAILED: ${sizeMsg}`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`edge budget OK: ${sizeMsg}; ${initMsg}`);
