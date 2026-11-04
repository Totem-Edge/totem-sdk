import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { NativeCanTransport } from '../../../packages/edge-can/dist/native-transport.js';
import { createCanGateway } from '../../../packages/edge-can/dist/gateway.js';

const linux = process.platform === 'linux';
const name = `vcan-totem${process.pid % 10000}`;
let sudo;
function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore','pipe','pipe'], ...options });
}
function canRun(command) { try { run('sh', ['-c', `command -v ${command}`]); return true; } catch { return false; } }

function unavailable(t, reason) {
  // Local machines may lack vcan/can-utils; CI must fail closed instead of
  // reporting a skipped suite as qualification evidence.
  if (process.env.CI) assert.fail(`required CAN qualification environment unavailable: ${reason}`);
  t.skip(reason);
}

test('vcan sidecar sends/receives standard and extended frames', { timeout: 60_000 }, async (t) => {
  if (!linux) { unavailable(t, 'Linux vcan required'); return; }
  if (!canRun('ip') || !canRun('cansend') || !canRun('candump') || !canRun('go')) {
    unavailable(t, 'ip/cansend/candump/go unavailable'); return;
  }
  sudo = process.getuid?.() === 0 ? '' : 'sudo';
  try {
    run('sh', ['-c', `${sudo} modprobe vcan 2>/dev/null || true`]);
    run('sh', ['-c', `${sudo} ip link add dev ${name} type vcan && ${sudo} ip link set ${name} up`]);
  } catch (error) {
    unavailable(t, `vcan unavailable: ${error.message}`); return;
  }
  const work = mkdtempSync(join(tmpdir(), 'edge-can-vcan-'));
  const binary = join(work, 'edge-can');
  const reservation = createServer();
  await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const child = spawn('go', ['build', '-o', binary, '.'], { cwd: new URL('../../../packages/edge-can/go', import.meta.url), stdio: 'pipe' });
  await new Promise((resolve, reject) => { child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`go build ${code}`))); });
  const sidecar = spawn(binary, [], { env: { ...process.env, CAN_INTERFACE: name, CAN_DEBUG: '1', CAN_LISTEN_ADDR: `127.0.0.1:${port}` }, stdio: ['ignore','pipe','pipe'] });
  let sidecarLog = '';
  sidecar.stdout.on('data', (chunk) => { sidecarLog += chunk; });
  sidecar.stderr.on('data', (chunk) => { sidecarLog += chunk; });
  t.after(async () => {
    sidecar.kill('SIGKILL');
    try { run('sh', ['-c', `${sudo} ip link delete ${name}`]); } catch {}
    rmSync(work, { recursive: true, force: true });
  });
  for (let i = 0; i < 100; i++) {
    try { run('sh', ['-c', `${sudo} ip link show ${name} >/dev/null`]); break; } catch { await delay(50); }
  }
  await delay(300);

  const proofCalls = [];
  const runtime = { deviceId: 'vcan', capabilities: {}, ports: { proof: { async createProof(p) { proofCalls.push(p); return { ok: true }; } } } };
  const transport = new NativeCanTransport({ host: '127.0.0.1', port, connectTimeoutMs: 5000, requestTimeoutMs: 5000 });
  const gateway = createCanGateway({
    runtime, transport, interfaceName: name,
    signals: [{ name: 'rpm', canId: 0x123, isExtended: false, startBit: 0, length: 16, isSigned: false, isBigEndian: false, scale: 0.5, offset: 0, unit: 'rpm' }],
  });
  t.after(async () => { await gateway.stop().catch(() => {}); });
  await gateway.start();
  await delay(300);

  // Native sidecar -> vcan -> our reader
  run('cansend', [name, '123#0500']);
  for (let i = 0; i < 40 && proofCalls.length === 0; i++) await delay(50);
  assert.ok(proofCalls.length > 0, `no frame/proof received from vcan. sidecar logs:\n${sidecarLog}`);
  assert.equal(proofCalls[0].claims[0].signals[0].value, 2.5);

  // Gateway -> sidecar -> vcan -> candump
  const dump = spawn('candump', ['-n', '1', '-T', '2000', name], { stdio: ['ignore','pipe','pipe'] });
  const output = new Promise((resolve) => { let data=''; dump.stdout.on('data', (chunk) => { data += chunk; }); dump.once('exit', () => resolve(data)); });
  await delay(200);
  await gateway.send(0x100, Uint8Array.of(0xaa, 0xbb), false);
  assert.match(await output, /100\s+\[2\]\s+AA BB/i);

  await gateway.stop();
});
