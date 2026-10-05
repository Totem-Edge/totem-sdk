/**
 * RFC-031 Fix A (batch A2) guard: the ESM build's root must import the portable
 * async bridge, not the sync one, and importing it must not instantiate WASM.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const index = readFileSync(join(dist, 'index.js'), 'utf8');

if (/from\s+['"]\.\/wasm-sync\.js['"]/.test(index)) {
  console.error('FAIL: ESM root still imports ./wasm-sync.js');
  process.exit(1);
}
if (!index.includes('./wasm-async.js')) {
  console.error('FAIL: ESM root does not import ./wasm-async.js');
  process.exit(1);
}

// Importing the root must not fetch/instantiate WASM (the web glue is inert
// until init()); if it did, Node's fetch would reject on the file URL.
const mod = await import(join(dist, 'index.js'));
if (typeof mod.sha3_256 !== 'function' || typeof mod.hashCanonical !== 'function') {
  console.error('FAIL: ESM root missing expected crypto exports');
  process.exit(1);
}

console.log('ok: ESM root is wasm-free at import and routes crypto to wasm-async');
