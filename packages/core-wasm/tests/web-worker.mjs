/**
 * RFC-031 P1 — runtime matrix: isolate check.
 *
 * Runs the `pkg-web` glue inside a `worker_threads` isolate (a proxy for
 * edge/Worker runtimes: fresh module registry, no shared globals from the main
 * thread, bytes supplied explicitly rather than fetched). Proves the async
 * entry initializes and computes in an isolate.
 *
 * Run: node packages/core-wasm/tests/web-worker.mjs
 */

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

if (!isMainThread) {
  const mod = await import(new URL('../pkg-web/totemsdk_core_wasm.js', import.meta.url));
  await mod.default({ module_or_path: new Uint8Array(workerData.bytes) });
  const out = mod.bytes_to_hex_wasm(mod.sha3_256_wasm(new TextEncoder().encode('worker')));
  parentPort.postMessage(out);
} else {
  const bytes = readFileSync(
    fileURLToPath(new URL('../pkg-web/totemsdk_core_wasm_bg.wasm', import.meta.url)),
  );
  const worker = new Worker(new URL(import.meta.url), { workerData: { bytes } });
  const out = await new Promise((resolve, reject) => {
    worker.on('message', resolve);
    worker.on('error', reject);
  });
  assert.match(String(out), /^[0-9A-Fa-f]{64}$/);
  console.log('worker init ok:', String(out).slice(0, 16));
  await worker.terminate();
}
