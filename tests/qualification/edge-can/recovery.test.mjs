/**
 * edge-can recovery evidence: interface outage, sidecar crash/restart and
 * teardown against a real Linux vcan interface and the Go sidecar.
 *
 * The connector does not own process supervision; this suite proves that
 * failures surface, that pending writes fail closed, and that a fresh
 * transport/gateway recovers once the sidecar is back.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createConnection, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { NativeCanTransport } from '../../../packages/edge-can/dist/native-transport.js';
import { createCanGateway } from '../../../packages/edge-can/dist/gateway.js';

const linux = process.platform === 'linux';
const ifname = `vcan-rec${process.pid % 10000}`;
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

async function waitFor(check, timeoutMs = 5000, intervalMs = 50) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return true;
    await delay(intervalMs);
  }
  return false;
}

async function waitForPort(port, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const socket = createConnection({ host: '127.0.0.1', port });
      await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); });
      socket.destroy();
      return true;
    } catch {
      await delay(50);
    }
  }
  return false;
}

function startSidecar(binary, port, interfaceName) {
  const child = spawn(binary, [], {
    env: { ...process.env, CAN_INTERFACE: interfaceName, CAN_DEBUG: '1', CAN_LISTEN_ADDR: `127.0.0.1:${port}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  child.stdout.on('data', (chunk) => logs.push(chunk.toString('utf8')));
  child.stderr.on('data', (chunk) => logs.push(chunk.toString('utf8')));
  return { child, logs };
}

function createHarness(port, interfaceName) {
  const proofs = [];
  const runtime = {
    deviceId: 'vcan-recovery',
    capabilities: {},
    ports: { proof: { async createProof(proof) { proofs.push(proof); return { ok: true }; } } },
  };
  const transport = new NativeCanTransport({ port, connectTimeoutMs: 5000, requestTimeoutMs: 1000 });
  const gateway = createCanGateway({
    runtime,
    transport,
    interfaceName,
    signals: [{ name: 'rpm', canId: 0x123, isExtended: false, startBit: 0, length: 16, isSigned: false, isBigEndian: false, scale: 0.5, offset: 0 }],
  });
  return { proofs, gateway };
}

test('recovers from interface outage and sidecar crash/restart', { timeout: 120_000 }, async (t) => {
  if (!linux) { unavailable(t, 'Linux vcan required'); return; }
  if (!has('ip') || !has('cansend') || !has('go')) {
    unavailable(t, 'ip/cansend/go unavailable');
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
  try { run('sh', ['-c', `${sudo} ip link set ${ifname} mtu 16`]); } catch { /* classic default */ }

  const work = mkdtempSync(join(tmpdir(), 'edge-can-rec-'));
  const binary = join(work, 'edge-can');
  const port = await freePort();
  execFileSync('go', ['build', '-o', binary, '.'], {
    cwd: new URL('../../../packages/edge-can/go', import.meta.url), timeout: 60_000,
  });

  let sidecar = startSidecar(binary, port, ifname);
  t.after(async () => {
    sidecar.child.kill('SIGKILL');
    try { run('sh', ['-c', `${sudo} ip link delete ${ifname}`]); } catch {}
    rmSync(work, { recursive: true, force: true });
  });
  assert.ok(await waitForPort(port), `sidecar never listened:\n${sidecar.logs.join('')}`);

  const first = createHarness(port, ifname);
  t.after(async () => { await first.gateway.stop().catch(() => {}); });
  await first.gateway.start();
  run('cansend', [ifname, '123#0500']);
  assert.ok(await waitFor(() => first.proofs.length > 0), `initial frame not received:\n${sidecar.logs.join('')}`);

  // Interface outage: the sidecar must not spin or die and must resume reads.
  run('sh', ['-c', `${sudo} ip link set ${ifname} down`]);
  await delay(300);
  run('sh', ['-c', `${sudo} ip link set ${ifname} up`]);
  await delay(500);
  run('cansend', [ifname, '123#0a00']);
  assert.ok(await waitFor(() => first.proofs.length > 1), `no frames after link down/up:\n${sidecar.logs.join('')}`);
  assert.equal(first.gateway.status, 'running', 'gateway did not leave error state after recovery');

  // Sidecar crash: pending/subsequent writes must fail, not hang.
  sidecar.child.kill('SIGKILL');
  await waitFor(() => first.gateway.status === 'error', 3000);
  assert.equal(first.gateway.status, 'error', 'crash did not surface as an error');
  const start = Date.now();
  await assert.rejects(() => first.gateway.send(0x100, Uint8Array.of(1), false), /not connected|closed|destroyed|timed out|ECONNRESET|EPIPE/i);
  assert.ok(Date.now() - start < 3000, 'send hung instead of failing closed');
  await first.gateway.stop();

  // Restart: a fresh transport/gateway reconnects to the new sidecar.
  sidecar = startSidecar(binary, port, ifname);
  assert.ok(await waitForPort(port), `restarted sidecar never listened:\n${sidecar.logs.join('')}`);
  const second = createHarness(port, ifname);
  t.after(async () => { await second.gateway.stop().catch(() => {}); });
  await second.gateway.start();
  run('cansend', [ifname, '123#1400']);
  assert.ok(await waitFor(() => second.proofs.length > 0), `no frames after restart:\n${sidecar.logs.join('')}`);
  assert.equal(second.gateway.status, 'running');

  // Teardown is idempotent enough to call twice without hanging.
  await second.gateway.stop();
  await second.gateway.stop();
});
