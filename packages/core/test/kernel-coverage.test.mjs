/**
 * RFC-031 P2 — kernel coverage matrix gate.
 *
 * Every WASM kernel exported by `@totemsdk/core/wasm-async` must be triaged in
 * `kernel-baseline.json` (a parity test, or explicitly `pending`). This is the
 * anti-drift guard for the sunset: a new/removed/renamed kernel fails until the
 * matrix is updated, and every non-pending reference must resolve to a real test.
 *
 * Run: pnpm --filter @totemsdk/core test:wasm-async
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import * as async from '../dist/wasm-async.js';

const baseline = JSON.parse(
  readFileSync(new URL('./kernel-baseline.json', import.meta.url), 'utf8'),
);
const initHelpers = new Set(baseline.initHelpers);

const exported = Object.keys(async)
  .filter((name) => typeof async[name] === 'function' && !initHelpers.has(name))
  .sort();
const triaged = Object.keys(baseline.kernels).sort();

const untriaged = exported.filter((name) => !triaged.includes(name));
const vanished = triaged.filter((name) => !exported.includes(name));

assert.deepEqual(
  untriaged,
  [],
  `untriaged new WASM kernel(s): ${untriaged.join(', ')} — add to test/kernel-baseline.json`,
);
assert.deepEqual(
  vanished,
  [],
  `WASM kernel(s) disappeared: ${vanished.join(', ')}`,
);

// Every non-pending parity reference must resolve to a test file.
const testDir = new URL('../src/__tests__/', import.meta.url);
const broken = Object.entries(baseline.kernels).filter(
  ([, ref]) => ref !== 'pending' && !existsSync(new URL(`${ref}.test.ts`, testDir)),
);
assert.deepEqual(
  broken,
  [],
  `parity reference(s) point at no test file: ${broken.map(([k, r]) => `${k}->${r}`).join(', ')}`,
);

const covered = Object.values(baseline.kernels).filter((ref) => ref !== 'pending').length;
const pending = triaged.length - covered;
console.log(
  `kernel coverage: ${covered}/${triaged.length} covered by parity tests, ${pending} pending (sunset blocks until 0)`,
);
