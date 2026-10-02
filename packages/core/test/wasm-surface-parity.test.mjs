/**
 * RFC-031 P1 — surface parity between the two hand-maintained WASM bridges.
 *
 * `wasm-sync.ts` and `wasm-async.ts` expose the same WASM functions under the
 * same clean names (the async one adds `init`/`initSync`). This guards against
 * the two mappings drifting as kernels are added.
 *
 * Run: pnpm --filter @totemsdk/core test:wasm-async
 */

import assert from 'node:assert/strict';
import * as sync from '../dist/wasm-sync.js';
import * as async from '../dist/wasm-async.js';

const syncNames = new Set(Object.keys(sync).filter((k) => typeof sync[k] === 'function'));
const asyncNames = new Set(Object.keys(async).filter((k) => typeof async[k] === 'function'));

// The async entry may add init helpers, but must expose every sync function.
const missing = [...syncNames].filter((name) => !asyncNames.has(name));
assert.deepEqual(missing, [], `wasm-async is missing: ${missing.join(', ')}`);

const extra = [...asyncNames].filter((name) => !syncNames.has(name)).sort();
const allowedExtra = new Set(['init', 'initSync']);
assert.deepEqual(
  extra.filter((n) => !allowedExtra.has(n)),
  [],
  'wasm-async exports unexpected extra functions',
);

console.log(
  `surface parity ok: ${syncNames.size} sync fns covered by wasm-async (+${extra.join(', ') || 'none'})`,
);
