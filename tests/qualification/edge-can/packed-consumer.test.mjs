import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../packages/edge-can');
const repository = resolve(packageDir, '..', '..');

test('packed CAN consumer loads ESM/CJS, runs a gateway, and typechecks', { timeout: 180_000 }, (t) => {
  const work = mkdtempSync(join(tmpdir(), 'can-packed-consumer-'));
  t.after(() => rmSync(work, { recursive: true, force: true }));
  const run = (command, args, cwd = work) => {
    try {
      return execFileSync(command, args, { cwd, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      throw new Error(`${command} failed:\n${error.stdout ?? ''}\n${error.stderr ?? ''}`, { cause: error });
    }
  };
  const dependencies = {};
  for (const slug of ['edge', 'edge-can']) {
    const output = join(work, `pack-${slug}`);
    mkdirSync(output);
    run('pnpm', ['--config.ignore-scripts=true', 'pack', '--pack-destination', output], join(repository, 'packages', slug));
    const [tarball] = readdirSync(output).filter((name) => name.endsWith('.tgz'));
    assert.ok(tarball, `no tarball for ${slug}`);
    dependencies[`@totemsdk/${slug}`] = `file:${join(output, tarball)}`;
  }
  writeFileSync(join(work, 'package.json'), JSON.stringify({
    private: true, type: 'module', dependencies, devDependencies: { '@types/node': '^22.0.0' },
  }));
  run('npm', ['install', '--no-audit', '--no-fund', '--package-lock=false']);
  for (const slug of ['edge', 'edge-can']) {
    assert.equal(lstatSync(join(work, 'node_modules', '@totemsdk', slug)).isSymbolicLink(), false);
  }

  writeFileSync(join(work, 'consumer.mjs'), `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import { createCanGateway } from '@totemsdk/edge-can';
    const require = createRequire(import.meta.url);
    const cjs = require('@totemsdk/edge-can');

    class Transport {
      sent = []; frames = []; errors = [];
      async open() {} async close() {}
      async send(id, data, isExtended) { this.sent.push({ id, data, isExtended }); }
      onFrame(handler) { this.frames.push(handler); return () => {}; }
      onError(handler) { this.errors.push(handler); return () => {}; }
      emit(frame) { for (const handler of this.frames) handler(frame); }
    }

    for (const factory of [createCanGateway, cjs.createCanGateway]) {
      const proofs = [];
      const transport = new Transport();
      const gateway = factory({
        runtime: { deviceId: 'packed', capabilities: {}, ports: { proof: { async createProof(proof) { proofs.push(proof); return { ok: true }; } } } },
        transport,
        interfaceName: 'vcan0',
        filters: [{ id: 0x123 }],
        signals: [{ name: 'rpm', canId: 0x123, isExtended: false, startBit: 0, length: 16, isSigned: false, isBigEndian: false, scale: 0.5, offset: 0 }],
      });
      await gateway.start();
      transport.emit({ id: 0x123, isExtended: false, isRtr: false, dlc: 2, data: Uint8Array.of(5, 0), receivedAt: 1 });
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.equal(proofs.length, 1);
      assert.equal(proofs[0].claims[0].signals[0].value, 2.5);
      await gateway.send(0x100, Uint8Array.of(1, 2), false);
      assert.deepEqual(transport.sent[0], { id: 0x100, data: Uint8Array.of(1, 2), isExtended: false });
      await gateway.stop();
    }
  `);
  run(process.execPath, ['consumer.mjs']);

  for (const extension of ['mts', 'cts']) {
    writeFileSync(join(work, `consumer.${extension}`), `
      import {
        createCanGateway,
        type CanGateway, type CanTransportPort, type CanSignalDef, type CanFilter, type CanFrame,
      } from '@totemsdk/edge-can';
      const transport = {} as CanTransportPort;
      const signal: CanSignalDef = {
        name: 'rpm', canId: 0x123, isExtended: false, startBit: 0, length: 16,
        isSigned: false, isBigEndian: false, scale: 1, offset: 0,
      };
      const filter: CanFilter = { id: 0x123, mask: 0x7ff, isExtended: false };
      const frame: CanFrame = { id: 0x123, isExtended: false, isRtr: false, dlc: 2, data: new Uint8Array(2), receivedAt: 0 };
      const gateway: CanGateway = createCanGateway({ runtime: {} as never, transport, interfaceName: 'can0', signals: [signal], filters: [filter] });
      void gateway; void frame;
    `);
  }
  writeFileSync(join(work, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext', target: 'ES2022', strict: true, noEmit: true, skipLibCheck: false },
    files: ['consumer.mts', 'consumer.cts'],
  }));
  run(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', 'tsconfig.json']);
});
