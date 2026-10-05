/**
 * RFC-031 Fix A (batch A2): route the ESM build's crypto to the async bridge.
 *
 * The single source imports the sync bridge (`./wasm-sync.js`). The ESM build
 * must instead load the portable async web glue (`./wasm-async.js`) so the
 * root and every helper are importable without instantiating WASM (no binary,
 * no fetch) — required for edge/Workers/Bare. The CJS build keeps the sync
 * bridge. This is a plain relative-specifier rewrite, so it is bundler-safe
 * and needs no package `imports` field.
 *
 * Runs after the ESM `tsc` and before the CJS `tsc`; only touches `dist/`
 * (skips `dist/cjs/` and the sync bridge itself).
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

let rewritten = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'cjs') continue; // CJS build stays on the sync bridge
      walk(full);
      continue;
    }
    if (!entry.endsWith('.js') || entry === 'wasm-sync.js') continue;
    const src = readFileSync(full, 'utf8');
    const out = src.replace(
      /(['"])(\.{1,2}\/[^'"]*?)wasm-sync\.js\1/g,
      (_m, q, prefix) => `${q}${prefix}wasm-async.js${q}`,
    );
    if (out !== src) {
      writeFileSync(full, out);
      rewritten++;
    }
  }
}

walk(dist);
console.log(`[async-esm] routed wasm-sync -> wasm-async in ${rewritten} ESM module(s)`);
