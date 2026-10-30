/**
 * Bare-test compatible real Hypercore/Hyperbee tests for @totemsdk/pear.
 *
 * Run under Bare:   bare src/__tests__/bare/hyperbee.bare.mjs
 * Node CI proxy:    node src/__tests__/bare/hyperbee.bare.mjs
 *
 * Imports from compiled dist/ and uses real Hypercore/Hyperbee replication.
 */

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
          await fn({ ok: (v, m) => { if (!v) throw new Error(m != null ? m : 'assertion failed: ' + JSON.stringify(v)); } });
          results.push({ name, pass: true });
        } catch (e) {
          results.push({ name, pass: false, error: e.message });
        }
      }
      let failed = 0;
      for (const r of results) {
        if (r.pass) console.log('ok -', r.name);
        else { console.error('not ok -', r.name); console.error('  ', r.error); failed++; }
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
import { mkdtempSync, rmSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkgRoot = resolve(__dirname, '../../..');

const { BareKVStore } = await import(pkgRoot + '/dist/storage/BareKVStore.js');
const [{ default: Hypercore }, { default: Hyperbee }] = await Promise.all([
  import('hypercore'),
  import('hyperbee'),
]);

const dirs = [];
const makeDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'pear-bare-hyperbee-'));
  dirs.push(dir);
  return dir;
};

async function waitFor(check, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('waitFor timed out');
}

_testRunner.test('real Hyperbee: persists and reopens', async (t) => {
  const storagePath = join(makeDir(), 'kv');
  const first = new BareKVStore({ storagePath });
  await first.set('count', 7n);
  await first.set('payload', new Uint8Array([1, 2, 3]));
  await first.close();

  const reopened = new BareKVStore({ storagePath });
  t.ok((await reopened.get('count')) === 7n, 'bigint round-trip after reopen');
  t.ok(JSON.stringify(Array.from(await reopened.get('payload'))) === '[1,2,3]', 'bytes round-trip after reopen');
  await reopened.close();
});

_testRunner.test('real Hyperbee: replicates between two peers', async (t) => {
  const dirA = makeDir();
  const dirB = makeDir();
  const coreA = new Hypercore(join(dirA, 'core'));
  await coreA.ready();
  const coreB = new Hypercore(join(dirB, 'core'), coreA.key);

  const streamA = coreA.replicate(true);
  const streamB = coreB.replicate(false);
  streamA.pipe(streamB).pipe(streamA);

  const beeA = new Hyperbee(coreA, { keyEncoding: 'utf-8', valueEncoding: 'binary' });
  const beeB = new Hyperbee(coreB, { keyEncoding: 'utf-8', valueEncoding: 'binary' });
  await beeA.ready();
  await beeB.ready();

  const storeA = new BareKVStore({ _bee: beeA });
  const storeB = new BareKVStore({ _bee: beeB });
  await storeA.set('bigint', 42n);
  await storeA.set('bytes', new Uint8Array([9, 8, 7]));

  await waitFor(() => storeB.has('bigint'));
  t.ok((await storeB.get('bigint')) === 42n, 'bigint replicated');
  t.ok(JSON.stringify(Array.from(await storeB.get('bytes'))) === '[9,8,7]', 'bytes replicated');

  await storeA.close();
  await storeB.close();
});

await _testRunner.end?.();
for (const dir of dirs) {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}
