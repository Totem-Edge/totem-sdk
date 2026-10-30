import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../packages/edge-modbus');
const repository = resolve(packageDir, '..', '..');

test('packed Modbus consumer loads ESM/CJS, calls the gateway, and typechecks', { timeout: 180_000 }, (t) => {
  const work = mkdtempSync(join(tmpdir(), 'modbus-packed-consumer-'));
  t.after(() => rmSync(work, { recursive: true, force: true }));
  const run = (command, args, cwd = work) => {
    try {
      return execFileSync(command, args, { cwd, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      throw new Error(`${command} failed:\n${error.stdout ?? ''}\n${error.stderr ?? ''}`, { cause: error });
    }
  };
  const dependencies = {};
  for (const slug of ['edge', 'edge-modbus']) {
    const output = join(work, `pack-${slug}`);
    mkdirSync(output);
    run('pnpm', ['--config.ignore-scripts=true', 'pack', '--pack-destination', output], join(repository, 'packages', slug));
    const [tarball] = readdirSync(output).filter((name) => name.endsWith('.tgz'));
    assert.ok(tarball);
    dependencies[`@totemsdk/${slug}`] = `file:${join(output, tarball)}`;
  }
  writeFileSync(join(work, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies }));
  run('npm', ['install', '--no-audit', '--no-fund', '--package-lock=false']);
  for (const slug of ['edge', 'edge-modbus']) {
    assert.equal(lstatSync(join(work, 'node_modules', '@totemsdk', slug)).isSymbolicLink(), false);
  }

  writeFileSync(join(work, 'consumer.mjs'), `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import { createModbusGateway } from '@totemsdk/edge-modbus';
    const require = createRequire(import.meta.url);
    const cjs = require('@totemsdk/edge-modbus');
    const transport = {
      async connect() {}, async disconnect() {},
      onFrame() { return () => {}; }, onError() { return () => {}; },
      async sendFrame(frame) {
        assert.deepEqual(Array.from(frame), [7, 3, 0, 10, 0, 2]);
        return Uint8Array.from([7, 3, 4, 1, 2, 3, 4]);
      },
    };
    const runtime = { deviceId: 'packed-modbus', ports: {} };
    for (const factory of [createModbusGateway, cjs.createModbusGateway]) {
      const gateway = factory({ runtime, transport });
      assert.deepEqual(await gateway.readHoldingRegisters(7, 10, 2), { ok: true, data: { values: [0x0102, 0x0304] } });
    }
  `);
  run(process.execPath, ['consumer.mjs']);

  for (const extension of ['mts', 'cts']) {
    writeFileSync(join(work, `consumer.${extension}`), `
      import { createModbusGateway, type ModbusGateway, type ModbusTransportPort } from '@totemsdk/edge-modbus';
      const create: typeof createModbusGateway = createModbusGateway;
      const transport = {} as ModbusTransportPort;
      const gateway: ModbusGateway = create({ runtime: {} as never, transport });
      void gateway;
    `);
  }
  writeFileSync(join(work, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext', target: 'ES2022', strict: true, noEmit: true, skipLibCheck: false },
    files: ['consumer.mts', 'consumer.cts'],
  }));
  run(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', 'tsconfig.json']);
});
