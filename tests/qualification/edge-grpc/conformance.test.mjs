/**
 * edge-grpc conformance: the JSON protocol between TypeScript and the Go proxy
 * fails closed on malformed or out-of-sequence requests.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createConnection, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

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
      const socket = createConnection({ host: HOST, port });
      await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); });
      socket.destroy();
      return true;
    } catch {
      await delay(50);
    }
  }
  return false;
}

async function sidecarRequest(port, request) {
  const socket = createConnection({ host: HOST, port });
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); });
  const response = new Promise((resolve, reject) => {
    let buffered = '';
    socket.on('data', (chunk) => {
      buffered += chunk.toString('utf8');
      let newline;
      while ((newline = buffered.indexOf('\n')) >= 0) {
        const line = buffered.slice(0, newline);
        buffered = buffered.slice(newline + 1);
        if (!line.trim()) continue;
        const message = JSON.parse(line);
        if (message.id === request.id) { resolve(message); return; }
      }
    });
    socket.once('error', reject);
    socket.once('close', () => reject(new Error('sidecar closed before responding')));
  });
  socket.write(`${JSON.stringify(request)}\n`);
  const result = await response;
  socket.destroy();
  return result;
}

test('proxy rejects malformed calls and never interprets them as success', { timeout: 60_000 }, async (t) => {
  const work = mkdtempSync(join(tmpdir(), 'edge-grpc-conf-'));
  const binary = join(work, 'edge-grpc');
  execFileSync('go', ['build', '-o', binary, '.'], {
    cwd: new URL('../../../packages/edge-grpc/go', import.meta.url), timeout: 60_000,
  });
  assert.match(execFileSync(binary, ['--version'], { encoding: 'utf8' }), /edge-grpc protocol=1/);
  const contract = JSON.parse(readFileSync(new URL('../../../packages/edge-grpc/sidecar.json', import.meta.url), 'utf8'));
  assert.equal(contract.protocolVersion, 1);
  assert.equal(contract.distribution.bundledInNpmPackage, false);

  const port = await freePort();
  const sidecar = spawn(binary, [], {
    env: { ...process.env, GRPC_LISTEN_ADDR: `${HOST}:${port}`, GRPC_TIMEOUT_MS: '500' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => { sidecar.kill('SIGKILL'); rmSync(work, { recursive: true, force: true }); });
  assert.ok(await waitForPort(port), 'sidecar never listened');

  const unaryNotConnected = await sidecarRequest(port, { id: 'a', type: 'unary', path: '/pkg.S/M', payload: 'AQI=' });
  assert.equal(unaryNotConnected.ok, false);
  assert.match(unaryNotConnected.error, /not connected/);

  const invalidPath = await sidecarRequest(port, { id: 'b', type: 'unary', path: 'pkg.S/M', payload: '' });
  assert.equal(invalidPath.ok, false);
  assert.match(invalidPath.error, /invalid gRPC method path/);

  const tooManySegments = await sidecarRequest(port, { id: 'c', type: 'unary', path: '/a/b/c', payload: '' });
  assert.equal(tooManySegments.ok, false);
  assert.match(tooManySegments.error, /invalid gRPC method path/);

  const invalidBase64 = await sidecarRequest(port, { id: 'd', type: 'unary', path: '/pkg.S/M', payload: '!!!' });
  assert.equal(invalidBase64.ok, false);
  assert.match(invalidBase64.error, /invalid base64/);

  const missingAddress = await sidecarRequest(port, { id: 'e', type: 'connect' });
  assert.equal(missingAddress.ok, false);
  assert.match(missingAddress.error, /address required/);

  const dialFailure = await sidecarRequest(port, { id: 'f', type: 'connect', address: `${HOST}:1` });
  assert.equal(dialFailure.ok, false);
  assert.match(dialFailure.error, /dial failed/);

  const unknownType = await sidecarRequest(port, { id: 'g', type: 'nope' });
  assert.equal(unknownType.ok, false);
  assert.match(unknownType.error, /unknown request type/);

  const invalidStream = await sidecarRequest(port, { id: 'h', type: 'stream_send', stream_id: 'missing', payload: '' });
  assert.equal(invalidStream.ok, false);
  assert.match(invalidStream.error, /stream not found/);

  const cancelUnknown = await sidecarRequest(port, { id: 'i', type: 'cancel_stream', stream_id: 'missing' });
  assert.equal(cancelUnknown.ok, true);

  const invalidJson = await new Promise((resolve, reject) => {
    const socket = createConnection({ host: HOST, port });
    socket.once('connect', () => socket.write('{not json}\n'));
    let buffered = '';
    socket.on('data', (chunk) => {
      buffered += chunk.toString('utf8');
      const newline = buffered.indexOf('\n');
      if (newline >= 0) { socket.destroy(); resolve(JSON.parse(buffered.slice(0, newline))); }
    });
    socket.once('error', reject);
  });
  assert.equal(invalidJson.ok, false);
  assert.match(invalidJson.error, /invalid json/);
});
