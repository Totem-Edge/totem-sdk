/**
 * RFC-031 P1 — portable async WASM target (`--target web`).
 *
 * Proves the `pkg-web` glue:
 *   1. exposes an async `init()` (no sync-at-import, no `fs`/`require`),
 *   2. accepts explicit wasm bytes (portable: no fetch / MIME dependency),
 *   3. produces byte-identical results to the Node target (parity).
 *
 * Run: node packages/core-wasm/tests/web-init.test.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

import initWeb, {
  sha3_256_wasm as sha3Web,
  bytes_to_hex_wasm as hexWeb,
  wots_verify_digest_wasm as wotsVerifyWeb,
} from '../pkg-web/totemsdk_core_wasm.js';
import * as nodeTarget from '../pkg-node/totemsdk_core_wasm.js';

const here = dirname(fileURLToPath(import.meta.url));
const wasmBytes = readFileSync(join(here, '../pkg-web/totemsdk_core_wasm_bg.wasm'));

// Async init with explicit bytes — the portable path (no fetch, no fs in glue).
await initWeb({ module_or_path: wasmBytes });

const data = new TextEncoder().encode('totem-rfc-031');

// sha3 parity
const webDigest = hexWeb(sha3Web(data));
const nodeDigest = nodeTarget.bytes_to_hex_wasm(nodeTarget.sha3_256_wasm(data));
assert.equal(webDigest, nodeDigest, 'sha3_256: web != node');
assert.match(webDigest, /^[0-9A-Fa-f]{64}$/);

// WOTS digest verify parity on a trivial all-zero digest (structure-only check)
const digest = new Uint8Array(32);
const fakeSig = new Uint8Array(1088);
const webOk = wotsVerifyWeb(fakeSig, digest, new Uint8Array(32));
const nodeOk = nodeTarget.wots_verify_digest_wasm(fakeSig, digest, new Uint8Array(32));
assert.equal(webOk, nodeOk, 'wots_verify_digest: web != node');

console.log('web-init ok');
console.log('  sha3(web)  =', webDigest);
console.log('  parity     = ok (web == node)');
console.log('  wots verify= ', webOk);
