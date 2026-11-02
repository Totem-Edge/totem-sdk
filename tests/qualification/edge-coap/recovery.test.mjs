/**
 * edge-coap recovery evidence: peer outage, sidecar crash/restart, pending
 * request failure and teardown.
 *
 * The connector does not supervise the sidecar; this proves uncertain failures
 * settle, status changes are visible and a fresh transport recovers.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createSocket } from 'node:dgram';
import { createConnection, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { NativeCoapTransport } from '../../../packages/edge-coap/dist/native-transport.js';
import { createCoapGateway } from '../../../packages/edge-coap/dist/gateway.js';

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

function parseCoap(frame) {
  const tokenLength = frame[0] & 0x0f;
  return {
    type: (frame[0] >> 4) & 0x03,
    code: frame[1],
    messageId: frame.readUInt16BE(2),
    token: Buffer.from(frame.subarray(4, 4 + tokenLength)),
  };
}

function buildResponse(request, payload = Buffer.from('ok'), code = 0x45) {
  const out = Buffer.alloc(4 + request.token.length + 1 + payload.length);
  out[0] = 0x60 | request.token.length;
  out[1] = code;
  out.writeUInt16BE(request.messageId, 2);
  request.token.copy(out, 4);
  out[4 + request.token.length] = 0xff;
  payload.copy(out, 5 + request.token.length);
  return out;
}

async function createPeer(port = 0) {
  const socket = createSocket('udp4');
  socket.on('message', (frame, remote) => {
    const request = parseCoap(frame);
    if (request.type !== 0) return;
    socket.send(buildResponse(request), remote.port, remote.address);
  });
  await new Promise((resolve) => socket.bind(port, HOST, resolve));
  return socket;
}

function startSidecar(binary, tcpPort) {
  const child = spawn(binary, [], {
    env: { ...process.env, COAP_LISTEN_ADDR: `${HOST}:${tcpPort}`, COAP_BIND_PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  child.stdout.on('data', (chunk) => logs.push(chunk.toString('utf8')));
  child.stderr.on('data', (chunk) => logs.push(chunk.toString('utf8')));
  return { child, logs };
}

test('recovers from peer outage and sidecar crash/restart', { timeout: 90_000 }, async (t) => {
  const work = mkdtempSync(join(tmpdir(), 'edge-coap-rec-'));
  const binary = join(work, 'edge-coap');
  const tcpPort = await freePort();
  execFileSync('go', ['build', '-o', binary, '.'], {
    cwd: new URL('../../../packages/edge-coap/go', import.meta.url), timeout: 60_000,
  });

  let sidecar = startSidecar(binary, tcpPort);
  t.after(() => { sidecar.child.kill('SIGKILL'); rmSync(work, { recursive: true, force: true }); });
  assert.ok(await waitForPort(tcpPort), `sidecar never listened:\n${sidecar.logs.join('')}`);

  let peer = await createPeer();
  const peerPort = peer.address().port;
  t.after(() => { try { peer.close(); } catch {} });

  const transport = new NativeCoapTransport({ port: tcpPort, connectTimeoutMs: 5_000, requestTimeoutMs: 1_000 });
  const gateway = createCoapGateway({ runtime: {}, transport, localPort: 0, timing: { requestTimeoutMs: 300, ackTimeoutMs: 0 } });
  t.after(async () => { await gateway.stop().catch(() => {}); });
  await gateway.start();

  const first = await gateway.get(['sensors'], HOST, peerPort);
  assert.equal(first.ok, true);

  // Peer outage: requests fail on the deadline, status stays usable.
  peer.close();
  const duringOutage = await gateway.get(['sensors'], HOST, peerPort);
  assert.equal(duringOutage.ok, false);
  assert.match(duringOutage.error, /timed out/i);

  // Peer restart on the same port: the existing sidecar/gateway recovers.
  peer = await createPeer(peerPort);
  t.after(() => { try { peer.close(); } catch {} });
  await delay(100);
  const afterRestart = await gateway.get(['sensors'], HOST, peerPort);
  assert.equal(afterRestart.ok, true);

  // Sidecar crash: an in-flight request settles as a failure, not a hang.
  peer.removeAllListeners('message');
  const pending = gateway.get(['sensors', 'silent'], HOST, peerPort);
  await delay(50);
  sidecar.child.kill('SIGKILL');
  const pendingResult = await pending;
  assert.equal(pendingResult.ok, false);
  assert.match(pendingResult.error, /transport error|connection closed/i);
  assert.equal(gateway.status, 'error');
  const disconnected = await gateway.get(['sensors'], HOST, peerPort);
  assert.equal(disconnected.ok, false);
  assert.match(disconnected.error, /not connected|closed|destroyed/i);
  await gateway.stop();

  // Sidecar restart: a fresh transport/gateway works again.
  sidecar = startSidecar(binary, tcpPort);
  assert.ok(await waitForPort(tcpPort), `restarted sidecar never listened:\n${sidecar.logs.join('')}`);
  peer.on('message', (frame, remote) => {
    const request = parseCoap(frame);
    if (request.type === 0) peer.send(buildResponse(request), remote.port, remote.address);
  });
  const secondTransport = new NativeCoapTransport({ port: tcpPort, connectTimeoutMs: 5_000, requestTimeoutMs: 1_000 });
  const secondGateway = createCoapGateway({ runtime: {}, transport: secondTransport, localPort: 0, timing: { requestTimeoutMs: 500, ackTimeoutMs: 0 } });
  t.after(async () => { await secondGateway.stop().catch(() => {}); });
  await secondGateway.start();
  const recovered = await secondGateway.get(['sensors'], HOST, peerPort);
  assert.equal(recovered.ok, true);
  assert.equal(secondGateway.status, 'running');

  // stop() settles a pending request instead of leaving it to the deadline.
  peer.removeAllListeners('message');
  const stuck = secondGateway.get(['sensors', 'silent'], HOST, peerPort);
  await delay(50);
  await secondGateway.stop();
  const stopped = await stuck;
  assert.equal(stopped.ok, false);
  assert.match(stopped.error, /Gateway stopped/);
});
