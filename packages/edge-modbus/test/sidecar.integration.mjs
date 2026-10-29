import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { createConnection, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { createModbusGateway } from '../dist/index.js';

test('ESM/CJS gateways exchange real JSON-line requests with Go and a TCP device simulator', { timeout: 60_000 }, async (t) => {
  const work = mkdtempSync(join(tmpdir(), 'modbus-sidecar-test-'));
  t.after(() => rmSync(work, { recursive: true, force: true }));
  const executable = join(work, 'edge-modbus');
  execFileSync('go', ['build', '-o', executable, '.'], {
    cwd: join(dirname(fileURLToPath(import.meta.url)), '..', 'go'), timeout: 30_000,
  });

  let fault;
  let deviceRequests = 0;
  const connections = new Set();
  const device = createServer((socket) => {
    connections.add(socket);
    socket.on('error', () => {});
    socket.on('close', () => connections.delete(socket));
    let buffered = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buffered = Buffer.concat([buffered, chunk]);
      while (buffered.length >= 7 && buffered.length >= 6 + buffered.readUInt16BE(4)) {
        const size = 6 + buffered.readUInt16BE(4);
        const request = buffered.subarray(0, size);
        buffered = buffered.subarray(size);
        deviceRequests++;
        const unit = request[6];
        const fc = request[7];
        const count = request.readUInt16BE(10);
        let data;
        if (fc <= 4) {
          const byteCount = fc <= 2 ? Math.ceil(count / 8) : count * 2;
          data = Buffer.alloc(2 + byteCount);
          data[0] = fc;
          data[1] = byteCount;
          if (fc <= 2) data[2] = 5;
          else for (let i = 0; i < count; i++) data.writeUInt16BE(unit + i, 2 + i * 2);
        } else {
          data = Buffer.from(request.subarray(7, 12));
        }
        const header = Buffer.from(request.subarray(0, 7));
        const currentFault = fault;
        fault = undefined;
        if (currentFault === 'lost-ack') { socket.destroy(); return; }
        if (currentFault === 'wrong-unit') header[6]++;
        if (currentFault === 'wrong-function') data[0]++;
        if (currentFault === 'wrong-ack') data[4]++;
        if (currentFault === 'truncated-data') data = data.subarray(0, data.length - 1);
        header.writeUInt16BE(1 + data.length, 4);
        socket.write(Buffer.concat([header, data]));
      }
    });
  });
  await new Promise((resolve) => device.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    for (const socket of connections) socket.destroy();
    await new Promise((resolve) => device.close(resolve));
  });

  // Reserve a dynamic loopback port for the sidecar's JSON-line listener.
  const reservation = createServer();
  await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const child = spawn(executable, [], { env: {
    ...process.env, MODBUS_MODE: 'tcp', MODBUS_LISTEN_ADDR: `127.0.0.1:${port}`,
    MODBUS_TCP_ADDR: `127.0.0.1:${device.address().port}`, MODBUS_TIMEOUT_MS: '250',
  }, stdio: ['ignore', 'pipe', 'pipe'] });
  let diagnostics = '';
  child.stdout.on('data', (chunk) => { diagnostics += chunk; });
  child.stderr.on('data', (chunk) => { diagnostics += chunk; });
  t.after(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exit = once(child, 'exit');
    child.kill('SIGTERM');
    await exit;
  });

  let socket;
  for (let attempt = 0; attempt < 100; attempt++) {
    const candidate = createConnection({ host: '127.0.0.1', port });
    const connected = await new Promise((resolve) => {
      candidate.once('connect', () => resolve(true));
      candidate.once('error', () => resolve(false));
    });
    if (connected) { socket = candidate; break; }
    candidate.destroy();
    if (child.exitCode !== null || child.signalCode !== null) break;
    await delay(25);
  }
  assert.ok(socket, `Go sidecar did not become ready: ${diagnostics}`);
  t.after(() => socket.destroy());
  const pending = new Map();
  let lines = '';
  let nextID = 0;
  socket.on('data', (chunk) => {
    lines += chunk;
    let newline;
    while ((newline = lines.indexOf('\n')) >= 0) {
      const response = JSON.parse(lines.slice(0, newline));
      lines = lines.slice(newline + 1);
      const request = pending.get(response.id);
      if (!request) continue;
      pending.delete(response.id);
      clearTimeout(request.timeout);
      if (response.ok) request.resolve(Uint8Array.from(Buffer.from(response.frame, 'hex')));
      else request.reject(new Error(response.error));
    }
  });
  socket.on('error', () => {});
  socket.on('close', () => {
    for (const request of pending.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error('sidecar connection closed'));
    }
    pending.clear();
  });
  const transport = {
    async connect() {}, async disconnect() { socket.end(); },
    onFrame() { return () => {}; }, onError() { return () => {}; },
    async sendFrame(frame) {
      const id = String(nextID++);
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { pending.delete(id); reject(new Error('sidecar timeout')); }, 2000);
        pending.set(id, { resolve, reject, timeout });
        socket.write(JSON.stringify({ id, frame: Buffer.from(frame).toString('hex') }) + '\n');
      });
    },
  };
  const runtime = { deviceId: 'loopback-test', ports: {} };
  const gateway = createModbusGateway({ runtime, transport });
  assert.deepEqual(await gateway.readCoils(7, 10, 3), { ok: true, data: { values: [true, false, true] } });
  assert.deepEqual(await gateway.readDiscreteInputs(7, 10, 3), { ok: true, data: { values: [true, false, true] } });
  assert.deepEqual(await gateway.readHoldingRegisters(7, 10, 2), { ok: true, data: { values: [7, 8] } });
  assert.deepEqual(await gateway.readInputRegisters(9, 10, 1), { ok: true, data: { values: [9] } });
  assert.deepEqual(await gateway.writeSingleCoil(7, 10, true), { ok: true });
  assert.deepEqual(await gateway.writeSingleRegister(7, 10, 123), { ok: true });
  assert.deepEqual(await gateway.writeMultipleCoils(7, 10, [true, false]), { ok: true });
  assert.deepEqual(await gateway.writeMultipleRegisters(7, 10, [123, 456]), { ok: true });

  const require = createRequire(import.meta.url);
  const cjs = require('../dist/cjs/index.js').createModbusGateway({ runtime, transport });
  assert.deepEqual(await cjs.readHoldingRegisters(11, 0, 1), { ok: true, data: { values: [11] } });
  for (const malformed of ['wrong-unit', 'wrong-function', 'truncated-data']) {
    fault = malformed;
    assert.equal((await gateway.readHoldingRegisters(7, 0, 1)).ok, false, malformed);
  }
  for (const uncertain of ['wrong-ack', 'lost-ack']) {
    fault = uncertain;
    const before = deviceRequests;
    const result = await gateway.writeSingleRegister(7, 0, 123);
    assert.equal(result.errorCode, 'MODBUS_WRITE_OUTCOME_UNKNOWN', uncertain);
    assert.equal(deviceRequests, before + 1, 'uncertain writes must never be retried');
  }
});
