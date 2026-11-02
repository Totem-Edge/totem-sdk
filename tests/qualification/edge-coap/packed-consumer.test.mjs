import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../packages/edge-coap');
const repository = resolve(packageDir, '..', '..');

test('packed CoAP consumer loads ESM/CJS, runs a gateway, and typechecks', { timeout: 180_000 }, (t) => {
  const work = mkdtempSync(join(tmpdir(), 'coap-packed-consumer-'));
  t.after(() => rmSync(work, { recursive: true, force: true }));
  const run = (command, args, cwd = work) => {
    try {
      return execFileSync(command, args, { cwd, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      throw new Error(`${command} failed:\n${error.stdout ?? ''}\n${error.stderr ?? ''}`, { cause: error });
    }
  };
  const dependencies = {};
  for (const slug of ['edge', 'edge-coap']) {
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
  for (const slug of ['edge', 'edge-coap']) {
    assert.equal(lstatSync(join(work, 'node_modules', '@totemsdk', slug)).isSymbolicLink(), false);
  }

  writeFileSync(join(work, 'consumer.mjs'), `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import { createCoapGateway, createOscoreContext, decodeCbor } from '@totemsdk/edge-coap';
    const require = createRequire(import.meta.url);
    const cjs = require('@totemsdk/edge-coap');
    assert.deepEqual(decodeCbor(new Uint8Array([0xa1, 0x61, 0x61, 0x01])), { a: 1 });
    assert.deepEqual(cjs.decodeCbor(new Uint8Array([0x01])), 1);
    const oscore = await createOscoreContext({
      masterSecret: new Uint8Array(16), senderId: new Uint8Array(0), recipientId: new Uint8Array([1]),
    });
    assert.equal(typeof oscore.protect, 'function');
    class Transport {
      sent = []; handlers = []; errors = [];
      async bind() {} async close() {}
      async send(host, port, message) { this.sent.push({ host, port, message }); }
      onMessage(handler) { this.handlers.push(handler); return () => {}; }
      onError(handler) { this.errors.push(handler); return () => {}; }
      emit(message, remote) { for (const handler of this.handlers) handler(message, remote); }
    }
    for (const factory of [createCoapGateway, cjs.createCoapGateway]) {
      const transport = new Transport();
      const gateway = factory({ runtime: {}, transport, localPort: 0, timing: { requestTimeoutMs: 1000, ackTimeoutMs: 0 } });
      await gateway.start();
      const pending = gateway.get(['sensors'], '127.0.0.1', 5683);
      const request = transport.sent[0].message;
      const tokenLength = request[0] & 0x0f;
      const ack = new Uint8Array(4 + tokenLength + 2);
      ack[0] = 0x60 | tokenLength;
      ack[1] = 0x45;
      ack[2] = request[2];
      ack[3] = request[3];
      ack.set(request.slice(4, 4 + tokenLength), 4);
      ack[4 + tokenLength] = 0xff;
      ack[5 + tokenLength] = 7;
      transport.emit(ack, { host: '127.0.0.1', port: 5683 });
      const result = await pending;
      assert.equal(result.ok, true);
      assert.deepEqual([...result.data.payload], [7]);
      await gateway.stop();
    }
  `);
  run(process.execPath, ['consumer.mjs']);

  for (const extension of ['mts', 'cts']) {
    writeFileSync(join(work, `consumer.${extension}`), `
      import {
        createCoapGateway, decodeCbor,
        isOscoreProtected,
        type CoapGateway, type CoapObservation, type CoapResponseData,
        type CoapTransportPort, type CoapMessage, type CborValue,
        type CoapSecurityPort, type OscoreContextConfig, type CoapBlockOption,
      } from '@totemsdk/edge-coap';
      const transport = {} as CoapTransportPort;
      const gateway: CoapGateway = createCoapGateway({ runtime: {} as never, transport, localPort: 0 });
      const observation: Promise<unknown> = gateway.observe(['s'], 'h', 1, (data) => { const value: number | undefined = data.observe; void value; });
      void observation;
      const handle: CoapObservation | undefined = undefined;
      void handle;
      const response: CoapResponseData = { payload: new Uint8Array(), contentFormat: 60 };
      void response;
      const message: CoapMessage = {
        type: 'CON', messageId: 0, token: new Uint8Array(), path: [],
        payload: new Uint8Array(), remote: { host: 'h', port: 1 }, receivedAt: 0,
        observe: 0, contentFormat: 60,
      };
      const value: CborValue = decodeCbor(message.payload);
      void value;
      const security = {} as CoapSecurityPort;
      void security;
      const protectedMessage: boolean = isOscoreProtected(message);
      void protectedMessage;
      const oscoreConfig: OscoreContextConfig = {
        masterSecret: new Uint8Array(16), senderId: new Uint8Array(0), recipientId: new Uint8Array([1]),
      };
      void oscoreConfig;
      const block: CoapBlockOption = { num: 0, more: true, sizeExponent: 6 };
      void block;
    `);
  }
  writeFileSync(join(work, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext', target: 'ES2022', strict: true, noEmit: true, skipLibCheck: false },
    files: ['consumer.mts', 'consumer.cts'],
  }));
  run(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', 'tsconfig.json']);
});
