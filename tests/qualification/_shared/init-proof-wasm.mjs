/**
 * Shared WASM initializer for proof-family qualification tests.
 *
 * proof/proofgraph hash through @totemsdk/core, whose ESM build uses the async
 * WASM kernel. Import this module for its side effect before any hashing.
 */
import { readFileSync } from 'node:fs';
import { init } from '../../../packages/core/dist/index.js';

const glue = new URL('../../../packages/core-wasm/pkg-web/totemsdk_core_wasm.js', import.meta.url);
await init({ module_or_path: readFileSync(new URL('./totemsdk_core_wasm_bg.wasm', glue)) });
