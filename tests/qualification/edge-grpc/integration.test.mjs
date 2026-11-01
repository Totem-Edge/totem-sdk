/**
 * edge-grpc integration evidence: real Go proxy ↔ real TLS gRPC server.
 *
 * Covers raw-byte unary calls, server/client/bidi streams, deadlines,
 * cancellation, metadata authentication and TLS verification.
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

async function waitForPort(port, timeoutMs = 10_000) {
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
  return () => queued.length > 0
    ? Promise.resolve(queued.shift())
    : new Promise((resolve) => waiting.push(resolve));
}

async function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out waiting for ${label}`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function trackStream(stream) {
  const data = [];
  let resolveEnd;
  let resolveError;
  const ended = new Promise((resolve) => { resolveEnd = resolve; });
  const errored = new Promise((resolve) => { resolveError = resolve; });
  stream.onData((chunk) => data.push([...chunk]));
  stream.onEnd(() => resolveEnd());
  stream.onError((error) => resolveError(error));
  return { data, ended, errored };
}

test('drives a TLS gRPC server through the Go proxy', { timeout: 120_000 }, async (t) => {
  const work = mkdtempSync(join(tmpdir(), 'edge-grpc-int-'));
  const goDir = new URL('../../../packages/edge-grpc/go', import.meta.url);
  const sidecarBinary = join(work, 'edge-grpc');
  const serverBinary = join(work, 'edge-grpc-testserver');
  execFileSync('go', ['build', '-o', sidecarBinary, '.'], { cwd: goDir, timeout: 60_000 });
  execFileSync('go', ['build', '-o', serverBinary, './testserver'], { cwd: goDir, timeout: 60_000 });
  assert.match(execFileSync(sidecarBinary, ['--version'], { encoding: 'utf8' }), /edge-grpc protocol=1/);
  const contract = JSON.parse(readFileSync(new URL('../../../packages/edge-grpc/sidecar.json', import.meta.url), 'utf8'));
  assert.equal(contract.protocolVersion, 1);
  assert.equal(contract.distribution.bundledInNpmPackage, false);

  const grpcServer = spawn(serverBinary, [], { env: { ...process.env, TEST_TOKEN: 'test-token' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const serverLogs = [];
  grpcServer.stderr.on('data', (chunk) => serverLogs.push(chunk.toString('utf8')));
  const readServerLine = lineReader(grpcServer.stdout);
  const portLine = await readServerLine();
  const caLine = await readServerLine();
  const grpcPort = Number(portLine.replace('PORT=', ''));
  const caPath = caLine.replace('CA=', '');
  assert.ok(Number.isInteger(grpcPort) && grpcPort > 0, `bad server port ${portLine}`);
  const caCert = readFileSync(caPath, 'utf8');

  const sidecarPort = await freePort();
  const sidecar = spawn(sidecarBinary, [], {
    env: { ...process.env, GRPC_LISTEN_ADDR: `${HOST}:${sidecarPort}`, GRPC_TIMEOUT_MS: '5000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const sidecarLogs = [];
  sidecar.stdout.on('data', (chunk) => sidecarLogs.push(chunk.toString('utf8')));
  sidecar.stderr.on('data', (chunk) => sidecarLogs.push(chunk.toString('utf8')));
  t.after(() => {
    sidecar.kill('SIGKILL');
    grpcServer.kill('SIGKILL');
    rmSync(work, { recursive: true, force: true });
  });
  assert.ok(await waitForPort(sidecarPort), `sidecar never listened:\n${sidecarLogs.join('')}`);

  const transport = new NativeGrpcTransport({
    port: sidecarPort,
    connectTimeoutMs: 10_000,
    requestTimeoutMs: 10_000,
    tls: { caCert, serverName: 'localhost' },
    metadata: { authorization: 'test-token' },
  });
  const gateway = createGrpcGateway({ runtime: {}, client: transport, address: `${HOST}:${grpcPort}` });
  t.after(async () => { await gateway.stop().catch(() => {}); });
  await gateway.start();

  // Unary raw-byte echo.
  const unary = await gateway.call('/test.Echo/Unary', Uint8Array.of(1, 2, 3));
  assert.equal(unary.ok, true, unary.error);
  assert.deepEqual([...unary.data.payload], [1, 2, 3]);

  // Server streaming.
  const serverStreamResult = await gateway.openServerStream('/test.Echo/ServerStream', Uint8Array.of(7));
  assert.equal(serverStreamResult.ok, true, serverStreamResult.error);
  const serverStream = trackStream(serverStreamResult.data);
  await withTimeout(serverStream.ended, 3_000, 'server stream end');
  assert.deepEqual(serverStream.data, [[7, 0], [7, 1], [7, 2]]);

  // Client streaming: the single response must be delivered as stream data.
  const clientStreamResult = await gateway.openClientStream('/test.Echo/ClientStream');
  assert.equal(clientStreamResult.ok, true, clientStreamResult.error);
  const clientStream = trackStream(clientStreamResult.data);
  await clientStreamResult.data.send(Uint8Array.of(1, 1));
  await clientStreamResult.data.send(Uint8Array.of(2, 2));
  await clientStreamResult.data.send(Uint8Array.of(3, 3));
  await clientStreamResult.data.close();
  await withTimeout(clientStream.ended, 3_000, 'client stream end');
  assert.equal(Buffer.from(clientStream.data[0]).toString('utf8'), 'total=6');

  // Bidirectional streaming.
  const bidiResult = await gateway.openBidiStream('/test.Echo/Bidi');
  assert.equal(bidiResult.ok, true, bidiResult.error);
  const bidi = trackStream(bidiResult.data);
  await bidiResult.data.send(Uint8Array.of(0xaa));
  await bidiResult.data.send(Uint8Array.of(0xbb));
  await bidiResult.data.close();
  await withTimeout(bidi.ended, 3_000, 'bidi end');
  assert.deepEqual(bidi.data, [[0xaa], [0xbb]]);

  // Deadline propagation.
  const deadline = await gateway.call('/test.Echo/Slow', new Uint8Array(0), 100);
  assert.equal(deadline.ok, false);
  assert.equal(deadline.code, 4, `expected DeadlineExceeded, got ${deadline.code}: ${deadline.error}`);

  // Cancellation: close a server stream after the first notification.
  const cancelResult = await gateway.openServerStream('/test.Echo/ServerStream', Uint8Array.of(9));
  assert.equal(cancelResult.ok, true, cancelResult.error);
  const cancelled = trackStream(cancelResult.data);
  await withTimeout(new Promise((resolve) => {
    const unsubscribe = cancelResult.data.onData(() => { unsubscribe(); resolve(); });
  }), 3_000, 'first server stream message');
  await withTimeout(cancelResult.data.close(), 3_000, 'stream cancellation');

  // Metadata auth failure on a second connection.
  const unauthTransport = new NativeGrpcTransport({
    port: sidecarPort, connectTimeoutMs: 5_000, requestTimeoutMs: 5_000,
    tls: { caCert, serverName: 'localhost' },
  });
  const unauthGateway = createGrpcGateway({ runtime: {}, client: unauthTransport, address: `${HOST}:${grpcPort}` });
  t.after(async () => { await unauthGateway.stop().catch(() => {}); });
  await unauthGateway.start();
  const unauthenticated = await unauthGateway.call('/test.Echo/Unary', Uint8Array.of(1));
  assert.equal(unauthenticated.ok, false);
  assert.equal(unauthenticated.code, 16, `expected Unauthenticated, got ${unauthenticated.code}: ${unauthenticated.error}`);

  // TLS name verification failure is surfaced at connect time.
  const badTlsTransport = new NativeGrpcTransport({
    port: sidecarPort, connectTimeoutMs: 8_000,
    tls: { caCert, serverName: 'wrong.example' },
    metadata: { authorization: 'test-token' },
  });
  await assert.rejects(() => badTlsTransport.connect(`${HOST}:${grpcPort}`), /dial failed|certificate/i);
  await badTlsTransport.close().catch(() => {});

  assert.ok(!sidecarLogs.join('').includes('panic'), sidecarLogs.join(''));
  assert.ok(!serverLogs.join('').includes('panic'), serverLogs.join(''));
});
