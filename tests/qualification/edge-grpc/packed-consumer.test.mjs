import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../packages/edge-grpc');
const repository = resolve(packageDir, '..', '..');

test('packed gRPC consumer loads ESM/CJS, runs a gateway, and typechecks', { timeout: 180_000 }, (t) => {
  const work = mkdtempSync(join(tmpdir(), 'grpc-packed-consumer-'));
  t.after(() => rmSync(work, { recursive: true, force: true }));
  const run = (command, args, cwd = work) => {
    try {
      return execFileSync(command, args, { cwd, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      throw new Error(`${command} failed:\n${error.stdout ?? ''}\n${error.stderr ?? ''}`, { cause: error });
    }
  };
  const dependencies = {};
  for (const slug of ['agent-policy', 'edge', 'edge-grpc']) {
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
  for (const slug of ['agent-policy', 'edge', 'edge-grpc']) {
    assert.equal(lstatSync(join(work, 'node_modules', '@totemsdk', slug)).isSymbolicLink(), false);
  }

  writeFileSync(join(work, 'consumer.mjs'), `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import { createGrpcGateway } from '@totemsdk/edge-grpc';
    const require = createRequire(import.meta.url);
    const cjs = require('@totemsdk/edge-grpc');

    class Stream {
      streamId = 's1'; handlers = { data: [], end: [], error: [] };
      async send() {} async close() {}
      onData(h) { this.handlers.data.push(h); return () => {}; }
      onEnd(h) { this.handlers.end.push(h); return () => {}; }
      onError(h) { this.handlers.error.push(h); return () => {}; }
      emit(data) { this.handlers.data.forEach((h) => h(data)); }
      end() { this.handlers.end.forEach((h) => h()); }
    }
    class Client {
      connected = null; closed = 0;
      async connect(address) { this.connected = address; }
      async close() { this.closed++; }
      async unaryCall(path, payload) { return new Uint8Array([...payload, 1]); }
      async serverStream() { return new Stream(); }
      async clientStream() { return new Stream(); }
      async bidiStream() { return new Stream(); }
    }

    for (const factory of [createGrpcGateway, cjs.createGrpcGateway]) {
      const client = new Client();
      const gateway = factory({ runtime: {}, client, address: '127.0.0.1:50051' });
      await gateway.start();
      assert.equal(client.connected, '127.0.0.1:50051');
      const unary = await gateway.call('/pkg.S/M', Uint8Array.of(4));
      assert.equal(unary.ok, true);
      assert.deepEqual([...unary.data.payload], [4, 1]);
      const stream = await gateway.openServerStream('/pkg.S/Stream', new Uint8Array(0));
      assert.equal(stream.ok, true);
      await gateway.stop();
      assert.equal(client.closed, 1);
    }
  `);
  run(process.execPath, ['consumer.mjs']);

  for (const extension of ['mts', 'cts']) {
    writeFileSync(join(work, `consumer.${extension}`), `
      import {
        createGrpcGateway,
        type GrpcGateway, type GrpcClient, type GrpcStreamHandle, type GrpcTlsConfig,
        type NativeGrpcConfig,
      } from '@totemsdk/edge-grpc';
      const client = {} as GrpcClient;
      const gateway: GrpcGateway = createGrpcGateway({ runtime: {} as never, client, address: '127.0.0.1:50051' });
      void gateway;
      const tls: GrpcTlsConfig = { caCert: 'pem', serverName: 'localhost' };
      const native: NativeGrpcConfig = { tls, metadata: { authorization: 'token' } };
      void native;
      const stream: GrpcStreamHandle | undefined = undefined;
      void stream;
    `);
  }
  writeFileSync(join(work, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext', target: 'ES2022', strict: true, noEmit: true, skipLibCheck: false },
    files: ['consumer.mts', 'consumer.cts'],
  }));
  run(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', 'tsconfig.json']);
});
