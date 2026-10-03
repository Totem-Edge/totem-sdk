/**
 * RFC-031 G1 — Bare/Pear runtime check for the portable WASM entry.
 *
 * Bare (Holepunch, V8-based) runs the async web target, but does not provide the
 * `TextEncoder`/`TextDecoder` globals the wasm-bindgen glue uses, so import
 * `bare-encoding/global` first. Prerequisites (not workspace deps):
 *
 *   npm i -g bare            # or: npm i bare bare-encoding bare-fs
 *
 * Run:
 *   bare tests/web-bare.mjs
 */

import 'bare-encoding/global';
import { readFileSync } from 'bare-fs';

import init, {
  sha3_256_wasm,
  bytes_to_hex_wasm,
  wots_sign_wasm,
  derive_pk_digest_wasm,
  wots_verify_digest_wasm,
} from '../pkg-web/totemsdk_core_wasm.js';

const bytes = readFileSync(new URL('../pkg-web/totemsdk_core_wasm_bg.wasm', import.meta.url));
await init({ module_or_path: new Uint8Array(bytes) });

const message = sha3_256_wasm(new TextEncoder().encode('bare'));
const digest = bytes_to_hex_wasm(message);
if (digest.length !== 64) throw new Error(`unexpected digest length ${digest.length}`);

const seed = new Uint8Array(32).fill(7);
const pk = derive_pk_digest_wasm(seed, 0);
const signature = wots_sign_wasm(seed, 0, message);
if (wots_verify_digest_wasm(signature, message, pk) !== true) {
  throw new Error('WOTS verify failed under Bare');
}

console.log('bare wasm-async ok:', digest.slice(0, 16));
