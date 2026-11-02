/**
 * edge-coap integration evidence: real Go UDP sidecar ↔ TypeScript gateway ↔ a
 * real CoAP peer on loopback.
 *
 * The peer decodes and builds frames independently of the package codec so a
 * shared encoder bug cannot make the test pass.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createSocket } from 'node:dgram';
import { createConnection, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { NativeCoapTransport } from '../../../packages/edge-coap/dist/native-transport.js';
import { createCoapGateway } from '../../../packages/edge-coap/dist/gateway.js';
import { decodeCbor } from '../../../packages/edge-coap/dist/cbor.js';

const HOST = '127.0.0.1';

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function parseCoap(frame) {
  assert.ok(frame.length >= 4, 'short CoAP frame');
  const tokenLength = frame[0] & 0x0f;
  const type = (frame[0] >> 4) & 0x03;
  const code = frame[1];
  const messageId = frame.readUInt16BE(2);
  const token = Buffer.from(frame.subarray(4, 4 + tokenLength));
  let offset = 4 + tokenLength;
  let optionNumber = 0;
  const path = [];
  let contentFormat;
  let observe;
  let block2;
  let payload = Buffer.alloc(0);
  while (offset < frame.length) {
    if (frame[offset] === 0xff) {
      offset++;
      payload = Buffer.from(frame.subarray(offset));
      break;
    }
    let delta = frame[offset] >> 4;
    let length = frame[offset] & 0x0f;
    offset++;
    if (delta === 13) { delta = frame[offset] + 13; offset++; } else if (delta === 14) { delta = frame.readUInt16BE(offset) + 269; offset += 2; }
    if (length === 13) { length = frame[offset] + 13; offset++; } else if (length === 14) { length = frame.readUInt16BE(offset) + 269; offset += 2; }
    optionNumber += delta;
    const value = frame.subarray(offset, offset + length);
    offset += length;
    if (optionNumber === 6) observe = value.length === 0 ? 0 : value.readUIntBE(0, value.length);
    if (optionNumber === 11) path.push(value.toString('utf8'));
    if (optionNumber === 12) contentFormat = value.length === 0 ? 0 : value.readUIntBE(0, value.length);
    if (optionNumber === 23) {
      const encoded = value.length === 0 ? 0 : value.readUIntBE(0, value.length);
      block2 = { num: encoded >>> 4, more: (encoded & 0x08) !== 0, sizeExponent: encoded & 0x07 };
    }
  }
  return { type, code, messageId, token, path, payload, contentFormat, observe, block2 };
}

function uintOption(value) {
  if (value === 0) return Buffer.alloc(0);
  const bytes = [];
  let remaining = value;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining = Math.floor(remaining / 256);
  }
  return Buffer.from(bytes);
}

function optionBytes(number, previous, value) {
  const delta = number - previous;
  const length = value.length;
  const deltaNibble = delta < 13 ? delta : 13;
  const lengthNibble = length < 13 ? length : length < 269 ? 13 : 14;
  const out = [(deltaNibble << 4) | lengthNibble];
  if (deltaNibble === 13) out.push(delta - 13);
  if (lengthNibble === 13) out.push(length - 13);
  else if (lengthNibble === 14) out.push((length - 269) >> 8, (length - 269) & 0xff);
  return Buffer.from([...out, ...value]);
}

function encodeBlockOption(block) {
  return ((block.num & 0xfffff) << 4) | (block.more ? 0x08 : 0) | block.sizeExponent;
}

function buildResponse(request, { type = 'ACK', code = 0x45, payload = Buffer.alloc(0), messageId = request.messageId, observe, contentFormat, block2 } = {}) {
  const typeBits = { CON: 0, NON: 1, ACK: 2, RST: 3 }[type];
  const options = [];
  let previous = 0;
  if (observe !== undefined) { options.push(optionBytes(6, previous, uintOption(observe))); previous = 6; }
  if (contentFormat !== undefined) { options.push(optionBytes(12, previous, uintOption(contentFormat))); previous = 12; }
  if (block2 !== undefined) { options.push(optionBytes(23, previous, uintOption(encodeBlockOption(block2)))); previous = 23; }
  const marker = payload.length ? 1 : 0;
  const out = Buffer.alloc(4 + request.token.length + options.reduce((n, o) => n + o.length, 0) + marker + payload.length);
  out[0] = 0x40 | (typeBits << 4) | request.token.length;
  out[1] = code;
  out.writeUInt16BE(messageId, 2);
  request.token.copy(out, 4);
  let offset = 4 + request.token.length;
  for (const option of options) { option.copy(out, offset); offset += option.length; }
  if (marker) {
    out[offset++] = 0xff;
    payload.copy(out, offset);
  }
  return out;
}

async function waitFor(check, label, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await delay(20);
  }
  throw new Error(`timed out waiting for ${label}`);
}

function emptyAck(request) {
  return Buffer.from([0x60, 0x00, (request.messageId >> 8) & 0xff, request.messageId & 0xff]);
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

test('gateway exchanges CoAP messages with a real UDP peer through the Go sidecar', { timeout: 90_000 }, async (t) => {
  const work = mkdtempSync(join(tmpdir(), 'edge-coap-int-'));
  const binary = join(work, 'edge-coap');
  const tcpPort = await freePort();
  execFileSync('go', ['build', '-o', binary, '.'], {
    cwd: new URL('../../../packages/edge-coap/go', import.meta.url), timeout: 60_000,
  });
  assert.match(execFileSync(binary, ['--version'], { encoding: 'utf8' }), /edge-coap protocol=1/);
  const contract = JSON.parse(readFileSync(new URL('../../../packages/edge-coap/sidecar.json', import.meta.url), 'utf8'));
  assert.equal(contract.protocolVersion, 1);
  assert.equal(contract.distribution.bundledInNpmPackage, false);

  const sidecar = spawn(binary, [], {
    env: { ...process.env, COAP_LISTEN_ADDR: `${HOST}:${tcpPort}`, COAP_BIND_PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  sidecar.stdout.on('data', (chunk) => logs.push(chunk.toString('utf8')));
  sidecar.stderr.on('data', (chunk) => logs.push(chunk.toString('utf8')));
  t.after(() => { sidecar.kill('SIGKILL'); rmSync(work, { recursive: true, force: true }); });
  assert.ok(await waitForPort(tcpPort), `sidecar never listened:\n${logs.join('')}`);

  const peer = createSocket('udp4');
  const received = [];
  const acks = [];
  let respond = () => {};
  peer.on('message', (frame, remote) => {
    const message = parseCoap(frame);
    if (message.type === 0) {
      received.push(message);
      respond(message, remote);
    } else {
      acks.push({ message, remote });
    }
  });
  await new Promise((resolve) => peer.bind(0, HOST, resolve));
  const peerPort = peer.address().port;
  t.after(() => peer.close());

  const transport = new NativeCoapTransport({ port: tcpPort, connectTimeoutMs: 10_000, requestTimeoutMs: 5_000 });
  const gateway = createCoapGateway({
    runtime: {}, transport, localPort: 0,
    timing: { requestTimeoutMs: 3_000, ackTimeoutMs: 0 },
    blockwise: { blockSize: 16 },
  });
  t.after(async () => { await gateway.stop().catch(() => {}); });
  await gateway.start();

  // GET: the peer replies with a piggybacked 2.05.
  respond = (request, remote) => {
    const reply = buildResponse(request, { payload: Buffer.from([21, 5]) });
    peer.send(reply, remote.port, remote.address);
  };
  const get = await gateway.get(['sensors', 'temp'], HOST, peerPort);
  assert.equal(get.ok, true);
  assert.deepEqual([...get.data.payload], [21, 5]);
  assert.deepEqual(received[0].path, ['sensors', 'temp']);
  assert.equal(received[0].code, 1);

  // POST: path and payload reach the peer unchanged.
  const post = await gateway.post(['actuators', 'pump'], Uint8Array.of(1, 2, 3), HOST, peerPort);
  assert.equal(post.ok, true);
  assert.equal(received[1].code, 2);
  assert.deepEqual(received[1].path, ['actuators', 'pump']);
  assert.deepEqual([...received[1].payload], [1, 2, 3]);

  // Error responses fail explicitly.
  respond = (request, remote) => {
    peer.send(buildResponse(request, { code: 0x84 }), remote.port, remote.address);
  };
  const notFound = await gateway.get(['missing'], HOST, peerPort);
  assert.equal(notFound.ok, false);
  assert.match(notFound.error, /4\.04/);

  // Separate response: empty ACK, then a CON response with the same token.
  respond = (request, remote) => {
    peer.send(emptyAck(request), remote.port, remote.address);
    setTimeout(() => {
      peer.send(buildResponse(request, { type: 'CON', payload: Buffer.from('later'), messageId: 0x9999 }), remote.port, remote.address);
    }, 50);
  };
  const separate = await gateway.get(['sensors', 'slow'], HOST, peerPort);
  assert.equal(separate.ok, true);
  assert.equal(Buffer.from(separate.data.payload).toString('utf8'), 'later');
  await delay(50);
  assert.ok(acks.some(({ message }) => message.type === 2 && message.code === 0 && message.messageId === 0x9999), 'gateway did not ACK the separate response');
  assert.ok(!logs.join('').includes('panic'), logs.join(''));

  // RFC 7641 observation with a CBOR payload.
  const cborPayload = Buffer.from('a16474656d70fb4035800000000000', 'hex'); // {"temp": 21.5}
  const notifications = [];
  let gatewayAddress;
  respond = (request, remote) => {
    gatewayAddress = remote;
    if (request.observe === 0) {
      peer.send(buildResponse(request, { observe: 0, contentFormat: 60, payload: cborPayload }), remote.port, remote.address);
      return;
    }
    peer.send(buildResponse(request), remote.port, remote.address);
  };
  const registered = await gateway.observe(['sensors', 'cbor'], HOST, peerPort, (entry) => notifications.push(entry));
  assert.equal(registered.ok, true, registered.error);
  assert.ok(gatewayAddress, 'observation registration never reached the peer');
  const observationToken = received[received.length - 1].token;

  peer.send(
    buildResponse({ token: observationToken, messageId: 0x7777 }, { type: 'NON', observe: 1, contentFormat: 60, payload: cborPayload }),
    gatewayAddress.port, gatewayAddress.address,
  );
  await waitFor(() => notifications.length === 1, 'observation notification');
  assert.equal(notifications[0].observe, 1);
  assert.equal(notifications[0].contentFormat, 60);
  assert.deepEqual(decodeCbor(notifications[0].payload), { temp: 21.5 });

  await registered.data.cancel();
  await delay(50);
  peer.send(
    buildResponse({ token: observationToken, messageId: 0x7778 }, { type: 'NON', observe: 2, contentFormat: 60, payload: cborPayload }),
    gatewayAddress.port, gatewayAddress.address,
  );
  await delay(80);
  assert.equal(notifications.length, 1, 'notification delivered after observation cancel');

  // RFC 7959 Block2: the sidecar must carry Block2 options and payloads through.
  const largeBlock = Buffer.alloc(16, 0x5a);
  const tailBlock = Buffer.from([1, 2, 3, 4, 5]);
  respond = (request, remote) => {
    const num = request.block2?.num ?? 0;
    peer.send(buildResponse(request, {
      payload: num === 0 ? largeBlock : tailBlock,
      block2: { num, more: num === 0, sizeExponent: 0 },
    }), remote.port, remote.address);
  };
  const large = await gateway.get(['large'], HOST, peerPort);
  assert.equal(large.ok, true, large.error);
  assert.deepEqual([...large.data.payload], [...largeBlock, ...tailBlock]);
  assert.deepEqual(received.filter((request) => request.path[0] === 'large').map((request) => request.block2?.num), [undefined, 1]);

  // Sidecar request validation: invalid targets and payloads fail closed.
  const badHost = await sidecarRequest(tcpPort, { id: 'bad-host', host: 'not-an-ip', port: peerPort, data: '44010000' });
  assert.equal(badHost.ok, false);
  assert.match(badHost.error, /invalid host/);
  const badPort = await sidecarRequest(tcpPort, { id: 'bad-port', host: HOST, port: 0, data: '44010000' });
  assert.equal(badPort.ok, false);
  assert.match(badPort.error, /invalid port/);
  const badHex = await sidecarRequest(tcpPort, { id: 'bad-hex', host: HOST, port: peerPort, data: 'zz' });
  assert.equal(badHex.ok, false);
  assert.match(badHex.error, /invalid hex/);
  const short = await sidecarRequest(tcpPort, { id: 'short', host: HOST, port: peerPort, data: '4401' });
  assert.equal(short.ok, false);
  assert.match(short.error, /at least 4 bytes/);

  // A request with no peer response times out as a failure.
  const silent = createCoapGateway({
    runtime: {},
    transport: new NativeCoapTransport({ port: tcpPort, connectTimeoutMs: 1_000, requestTimeoutMs: 1_000 }),
    localPort: 0,
    timing: { requestTimeoutMs: 150, ackTimeoutMs: 0 },
  });
  t.after(async () => { await silent.stop().catch(() => {}); });
  await silent.start();
  respond = () => {};
  const timedOut = await silent.get(['sensors', 'missing'], HOST, peerPort);
  assert.equal(timedOut.ok, false);
  assert.match(timedOut.error, /timed out/i);
});
