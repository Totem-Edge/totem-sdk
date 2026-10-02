/**
 * RFC-031 P1 — async-first core WASM entry (`@totemsdk/core/wasm-async`).
 *
 * Proves the core async entry:
 *   1. re-exports the WASM surface under the clean core names,
 *   2. requires a one-time async init (no sync-at-import),
 *   3. runs standalone under Node ESM (portable; no fs/require in the glue).
 *
 * Run: pnpm --filter @totemsdk/core test:wasm-async
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

import {
  init,
  sha3_256,
  bytesToHex,
  derivePKdigest,
  wotsSign,
  wotsVerifyDigest,
} from '../dist/wasm-async.js';

// Load the web target's bytes from the sibling package (portable: pass bytes,
// no fetch / MIME dependency).
const wasmUrl = new URL('../../core-wasm/pkg-web/totemsdk_core_wasm_bg.wasm', import.meta.url);
await init({ module_or_path: readFileSync(fileURLToPath(wasmUrl)) });

const data = new TextEncoder().encode('rfc-031');
const digest = sha3_256(data);
assert.equal(
  bytesToHex(digest),
  'C6D39BDEDAEBF08326908047B983091A9DA86A318DAF748ADEA5695326B50461',
  'sha3_256 golden mismatch',
);

const seed = new Uint8Array(32).fill(7);
const pk = derivePKdigest(seed, 0);
assert.equal(pk.length, 32);

// WOTS signs a 32-byte digest.
const message = sha3_256(data);
const sig = wotsSign(seed, 0, message);
assert.equal(sig.length, 1088);
assert.equal(wotsVerifyDigest(sig, message, pk), true);

console.log('core/wasm-async ok:', bytesToHex(digest).slice(0, 16));
