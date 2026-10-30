import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStorageMqttReplayStore } from '@totemsdk/edge-mqtt';
import { SqliteStore } from '@totemsdk/storage/sqlite';

const childrenByTest = new WeakMap();

function receive(child, type) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error(`Timed out waiting for ${type}: ${child.diagnostics}`)), 15_000);
    const onMessage = (message) => {
      if (message.type === 'fatal') finish(new Error(message.error));
      else if (message.type === type) finish(null, message);
    };
    const onExit = (code, signal) => finish(new Error(`Worker exited before ${type}: ${code}/${signal}: ${child.diagnostics}`));
    const onError = (error) => finish(error);
    function finish(error, message) {
      clearTimeout(timer);
      child.off('message', onMessage); child.off('exit', onExit); child.off('error', onError);
      if (error) reject(error); else resolve(message);
    }
    child.on('message', onMessage); child.on('exit', onExit); child.on('error', onError);
  });
}

async function worker(t, options) {
  const child = fork(new URL('./fixtures/replay-worker.mjs', import.meta.url), [JSON.stringify(options)], {
    execArgv: [], stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  childrenByTest.get(t).add(child);
  child.diagnostics = '';
  child.stdout.on('data', (data) => { child.diagnostics += data; });
  child.stderr.on('data', (data) => { child.diagnostics += data; });
  await receive(child, 'ready');
  return child;
}

async function start(child, expected = 'result') {
  const message = receive(child, expected);
  child.send({ type: 'go' });
  return message;
}

async function kill(child) {
  const exited = once(child, 'exit');
  assert.equal(child.kill('SIGKILL'), true);
  const [code, signal] = await exited;
  assert.equal(code, null); assert.equal(signal, 'SIGKILL');
}

async function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'mqtt-process-recovery-'));
  const children = new Set();
  childrenByTest.set(t, children);
  t.after(async () => {
    for (const child of children) {
      if (child.pid && child.exitCode === null && child.signalCode === null) {
        const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited;
      }
    }
    rmSync(directory, { recursive: true, force: true });
  });
  const options = { path: join(directory, 'replay.sqlite'), effectLog: join(directory, 'effects.log') };
  const storage = new SqliteStore(options.path, { busyTimeoutMs: 5000 });
  await storage.close();
  return { options, effects: () => existsSync(options.effectLog) ? readFileSync(options.effectLog, 'utf8').trim().split('\n') : [] };
}

test('independent ESM/CJS processes atomically claim one shared record', { timeout: 30_000 }, async (t) => {
  const { options } = await fixture(t);
  const children = await Promise.all(Array.from({ length: 6 }, (_, index) => worker(t, {
    ...options, mode: 'claim', moduleMode: index % 2 ? 'cjs' : 'esm',
    key: 'shared', now: 100, expiresAt: 200,
  })));
  const results = await Promise.all(children.map((child) => start(child)));
  assert.equal(results.filter((message) => message.result === true).length, 1);
  assert.equal(results.filter((message) => message.result === false).length, 5);
});

test('concurrent process deliveries execute a command once using real WASM and SQLite', { timeout: 30_000 }, async (t) => {
  const { options, effects } = await fixture(t);
  const createdAt = Date.now();
  const children = await Promise.all(Array.from({ length: 4 }, (_, index) => worker(t, {
    ...options, mode: 'command', moduleMode: index % 2 ? 'cjs' : 'esm', commandId: 'parallel-command', createdAt,
  })));
  const results = await Promise.all(children.map((child) => start(child)));
  assert.equal(results.filter((message) => message.result.ok).length, 1);
  assert.equal(results.filter((message) => /duplicate/.test(message.result.error ?? '')).length, 3);
  assert.deepEqual(effects(), ['parallel-command']);
});

for (const mode of ['crash-before-effect', 'crash-after-effect']) {
  test(`SIGKILL ${mode}: redelivery does not repeat an uncertain physical operation`, { timeout: 30_000 }, async (t) => {
    const { options, effects } = await fixture(t);
    const createdAt = Date.now();
    const first = await worker(t, { ...options, mode, moduleMode: 'cjs', commandId: 'interrupted', createdAt });
    await start(first, mode === 'crash-before-effect' ? 'executor-entered' : 'effect-committed');
    await kill(first);
    const restarted = await worker(t, { ...options, mode: 'command', moduleMode: 'esm', commandId: 'interrupted', createdAt });
    const { result } = await start(restarted);
    assert.equal(result.ok, false);
    assert.match(result.error, /duplicate commandId/);
    assert.deepEqual(effects(), mode === 'crash-before-effect' ? [] : ['interrupted']);
  });
}

test('MQTT root import does not load the optional SQLite binding', () => {
  const require = createRequire(import.meta.url);
  // A separate fresh process is needed: the test runner already imported SQLite.
  const workerCode = `
    const Module = require('node:module');
    const original = Module._load;
    Module._load = function(name, ...args) {
      if (name === 'better-sqlite3' || name === '@totemsdk/storage/sqlite') throw new Error('unexpected native replay import');
      return original.call(this, name, ...args);
    };
    const api = require(${JSON.stringify(require.resolve('@totemsdk/edge-mqtt'))});
    if (typeof api.createMqttCommandHandler !== 'function') throw new Error('missing handler');
  `;
  // Child process execution has no network and exercises the emitted CJS entry.
  require('node:child_process').execFileSync(process.execPath, ['-e', workerCode], { timeout: 10_000 });
});
