/**
 * Initialise the portable async core-wasm build for Node scripts that import
 * ESM package dist output (`@totemsdk/core` routes ESM to `wasm-async`).
 *
 * Import this module first: its top-level await completes before the importing
 * module body runs.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { init } from '../../packages/core/dist/wasm-async.js';

const wasmPath = fileURLToPath(
  new URL('../../packages/core-wasm/pkg-web/totemsdk_core_wasm_bg.wasm', import.meta.url),
);

await init({ module_or_path: readFileSync(wasmPath) });
