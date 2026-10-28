/**
 * Real Bare smoke test for the published @totemsdk/core ESM surface.
 *
 * Run: bare scripts/bare-core-smoke.mjs
 *
 * It deliberately initializes WASM synchronously because Bare's WebAssembly
 * instantiation path does not resolve the async wasm-bindgen `init()` promise
 * in every build. `@totemsdk/core` now exports `initSync` from its public ESM
 * entry so this is a supported path, not a private workaround.
 */
import 'bare-encoding/global';
import { readFileSync } from 'bare-fs';
import {
  initSync,
  sha3_256,
  wotsSign,
  derivePKdigest,
  wotsVerifyDigest,
} from '../packages/core/dist/index.js';

const wasmPath = new URL('../packages/core-wasm/pkg-web/totemsdk_core_wasm_bg.wasm', import.meta.url);
const wasm = readFileSync(wasmPath);
initSync({ module: new WebAssembly.Module(new Uint8Array(wasm)) });

const message = sha3_256(new TextEncoder().encode('bare-core-smoke'));
const seed = new Uint8Array(32).fill(7);
const pk = derivePKdigest(seed, 0);
const signature = wotsSign(seed, 0, message);

if (message.length !== 32) throw new Error(`unexpected SHA3 length ${message.length}`);
if (!wotsVerifyDigest(signature, message, pk)) throw new Error('WOTS verify failed under Bare');
console.log('bare core ESM ok:', message.length, pk.length, signature.length);
