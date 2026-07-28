/**
 * Bare-test compatible lifecycle tests for @totemsdk/pear
 *
 * Run under the Bare runtime (once the package is built):
 *   bare src/__tests__/bare/lifecycle.bare.mjs
 *
 * Run as plain Node.js CI proxy (no Bare runtime required):
 *   node src/__tests__/bare/lifecycle.bare.mjs
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
          await fn({ ok: (v, m) => { if (!v) throw new Error(m != null ? m : 'assertion failed: ' + JSON.stringify(v)); } });
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
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkgRoot = resolve(__dirname, '../../..'); // packages/pear/

const { onExit, runExitHandlers, createPearApp, _resetForTesting } =
  await import(pkgRoot + '/dist/lifecycle.js');

function reset() { _resetForTesting(); }

_testRunner.test('onExit callback fires on runExitHandlers', async (t) => {
  reset();
  const called = [];
  onExit(() => called.push('cb1'));
  await runExitHandlers();
  t.ok(called.includes('cb1'), 'expected cb1 in ' + JSON.stringify(called));
});

_testRunner.test('callbacks fire in LIFO order', async (t) => {
  reset();
  const order = [];
  onExit(() => order.push(1));
  onExit(() => order.push(2));
  onExit(() => order.push(3));
  await runExitHandlers();
  t.ok(JSON.stringify(order) === '[3,2,1]', 'expected [3,2,1] got ' + JSON.stringify(order));
});

_testRunner.test('unsubscribe removes callback', async (t) => {
  reset();
  const called = [];
  const unsub = onExit(() => called.push('should-not-fire'));
  onExit(() => called.push('should-fire'));
  unsub();
  await runExitHandlers();
  t.ok(!called.includes('should-not-fire'), 'unsub worked');
  t.ok(called.includes('should-fire'), 'second cb fired');
});

_testRunner.test('throwing callback does not abort remaining handlers', async (t) => {
  reset();
  const called = [];
  onExit(() => called.push('before'));
  onExit(() => { throw new Error('boom'); });
  onExit(() => called.push('after'));
  let threw = false;
  try { await runExitHandlers(); } catch { threw = true; }
  t.ok(!threw, 'runExitHandlers did not throw');
  t.ok(called.includes('before') && called.includes('after'), 'expected both; got ' + JSON.stringify(called));
});

_testRunner.test('createPearApp registers Pear.teardown once', async (t) => {
  reset();
  const cbs = [];
  globalThis.Pear = { teardown: (cb) => cbs.push(cb) };
  try {
    createPearApp();
    createPearApp();
    createPearApp();
    t.ok(cbs.length === 1, 'expected 1 teardown registration, got ' + cbs.length);
  } finally {
    delete globalThis.Pear;
  }
});

_testRunner.test('onUpdate registered independently on each createPearApp call', async (t) => {
  reset();
  const updateCbs = [];
  globalThis.Pear = {
    teardown: () => {},
    updates: (cb) => updateCbs.push(cb),
  };
  try {
    const fn1 = () => {};
    const fn2 = () => {};
    createPearApp({ onUpdate: fn1 });
    createPearApp({ onUpdate: fn2 });
    t.ok(updateCbs.length === 2, 'expected 2 update registrations, got ' + updateCbs.length);
    t.ok(updateCbs[0] === fn1 && updateCbs[1] === fn2, 'correct handlers registered in order');
  } finally {
    delete globalThis.Pear;
  }
});

_testRunner.test('createPearApp works without globalThis.Pear', async (t) => {
  reset();
  delete globalThis.Pear;
  let threw = false;
  try { createPearApp(); } catch { threw = true; }
  t.ok(!threw, 'no throw without Pear');
});

await _testRunner.end();
