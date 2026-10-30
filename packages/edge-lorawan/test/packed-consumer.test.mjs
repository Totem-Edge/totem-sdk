import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repository = resolve(packageDir, '..', '..');

test('packed LoRaWAN consumer loads ESM/CJS, runs a gateway, and typechecks', { timeout: 180_000 }, (t) => {
  const work = mkdtempSync(join(tmpdir(), 'lorawan-packed-consumer-'));
  t.after(() => rmSync(work, { recursive: true, force: true }));
  const run = (command, args, cwd = work) => {
    try {
      return execFileSync(command, args, { cwd, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      throw new Error(`${command} failed:\n${error.stdout ?? ''}\n${error.stderr ?? ''}`, { cause: error });
    }
  };
  const dependencies = {};
  for (const slug of ['edge', 'edge-lorawan']) {
    const output = join(work, `pack-${slug}`);
    mkdirSync(output);
    run('pnpm', ['--config.ignore-scripts=true', 'pack', '--pack-destination', output], join(repository, 'packages', slug));
    const [tarball] = readdirSync(output).filter((name) => name.endsWith('.tgz'));
    assert.ok(tarball);
    dependencies[`@totemsdk/${slug}`] = `file:${join(output, tarball)}`;
  }
  writeFileSync(join(work, 'package.json'), JSON.stringify({
    private: true, type: 'module', dependencies, devDependencies: { '@types/node': '^22.0.0' },
  }));
  run('npm', ['install', '--no-audit', '--no-fund', '--package-lock=false']);
  for (const slug of ['edge', 'edge-lorawan']) {
    assert.equal(lstatSync(join(work, 'node_modules', '@totemsdk', slug)).isSymbolicLink(), false);
  }

  writeFileSync(join(work, 'consumer.mjs'), `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import { createLorawanGateway, createMemoryLorawanReplayStore } from '@totemsdk/edge-lorawan';
    const require = createRequire(import.meta.url);
    const cjs = require('@totemsdk/edge-lorawan');
    class Transport {
      handlers = { downlink: [], join: [], error: [] };
      async joinOtaa() {} async activateAbp() {}
      async sendConfirmed() {} async sendUnconfirmed() {}
      onDownlink(h) { this.handlers.downlink.push(h); return () => {}; }
      onJoin(h) { this.handlers.join.push(h); return () => {}; }
      onError(h) { this.handlers.error.push(h); return () => {}; }
      emit(m) { this.handlers.downlink.forEach((h) => h(m)); }
    }
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
    for (const factory of [createLorawanGateway, cjs.createLorawanGateway]) {
      const transport = new Transport();
      const calls = [];
      const gateway = factory({
        runtime: { deviceId: 'packed', capabilities: {}, ports: { proof: { async createProof(p) { calls.push(p); return { ok: true }; } } } },
        transport, replayStore: createMemoryLorawanReplayStore(),
        abp: { devAddr: '26011F7D', nwkSKey: 'n', appSKey: 'a' },
      });
      await gateway.start();
      transport.emit({ port: 2, payload: Uint8Array.of(1), confirmed: false, frameCounter: 1, snr: 8, rssi: -80, receivedAt: Date.now() });
      await flush();
      assert.equal(calls.length, 1);
      assert.equal(calls[0].subject, 'lorawan:downlink');
      await gateway.stop();
    }
  `);
  run(process.execPath, ['consumer.mjs']);

  for (const extension of ['mts', 'cts']) {
    writeFileSync(join(work, `consumer.${extension}`), `
      import {
        createLorawanGateway, createMemoryLorawanReplayStore,
        type LorawanGateway, type LorawanReplayStore, type LorawanTransportPort,
      } from '@totemsdk/edge-lorawan';
      const replayStore: LorawanReplayStore = createMemoryLorawanReplayStore();
      const transport = {} as LorawanTransportPort;
      const gateway: LorawanGateway = createLorawanGateway({
        runtime: {} as never, transport, replayStore,
        abp: { devAddr: 'd', nwkSKey: 'n', appSKey: 'a' },
      });
      void gateway;
    `);
  }
  writeFileSync(join(work, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext', target: 'ES2022', strict: true, noEmit: true, skipLibCheck: false },
    files: ['consumer.mts', 'consumer.cts'],
  }));
  run(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', 'tsconfig.json']);
});
