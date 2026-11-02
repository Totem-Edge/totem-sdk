/**
 * edge-grpc recovery: proxy crash/restart, pending call failure, stream error
 * propagation and teardown against a real TLS gRPC server.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createGrpcGateway } from '../../../packages/edge-grpc/dist/gateway.js';
import { NativeGrpcTransport } from '../../../packages/edge-grpc/dist/native-transport.js';

const HOST = '127.0.0.1';

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, HOST, resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForPort(port, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const socket = (await import('node:net')).createConnection({ host: HOST, port });
      await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); });
      socket.destroy();
      return true;
    } catch {
      await delay(50);
    }
  }
  return false;
}

function lineReader(stream) {
  let buffered = '';
  const queued = [];
  const waiting = [];
  stream.on('data', (chunk) => {
    buffered += chunk.toString('utf8');
    let newline;
    while ((newline = buffered.indexOf('\n')) >= 0) {
      const line = buffered.slice(0, newline);
      buffered = buffered.slice(newline + 1);
      const waiter = waiting.shift();
      if (waiter) waiter(line); else queued.push(line);
    }
  });
  return () => queued.length > 0 ? Promise.resolve(queued.shift()) : new Promise((resolve) => waiting.push(resolve));
}

function startSidecar(binary, port) {
  const child = spawn(binary, [], {
    env: { ...process.env, GRPC_LISTEN_ADDR: `${HOST}:${port}`, GRPC_TIMEOUT_MS: '5000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  child.stdout.on('data', (chunk) => logs.push(chunk.toString('utf8')));
  child.stderr.on('data', (chunk) => logs.push(chunk.toString('utf8')));
  return { child, logs };
}

test('recovers from proxy crash and surfaces stream/pending failures', { timeout: 120_000 }, async (t) => {
  const work = mkdtempSync(join(tmpdir(), 'edge-grpc-rec-'));
  const goDir = new URL('../../../packages/edge-grpc/go', import.meta.url);
  const sidecarBinary = join(work, 'edge-grpc');
  const serverBinary = join(work, 'edge-grpc-testserver');
  execFileSync('go', ['build', '-o', sidecarBinary, '.'], { cwd: goDir, timeout: 60_000 });
  execFileSync('go', ['build', '-o', serverBinary, './testserver'], { cwd: goDir, timeout: 60_000 });

  const grpcServer = spawn(serverBinary, [], { env: { ...process.env, TEST_TOKEN: 'test-token' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const readServerLine = lineReader(grpcServer.stdout);
  const grpcPort = Number((await readServerLine()).replace('PORT=', ''));
  const caCert = readFileSync((await readServerLine()).replace('CA=', ''), 'utf8');

  const sidecarPort = await freePort();
  let sidecar = startSidecar(sidecarBinary, sidecarPort);
  t.after(() => {
    sidecar.child.kill('SIGKILL');
    grpcServer.kill('SIGKILL');
    rmSync(work, { recursive: true, force: true });
  });
  assert.ok(await waitForPort(sidecarPort), `sidecar never listened:\n${sidecar.logs.join('')}`);

  const newGateway = () => {
    const transport = new NativeGrpcTransport({
      port: sidecarPort, connectTimeoutMs: 5000, requestTimeoutMs: 5000,
      tls: { caCert, serverName: 'localhost' }, metadata: { authorization: 'test-token' },
    });
    const gateway = createGrpcGateway({ runtime: {}, client: transport, address: `${HOST}:${grpcPort}` });
    return { transport, gateway };
  };

  const first = newGateway();
  t.after(async () => { await first.gateway.stop().catch(() => {}); });
  await first.gateway.start();
  assert.equal((await first.gateway.call('/test.Echo/Unary', Uint8Array.of(1))).ok, true);

  // An in-flight call fails closed when the proxy dies.
  const pending = first.gateway.call('/test.Echo/Slow', Uint8Array.of(2), 5000);
  await delay(100);
  sidecar.child.kill('SIGKILL');
  const pendingResult = await pending;
  assert.equal(pendingResult.ok, false);
  assert.match(pendingResult.error, /connection closed|not connected/i);

  // Open a stream before the crash to verify error propagation is not possible
  // (the proxy is already gone); open a new one after restart instead.
  await first.gateway.stop();

  sidecar = startSidecar(sidecarBinary, sidecarPort);
  assert.ok(await waitForPort(sidecarPort), `restarted sidecar never listened:\n${sidecar.logs.join('')}`);

  const second = newGateway();
  t.after(async () => { await second.gateway.stop().catch(() => {}); });
  await second.gateway.start();
  const recovered = await second.gateway.call('/test.Echo/Unary', Uint8Array.of(9));
  assert.equal(recovered.ok, true, recovered.error);
  assert.deepEqual([...recovered.data.payload], [9]);

  // Stream error on teardown: open a long-lived stream, then kill the proxy.
  const streamResult = await second.gateway.openServerStream('/test.Echo/Hang', Uint8Array.of(3));
  assert.equal(streamResult.ok, true, streamResult.error);
  const streamError = new Promise((resolve) => streamResult.data.onError(resolve));
  const firstMessage = new Promise((resolve) => streamResult.data.onData(resolve));
  await firstMessage;
  sidecar.child.kill('SIGKILL');
  const error = await streamError;
  assert.match(error.message, /connection closed|not connected/i);

  await second.gateway.stop();
  await second.gateway.stop();

  // Connecting after the proxy is gone fails instead of hanging.
  const third = newGateway();
  await assert.rejects(() => third.gateway.start(), /not connected|ECONNREFUSED|connect/i);
  await third.gateway.stop().catch(() => {});
});
