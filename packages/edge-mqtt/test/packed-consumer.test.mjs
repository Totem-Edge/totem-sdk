import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repository = resolve(packageDir, '..', '..');

test('packed MQTT root and SQLite subpath operate across ESM/CJS and strict type consumers', { timeout: 180_000 }, (t) => {
  const work = mkdtempSync(join(tmpdir(), 'mqtt-packed-consumer-'));
  t.after(() => rmSync(work, { recursive: true, force: true }));
  const run = (command, args, cwd = work) => {
    try {
      return execFileSync(command, args, { cwd, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      throw new Error(`${command} failed:\n${error.stdout ?? ''}\n${error.stderr ?? ''}`, { cause: error });
    }
  };
  const dependencies = {};
  for (const slug of ['edge', 'edge-mqtt']) {
    const directory = join(repository, 'packages', slug);
    const output = join(work, `pack-${slug}`);
    mkdirSync(output);
    run('pnpm', ['--config.ignore-scripts=true', 'pack', '--pack-destination', output], directory);
    const tarballs = readdirSync(output).filter((name) => name.endsWith('.tgz'));
    assert.equal(tarballs.length, 1);
    const tarball = join(output, tarballs[0]);
    dependencies[`@totemsdk/${slug}`] = `file:${tarball}`;
    if (slug === 'edge-mqtt') {
      const files = run('tar', ['-tzf', tarball]);
      for (const path of [
        'package/rust/pkg-node/edge_mqtt_wasm.js',
        'package/rust/pkg-node/edge_mqtt_wasm_bg.wasm',
        'package/dist/sqlite-replay-store.js',
        'package/dist/cjs/sqlite-replay-store.js',
      ]) assert.ok(files.split('\n').includes(path), `MQTT tarball missing ${path}`);
    }
  }
  // The deferred edge release is installed as its real local tarball. Other
  // dependencies resolve from npm; this is not a fully local packed SDK closure.
  writeFileSync(join(work, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies }));
  run('npm', ['install', '--no-audit', '--no-fund', '--package-lock=false']);
  // Verify that these are unpacked installs, not workspace links.
  const installed = JSON.parse(readFileSync(join(work, 'node_modules', '@totemsdk', 'edge-mqtt', 'package.json'), 'utf8'));
  assert.equal(installed.version, JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')).version);
  assert.equal(lstatSync(join(work, 'node_modules', '@totemsdk', 'edge-mqtt')).isSymbolicLink(), false);
  assert.equal(lstatSync(join(work, 'node_modules', '@totemsdk', 'edge')).isSymbolicLink(), false);
  assert.equal(existsSync(join(work, 'node_modules', '@totemsdk', 'connect')), false, 'optional Connect must not be required for these type consumers');

  writeFileSync(join(work, 'consumer.mjs'), `
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import { createRequire } from 'node:module';
    import { pathToFileURL } from 'node:url';
    import { resolve } from 'node:path';
    import * as esm from '@totemsdk/edge-mqtt';
    import { createSqliteMqttReplayStore } from '@totemsdk/edge-mqtt/sqlite-replay-store';
    import { init } from '@totemsdk/core';
    const require = createRequire(import.meta.url);
    const coreRequire = createRequire(require.resolve('@totemsdk/core'));
    const glue = coreRequire.resolve('@totemsdk/core-wasm/web');
    await init({ module_or_path: readFileSync(new URL('./totemsdk_core_wasm_bg.wasm', pathToFileURL(glue))) });
    const cjs = require('@totemsdk/edge-mqtt');
    const cjsReplay = require('@totemsdk/edge-mqtt/sqlite-replay-store');
    const path = resolve('replay.sqlite');
    const first = await createSqliteMqttReplayStore({ path });
    const second = await cjsReplay.createSqliteMqttReplayStore({ path });
    let effects = 0;
    const config = (replayStore) => ({
      runtime: { deviceId: 'packed-device', ports: { policy: {
        async check() { return { ok: true, data: { allowed: true } }; },
      } } },
      client: { async publish() {} }, replayStore, requireSignedCommands: false,
      executor: { async execute() { effects++; return { ok: true }; } },
    });
    const message = { topic: 'commands', receivedAt: Date.now(), payload: JSON.stringify({
      commandId: 'packed-command', command: 'pulse', createdAt: Date.now(),
    }) };
    try {
      assert.equal((await esm.createMqttCommandHandler(config(first)).handleCommand(message)).ok, true);
      const replay = await cjs.createMqttCommandHandler(config(second)).handleCommand(message);
      assert.equal(replay.ok, false);
      assert.match(replay.error, /duplicate/);
      assert.equal(effects, 1);
    } finally { await first.close(); await second.close(); }
  `);
  run(process.execPath, ['consumer.mjs']);

  for (const extension of ['mts', 'cts']) {
    writeFileSync(join(work, `consumer.${extension}`), `
      import { createSqliteMqttReplayStore, type SqliteMqttReplayStore } from '@totemsdk/edge-mqtt/sqlite-replay-store';
      import type { ReplayLedgerStore } from '@totemsdk/edge-mqtt';
      const create: (options: { path: string }) => Promise<SqliteMqttReplayStore> = createSqliteMqttReplayStore;
      const use: (store: ReplayLedgerStore) => Promise<boolean> = (store) => store.claim('key', 200, 100);
      void create; void use;
    `);
  }
  writeFileSync(join(work, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext', target: 'ES2022', strict: true, noEmit: true, skipLibCheck: false },
    files: ['consumer.mts', 'consumer.cts'],
  }));
  run(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', 'tsconfig.json']);
});
