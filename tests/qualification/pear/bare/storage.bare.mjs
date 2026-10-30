/**
 * Bare-test compatible storage tests for @totemsdk/pear
 *
 * Run under the Bare runtime (once the package is built):
 *   bare src/__tests__/bare/storage.bare.mjs
 *
 * Run as plain Node.js CI proxy (no Bare runtime required):
 *   node src/__tests__/bare/storage.bare.mjs
 *
 * Imports from the compiled dist/ so no TypeScript loader is needed.
 * Build first: tsc --project tsconfig.json
 */

// ── Minimal sequential test runner shim (falls back when bare-test absent) ───
let _testRunner;
try {
  const mod = await import('bare-test');
  _testRunner = mod.default ?? mod;
} catch {
  const _queue = [];
  _testRunner = {
    test: (name, fn) => { _queue.push({ name, fn }); },
    end: async () => {
      const results = [];
      for (const { name, fn } of _queue) {
        try {
          await fn({ ok: (v, m) => { if (!v) throw new Error(m != null ? m : `assertion failed: ${JSON.stringify(v)}`); } });
          results.push({ name, pass: true });
        } catch (e) {
          results.push({ name, pass: false, error: e.message });
        }
      }
      let failed = 0;
      for (const r of results) {
        if (r.pass) {
          console.log('ok -', r.name);
        } else {
          console.error('not ok -', r.name);
          console.error('  ', r.error);
          failed++;
        }
      }
      if (failed > 0) {
        console.error(failed + ' test(s) failed');
        if (typeof process !== 'undefined') process.exitCode = 1;
      } else {
        console.log(results.length + ' test(s) passed');
      }
    },
  };
}

import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { unlinkSync, existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkgRoot = resolve(__dirname, '../../..'); // packages/pear/

const { BareFileStore } = await import(pkgRoot + '/dist/storage/BareFileStore.js');
const { BareKVStore } = await import(pkgRoot + '/dist/storage/BareKVStore.js');

// ── BareFileStore tests ────────────────────────────────────────────────────────

const _tmpPath = join(tmpdir(), 'bare-file-' + Date.now() + '.json');

_testRunner.test('BareFileStore: returns null for missing key', async (t) => {
  const store = new BareFileStore({ filePath: _tmpPath });
  t.ok((await store.get('missing')) === null, 'get missing returns null');
});

_testRunner.test('BareFileStore: write and read round-trip', async (t) => {
  const store = new BareFileStore({ filePath: _tmpPath });
  await store.set('hello', 'world');
  await new Promise((r) => setImmediate(r));
  const val = await store.get('hello');
  t.ok(val === 'world', 'expected world got ' + JSON.stringify(val));
});

_testRunner.test('BareFileStore: has() reflects set state', async (t) => {
  const p = join(tmpdir(), 'bare-has-' + Date.now() + '.json');
  const store = new BareFileStore({ filePath: p });
  t.ok((await store.has('k')) === false, 'absent before set');
  await store.set('k', 1);
  t.ok((await store.has('k')) === true, 'present after set');
  if (existsSync(p)) unlinkSync(p);
});

_testRunner.test('BareFileStore: remove() returns true and deletes key', async (t) => {
  const p = join(tmpdir(), 'bare-del-' + Date.now() + '.json');
  const store = new BareFileStore({ filePath: p });
  await store.set('del', 42);
  const r = await store.remove('del');
  t.ok(r === true, 'remove returns true');
  t.ok((await store.get('del')) === null, 'key gone after remove');
  if (existsSync(p)) unlinkSync(p);
});

_testRunner.test('BareFileStore: clear() empties store', async (t) => {
  const p = join(tmpdir(), 'bare-clear-' + Date.now() + '.json');
  const store = new BareFileStore({ filePath: p });
  await store.set('a', 1);
  await store.set('b', 2);
  await store.clear();
  const keys = await store.keys();
  t.ok(keys.length === 0, 'expected 0 keys, got ' + keys.length);
  if (existsSync(p)) unlinkSync(p);
});

_testRunner.test('BareFileStore: data survives reload from disk', async (t) => {
  const p = join(tmpdir(), 'bare-reload-' + Date.now() + '.json');
  const s1 = new BareFileStore({ filePath: p });
  await s1.set('persistent', 'yes');
  await s1.flush();
  const s2 = new BareFileStore({ filePath: p });
  const val = await s2.get('persistent');
  t.ok(val === 'yes', 'expected yes got ' + JSON.stringify(val));
  if (existsSync(p)) unlinkSync(p);
  if (existsSync(_tmpPath)) unlinkSync(_tmpPath);
});

// ── BareKVStore (in-memory mock) tests ─────────────────────────────────────────

function makeMemBee() {
  const _s = new Map();
  return {
    ready: async () => {},
    get: async (k) => (_s.has(k) ? { value: _s.get(k) } : null),
    put: async (k, v) => { _s.set(k, v); },
    del: async (k) => { _s.delete(k); },
    createReadStream: async function* () { for (const k of _s.keys()) yield { key: k }; },
    close: async () => {},
  };
}

_testRunner.test('BareKVStore: write and read round-trip', async (t) => {
  const store = new BareKVStore({ _bee: makeMemBee() });
  await store.set('greet', 'hello');
  const v = await store.get('greet');
  t.ok(v === 'hello', 'expected hello got ' + JSON.stringify(v));
  await store.close();
});

_testRunner.test('BareKVStore: remove() works', async (t) => {
  const store = new BareKVStore({ _bee: makeMemBee() });
  await store.set('d', 99);
  const r = await store.remove('d');
  t.ok(r === true, 'remove returns true');
  t.ok((await store.get('d')) === null, 'key gone');
  await store.close();
});

_testRunner.test('BareKVStore: clear() empties store', async (t) => {
  const store = new BareKVStore({ _bee: makeMemBee() });
  await store.set('p', 1);
  await store.set('q', 2);
  await store.clear();
  const keys = await store.keys();
  t.ok(keys.length === 0, 'expected 0 got ' + keys.length);
  await store.close();
});

await _testRunner.end();
