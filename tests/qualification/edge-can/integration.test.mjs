/**
 * edge-can integration evidence: real Go sidecar ↔ Linux vcan ↔ TypeScript port.
 *
 * Covers the qualified profile rather than a simulator-only path:
 *   - classic 11-bit and 29-bit frames over vcan
 *   - acceptance filtering before DBC decoding
 *   - gateway send observed by candump
 *   - sidecar request validation (ID, DLC/payload, open state)
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createConnection, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { NativeCanTransport } from '../../../packages/edge-can/dist/native-transport.js';
import { createCanGateway } from '../../../packages/edge-can/dist/gateway.js';

const linux = process.platform === 'linux';
const ifname = `vcan-int${process.pid % 10000}`;
let sudo;

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function has(command) {
  try { run('sh', ['-c', `command -v ${command}`]); return true; } catch { return false; }
}

function unavailable(t, reason) {
  // Local machines may lack vcan/can-utils; CI must fail closed instead of
  // reporting a skipped suite as qualification evidence.
  if (process.env.CI) assert.fail(`required CAN qualification environment unavailable: ${reason}`);
  t.skip(reason);
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function sidecarRequest(port, request) {
  const socket = createConnection({ host: '127.0.0.1', port });
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
        // Broadcast frame/error pushes can share the connection; only the
        // correlated response answers this request.
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

async function waitFor(check, timeoutMs = 5000, intervalMs = 50) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return true;
    await delay(intervalMs);
  }
  return false;
}

test('sidecar exchanges classic, extended and filtered frames over vcan', { timeout: 90_000 }, async (t) => {
  if (!linux) { unavailable(t, 'Linux vcan required'); return; }
  if (!has('ip') || !has('cansend') || !has('candump') || !has('go')) {
    unavailable(t, 'ip/cansend/candump/go unavailable');
    return;
  }
  sudo = process.getuid?.() === 0 ? '' : 'sudo';
  try {
    run('sh', ['-c', `${sudo} modprobe vcan 2>/dev/null || true`]);
    run('sh', ['-c', `${sudo} ip link add dev ${ifname} type vcan && ${sudo} ip link set ${ifname} up`]);
  } catch (error) {
    unavailable(t, `vcan unavailable: ${error.message}`);
    return;
  }
  try {
    run('sh', ['-c', `${sudo} ip link set ${ifname} mtu 16`]);
  } catch { /* default is fine for classic frames */ }

  const work = mkdtempSync(join(tmpdir(), 'edge-can-int-'));
  const binary = join(work, 'edge-can');
  const port = await freePort();
  execFileSync('go', ['build', '-o', binary, '.'], {
    cwd: new URL('../../../packages/edge-can/go', import.meta.url), timeout: 60_000,
  });
  assert.match(execFileSync(binary, ['--version'], { encoding: 'utf8' }), /edge-can protocol=1/);
  const contract = JSON.parse(readFileSync(new URL('../../../packages/edge-can/sidecar.json', import.meta.url), 'utf8'));
  assert.equal(contract.protocolVersion, 1);
  assert.equal(contract.distribution.bundledInNpmPackage, false);
  const sidecar = spawn(binary, [], {
    env: { ...process.env, CAN_INTERFACE: ifname, CAN_LISTEN_ADDR: `127.0.0.1:${port}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  sidecar.stdout.on('data', (chunk) => logs.push(chunk.toString('utf8')));
  sidecar.stderr.on('data', (chunk) => logs.push(chunk.toString('utf8')));
  t.after(async () => {
    sidecar.kill('SIGKILL');
    try { run('sh', ['-c', `${sudo} ip link delete ${ifname}`]); } catch {}
    rmSync(work, { recursive: true, force: true });
  });

  const proofCalls = [];
  const runtime = {
    deviceId: 'vcan-integration',
    capabilities: {},
    ports: { proof: { async createProof(proof) { proofCalls.push(proof); return { ok: true }; } } },
  };
  const transport = new NativeCanTransport({ port, connectTimeoutMs: 10_000, requestTimeoutMs: 5_000 });
  const gateway = createCanGateway({
    runtime,
    transport,
    interfaceName: ifname,
    filters: [{ id: 0x123 }, { id: 0x1abcdef, isExtended: true }],
    signals: [
      { name: 'rpm', canId: 0x123, isExtended: false, startBit: 0, length: 16, isSigned: false, isBigEndian: false, scale: 0.5, offset: 0, unit: 'rpm' },
      { name: 'status', canId: 0x1abcdef, isExtended: true, startBit: 0, length: 8, isSigned: false, isBigEndian: false, scale: 1, offset: 0 },
    ],
  });
  t.after(async () => { await gateway.stop().catch(() => {}); });
  await gateway.start();

  // Filtered out: a valid frame on an ID that no filter accepts.
  run('cansend', [ifname, '456#0102']);
  await delay(200);
  assert.equal(proofCalls.length, 0, 'filtered frame produced a proof');

  // Classic 11-bit frame.
  run('cansend', [ifname, '123#0500']);
  assert.ok(await waitFor(() => proofCalls.length > 0), `no proof for classic frame. sidecar logs:\n${logs.join('')}`);
  assert.equal(proofCalls[0].claims[0].signals[0].value, 2.5);

  // Extended 29-bit frame.
  run('cansend', [ifname, '01ABCDEF#7f']);
  assert.ok(await waitFor(() => proofCalls.length > 1), `no proof for extended frame. sidecar logs:\n${logs.join('')}`);
  const extendedProof = proofCalls.find((proof) => proof.claims[0].canId === 0x1abcdef);
  assert.ok(extendedProof, 'extended frame not decoded');
  assert.equal(extendedProof.claims[0].signals[0].value, 0x7f);

  // Gateway -> sidecar -> vcan, observed by candump.
  const dump = spawn('candump', ['-n', '1', '-T', '3000', ifname], { stdio: ['ignore', 'pipe', 'pipe'] });
  const dumped = new Promise((resolve) => {
    let data = '';
    dump.stdout.on('data', (chunk) => { data += chunk; });
    dump.once('exit', () => resolve(data));
  });
  await delay(300);
  await gateway.send(0x100, Uint8Array.of(0xaa, 0xbb), false);
  assert.match(await dumped, /1?00\s+\[2\]\s+AA BB/i);

  // Sidecar request validation: invalid IDs and oversized payloads fail closed.
  const badID = await sidecarRequest(port, { id: 'bad-id', type: 'send', canId: 0x800, data: '00' });
  assert.equal(badID.ok, false);
  assert.match(badID.error, /11-bit CAN ID/);
  const badExtended = await sidecarRequest(port, { id: 'bad-ext', type: 'send', canId: 0x20000000, isExtended: true, data: '00' });
  assert.equal(badExtended.ok, false);
  assert.match(badExtended.error, /29-bit CAN ID/);
  const badPayload = await sidecarRequest(port, { id: 'bad-len', type: 'send', canId: 0x100, data: '000102030405060708' });
  assert.equal(badPayload.ok, false);
  assert.match(badPayload.error, /0-8 bytes/);
  const badHex = await sidecarRequest(port, { id: 'bad-hex', type: 'send', canId: 0x100, data: 'zz' });
  assert.equal(badHex.ok, false);
  assert.match(badHex.error, /invalid hex/);
  const unknown = await sidecarRequest(port, { id: 'unknown', type: 'nope' });
  assert.equal(unknown.ok, false);
  assert.match(unknown.error, /unknown request type/);

  // The sidecar must still be healthy after rejected requests.
  run('cansend', [ifname, '123#0a00']);
  assert.ok(await waitFor(() => proofCalls.length > 2), 'sidecar stopped delivering after invalid requests');
});
