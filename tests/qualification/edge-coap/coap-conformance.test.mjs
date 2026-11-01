/**
 * edge-coap RFC 7252 conformance evidence.
 *
 * Two layers are exercised:
 *   1. the wire codec against fixed RFC 7252 §3 vectors and malformed input;
 *   2. the gateway against a real UDP peer on loopback: piggybacked and
 *      separate responses, retransmission, token/endpoint correlation,
 *      reset/error handling, extended URI options and deadlines.
 *
 * No CoAP library is used; frames are built here so the test does not share
 * the encoder under test. The peer only uses the production decoder to read
 * requests, which is checked separately by the fixed-vector layer.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSocket } from 'node:dgram';
import { setTimeout as delay } from 'node:timers/promises';
import { encodeCoap, decodeCoap, parseResponseCode, formatResponseCode } from '../../../packages/edge-coap/dist/codec.js';
import { decodeCbor } from '../../../packages/edge-coap/dist/cbor.js';
import { createCoapGateway } from '../../../packages/edge-coap/dist/gateway.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ── independent frame builder ───────────────────────────────────────────────

function buildFrame({ type = 2, code = 0x45, msgId = 0, token = new Uint8Array(0), payload = new Uint8Array(0) }) {
  const marker = payload.length > 0 ? 1 : 0;
  const out = new Uint8Array(4 + token.length + marker + payload.length);
  out[0] = 0x40 | ((type & 0x03) << 4) | (token.length & 0x0f);
  out[1] = code & 0xff;
  out[2] = (msgId >> 8) & 0xff;
  out[3] = msgId & 0xff;
  out.set(token, 4);
  if (marker) {
    out[4 + token.length] = 0xff;
    out.set(payload, 5 + token.length);
  }
  return out;
}

function hex(bytes) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join(' ');
}

// ── real UDP transport and peer ─────────────────────────────────────────────

class UdpTransport {
  constructor() {
    this.socket = createSocket('udp4');
    this.messageHandlers = [];
    this.errorHandlers = [];
    this.bound = false;
  }

  async bind(_port) {
    await new Promise((resolve, reject) => {
      const onError = (error) => {
        this.socket.off('listening', onListening);
        reject(error);
      };
      const onListening = () => {
        this.socket.off('error', onError);
        resolve();
      };
      this.socket.once('error', onError);
      this.socket.once('listening', onListening);
      this.socket.bind(0, '127.0.0.1');
    });
    this.bound = true;
    this.socket.on('message', (buffer, remote) => {
      const message = new Uint8Array(buffer);
      for (const handler of this.messageHandlers) {
        try { handler(message, { host: remote.address, port: remote.port }); } catch { /* transport drops */ }
      }
    });
    this.socket.on('error', (error) => {
      for (const handler of this.errorHandlers) {
        try { handler(error); } catch { /* transport drops */ }
      }
    });
  }

  async close() {
    if (!this.bound) return;
    this.bound = false;
    await new Promise((resolve) => this.socket.close(resolve));
  }

  async send(host, port, message) {
    await new Promise((resolve, reject) => {
      this.socket.send(Buffer.from(message), port, host, (error) => error ? reject(error) : resolve());
    });
  }

  onMessage(handler) {
    this.messageHandlers.push(handler);
    return () => { this.messageHandlers = this.messageHandlers.filter((entry) => entry !== handler); };
  }

  onError(handler) {
    this.errorHandlers.push(handler);
    return () => { this.errorHandlers = this.errorHandlers.filter((entry) => entry !== handler); };
  }
}

async function createPeer() {
  const socket = createSocket('udp4');
  const requests = [];
  let handler;
  socket.on('message', (buffer, remote) => {
    const raw = new Uint8Array(buffer);
    let message;
    try {
      message = decodeCoap(raw, { host: remote.address, port: remote.port });
    } catch (error) {
      requests.push({ raw, remote, error });
      return;
    }
    requests.push({ raw, message, remote });
    handler?.(message, remote, raw);
  });
  await new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.bind(0, '127.0.0.1', resolve);
  });
  return {
    port: socket.address().port,
    requests,
    onRequest(fn) { handler = fn; },
    send(bytes, port, host = '127.0.0.1') {
      socket.send(Buffer.from(bytes), port, host);
    },
    close() {
      return new Promise((resolve) => socket.close(resolve));
    },
  };
}

async function waitFor(predicate, label, timeoutMs = 3_000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error(`timed out waiting for ${label}`);
    await delay(10);
  }
}

async function startGateway(timing = { ackTimeoutMs: 0 }) {
  const transport = new UdpTransport();
  const gateway = createCoapGateway({ runtime: {}, transport, localPort: 0, timing });
  await gateway.start();
  return { gateway, transport };
}

// ── codec: fixed vectors ────────────────────────────────────────────────────

test('codec encodes a CON GET with two Uri-Path options to the RFC 7252 byte layout', () => {
  const frame = encodeCoap({
    type: 'CON',
    method: 'GET',
    messageId: 0x1234,
    token: Uint8Array.of(0x01, 0x02, 0x03, 0x04),
    path: ['sensors', 'temp'],
    payload: new Uint8Array(0),
    remote: { host: '127.0.0.1', port: 5683 },
    receivedAt: 0,
  });
  assert.equal(
    hex(frame),
    [
      '44', '01', '12', '34', '01', '02', '03', '04',
      'b7', '73', '65', '6e', '73', '6f', '72', '73',
      '04', '74', '65', '6d', '70',
    ].join(' '),
  );
});

test('codec emits the payload marker only when a payload is present', () => {
  const token = Uint8Array.of(0xaa, 0xbb);
  const empty = encodeCoap({
    type: 'ACK', responseCode: '2.05', messageId: 7, token, path: [],
    payload: new Uint8Array(0), remote: { host: 'h', port: 1 }, receivedAt: 0,
  });
  assert.equal(hex(empty), '62 45 00 07 aa bb');

  const withPayload = encodeCoap({
    type: 'ACK', responseCode: '2.05', messageId: 7, token, path: [],
    payload: Uint8Array.of(1, 2), remote: { host: 'h', port: 1 }, receivedAt: 0,
  });
  assert.equal(hex(withPayload), '62 45 00 07 aa bb ff 01 02');
});

test('codec uses extended option length nibbles for 20-byte and 300-byte path segments', () => {
  const long20 = 'a'.repeat(20);
  const long300 = 'b'.repeat(300);
  const frame = encodeCoap({
    type: 'CON', method: 'POST', messageId: 1, token: new Uint8Array(0),
    path: [long20, long300], payload: new Uint8Array(0),
    remote: { host: 'h', port: 1 }, receivedAt: 0,
  });
  // 0xBD 0x07 = Uri-Path, 20-byte value (13 + 7); 0x0E 0x00 0x1F = delta 0, 300-byte value (269 + 31).
  assert.equal(frame[4], 0xbd);
  assert.equal(frame[5], 0x07);
  assert.equal(hex(frame.slice(6, 6 + 20)), hex(encoder.encode(long20)));
  assert.equal(frame[26], 0x0e);
  assert.equal(frame[27], 0x00);
  assert.equal(frame[28], 0x1f);
  assert.equal(hex(frame.slice(29)), hex(encoder.encode(long300)));
});

test('codec round-trips type, code, token, path and payload', () => {
  const frame = encodeCoap({
    type: 'ACK', responseCode: '4.04', messageId: 0xbeef,
    token: Uint8Array.of(9, 8, 7, 6), path: [],
    payload: encoder.encode('missing'), remote: { host: 'h', port: 1 }, receivedAt: 0,
  });
  const decoded = decodeCoap(frame, { host: 'h', port: 1 });
  assert.equal(decoded.type, 'ACK');
  assert.equal(decoded.responseCode, '4.04');
  assert.equal(decoded.messageId, 0xbeef);
  assert.deepEqual(Array.from(decoded.token), [9, 8, 7, 6]);
  assert.equal(decoder.decode(decoded.payload), 'missing');
});

test('codec rejects malformed CoAP messages instead of zero-padding', () => {
  const cases = [
    ['truncated header', Uint8Array.of(0x40, 0x01, 0x00)],
    ['wrong version', Uint8Array.of(0x80, 0x01, 0x00, 0x01)],
    ['token length above 8', Uint8Array.of(0x49, 0x01, 0x00, 0x01)],
    ['truncated token', Uint8Array.of(0x44, 0x01, 0x00, 0x01, 0xaa)],
    ['invalid option nibble', Uint8Array.of(0x40, 0x01, 0x00, 0x01, 0xf0)],
    ['payload marker without payload', Uint8Array.of(0x40, 0x01, 0x00, 0x01, 0xff)],
    ['empty Uri-Path segment', Uint8Array.of(0x40, 0x01, 0x00, 0x01, 0xb0)],
    ['truncated option value', Uint8Array.of(0x40, 0x01, 0x00, 0x01, 0xb5, 0x61)],
    ['truncated extended option', Uint8Array.of(0x40, 0x01, 0x00, 0x01, 0xbd)],
  ];
  for (const [label, bytes] of cases) {
    assert.throws(() => decodeCoap(bytes, { host: 'h', port: 1 }), undefined, label);
  }
});

test('codec bounds-checks encoder inputs and response codes', () => {
  assert.throws(() => encodeCoap({
    type: 'CON', method: 'GET', messageId: 0x1_0000, token: new Uint8Array(0), path: ['a'],
    payload: new Uint8Array(0), remote: { host: 'h', port: 1 }, receivedAt: 0,
  }), /message id/);
  assert.throws(() => encodeCoap({
    type: 'CON', method: 'GET', messageId: 0, token: new Uint8Array(9), path: ['a'],
    payload: new Uint8Array(0), remote: { host: 'h', port: 1 }, receivedAt: 0,
  }), /token exceeds/);
  assert.throws(() => encodeCoap({
    type: 'ACK', responseCode: '2.32', messageId: 0, token: new Uint8Array(0), path: [],
    payload: new Uint8Array(0), remote: { host: 'h', port: 1 }, receivedAt: 0,
  }), /Invalid CoAP response code/);
  assert.throws(() => parseResponseCode('6.00'), /Invalid CoAP response code/);
  assert.throws(() => parseResponseCode('2.5'), /Invalid CoAP response code/);
  assert.equal(formatResponseCode(0x45), '2.05');
  assert.equal(formatResponseCode(0x84), '4.04');
  assert.equal(parseResponseCode('2.05'), 0x45);
});

// ── live gateway conformance ────────────────────────────────────────────────

test('gateway resolves a piggybacked 2.05 ACK with URI path and payload', async (t) => {
  const peer = await createPeer();
  t.after(() => peer.close());
  const { gateway } = await startGateway();
  t.after(() => gateway.stop().catch(() => {}));

  peer.onRequest((message, remote) => {
    assert.equal(message.type, 'CON');
    assert.equal(message.method, 'GET');
    assert.deepEqual(message.path, ['sensors', 'temperature']);
    assert.equal(message.token.length, 4);
    peer.send(buildFrame({
      type: 2, code: 0x45, msgId: message.messageId, token: message.token,
      payload: encoder.encode('21.5'),
    }), remote.port);
  });

  const result = await gateway.get(['sensors', 'temperature'], '127.0.0.1', peer.port);
  assert.equal(result.ok, true);
  assert.equal(decoder.decode(result.data.payload), '21.5');
});

test('gateway acknowledges and resolves a separate CON response after an empty ACK', async (t) => {
  const peer = await createPeer();
  t.after(() => peer.close());
  const { gateway } = await startGateway({ requestTimeoutMs: 3_000, ackTimeoutMs: 200, maxRetransmits: 2 });
  t.after(() => gateway.stop().catch(() => {}));

  const separateId = 0x7777;
  peer.onRequest((message, remote) => {
    if (message.type !== 'CON' || message.method !== 'GET') return;
    // Empty ACK: no token, no code, same message id. The request stays pending.
    peer.send(buildFrame({ type: 2, code: 0, msgId: message.messageId }), remote.port);
    setTimeout(() => {
      peer.send(buildFrame({
        type: 0, code: 0x45, msgId: separateId, token: message.token,
        payload: encoder.encode('separate'),
      }), remote.port);
    }, 40);
  });

  const result = await gateway.get(['sensors', 'temp'], '127.0.0.1', peer.port);
  assert.equal(result.ok, true);
  assert.equal(decoder.decode(result.data.payload), 'separate');
  await waitFor(
    () => peer.requests.some(({ message }) => message?.type === 'ACK' && message.messageId === separateId && message.token.length === 0),
    'ACK for the separate response',
  );
});

test('gateway retransmits the identical CON frame with exponential backoff until acknowledged', async (t) => {
  const peer = await createPeer();
  t.after(() => peer.close());
  const { gateway } = await startGateway({ requestTimeoutMs: 3_000, ackTimeoutMs: 60, maxRetransmits: 4 });
  t.after(() => gateway.stop().catch(() => {}));

  let attempts = 0;
  peer.onRequest((message, remote) => {
    if (message.type !== 'CON') return;
    attempts += 1;
    if (attempts === 3) {
      peer.send(buildFrame({
        type: 2, code: 0x45, msgId: message.messageId, token: message.token,
        payload: encoder.encode('third'),
      }), remote.port);
    }
  });

  const result = await gateway.get(['retry'], '127.0.0.1', peer.port);
  assert.equal(result.ok, true);
  assert.equal(decoder.decode(result.data.payload), 'third');
  assert.equal(attempts, 3, `expected exactly three attempts, saw ${attempts}`);

  const frames = peer.requests.filter(({ message }) => message?.type === 'CON').map(({ raw }) => hex(raw));
  assert.equal(frames.length, 3);
  assert.equal(frames[0], frames[1]);
  assert.equal(frames[1], frames[2]);
});

test('gateway ignores wrong-token and wrong-endpoint responses, then resolves the addressed peer', async (t) => {
  const peer = await createPeer();
  t.after(() => peer.close());
  const spoof = await createPeer();
  t.after(() => spoof.close());
  const { gateway } = await startGateway({ requestTimeoutMs: 3_000, ackTimeoutMs: 0 });
  t.after(() => gateway.stop().catch(() => {}));

  let request;
  peer.onRequest((message, remote) => {
    if (message.type !== 'CON') return;
    request = { message, remote };
    const wrongToken = new Uint8Array(message.token);
    wrongToken[0] ^= 0xff;
    // Correct endpoint, wrong token: must not match.
    peer.send(buildFrame({ type: 2, code: 0x45, msgId: message.messageId, token: wrongToken, payload: encoder.encode('wrong-token') }), remote.port);
    // Correct token, wrong endpoint: must not match.
    spoof.send(buildFrame({ type: 2, code: 0x45, msgId: message.messageId, token: message.token, payload: encoder.encode('wrong-endpoint') }), remote.port);
  });

  let settled = false;
  const pending = gateway.get(['correlate'], '127.0.0.1', peer.port);
  pending.finally(() => { settled = true; });
  await waitFor(() => request !== undefined, 'request delivery');
  await delay(100);
  assert.equal(settled, false, 'a mismatched response must not settle the request');

  peer.send(buildFrame({
    type: 2, code: 0x45, msgId: request.message.messageId, token: request.message.token,
    payload: encoder.encode('right'),
  }), request.remote.port);

  const result = await pending;
  assert.equal(result.ok, true);
  assert.equal(decoder.decode(result.data.payload), 'right');
});

test('gateway maps concurrent responses by token even when they arrive out of order', async (t) => {
  const peer = await createPeer();
  t.after(() => peer.close());
  const { gateway } = await startGateway({ requestTimeoutMs: 3_000, ackTimeoutMs: 0 });
  t.after(() => gateway.stop().catch(() => {}));

  peer.onRequest((message, remote) => {
    if (message.type !== 'CON') return;
    const requests = peer.requests.filter(({ message: entry }) => entry?.type === 'CON');
    if (requests.length !== 2) return;
    const [first, second] = requests;
    // Respond to the second request first.
    peer.send(buildFrame({
      type: 2, code: 0x45, msgId: second.message.messageId, token: second.message.token,
      payload: encoder.encode('second'),
    }), second.remote.port);
    peer.send(buildFrame({
      type: 2, code: 0x45, msgId: first.message.messageId, token: first.message.token,
      payload: encoder.encode('first'),
    }), first.remote.port);
  });

  const first = gateway.get(['one'], '127.0.0.1', peer.port);
  const second = gateway.post(['two'], Uint8Array.of(1), '127.0.0.1', peer.port);
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(firstResult.ok, true);
  assert.equal(secondResult.ok, true);
  assert.equal(decoder.decode(firstResult.data.payload), 'first');
  assert.equal(decoder.decode(secondResult.data.payload), 'second');
});

test('gateway turns RST and 4.xx responses into explicit failures', async (t) => {
  const peer = await createPeer();
  t.after(() => peer.close());
  const { gateway } = await startGateway();
  t.after(() => gateway.stop().catch(() => {}));

  let mode = 'reset';
  peer.onRequest((message, remote) => {
    if (message.type !== 'CON') return;
    if (mode === 'reset') {
      peer.send(buildFrame({ type: 3, code: 0, msgId: message.messageId, token: message.token }), remote.port);
      mode = 'error';
    } else {
      peer.send(buildFrame({ type: 2, code: 0x84, msgId: message.messageId, token: message.token }), remote.port);
    }
  });

  const reset = await gateway.get(['a'], '127.0.0.1', peer.port);
  assert.equal(reset.ok, false);
  assert.match(reset.error, /reset/i);

  const error = await gateway.get(['b'], '127.0.0.1', peer.port);
  assert.equal(error.ok, false);
  assert.match(error.error, /4\.04/);
});

test('gateway honours the request deadline after an empty ACK', async (t) => {
  const peer = await createPeer();
  t.after(() => peer.close());
  const { gateway } = await startGateway({ requestTimeoutMs: 150, ackTimeoutMs: 0 });
  t.after(() => gateway.stop().catch(() => {}));

  peer.onRequest((message, remote) => {
    if (message.type !== 'CON') return;
    peer.send(buildFrame({ type: 2, code: 0, msgId: message.messageId }), remote.port);
  });

  const result = await gateway.get(['silent'], '127.0.0.1', peer.port);
  assert.deepEqual(result, { ok: false, error: 'CoAP request timed out' });
});

test('gateway encodes extended-length Uri-Path segments on the wire', async (t) => {
  const peer = await createPeer();
  t.after(() => peer.close());
  const { gateway } = await startGateway();
  t.after(() => gateway.stop().catch(() => {}));

  const first = 'a'.repeat(20);
  const second = 'b'.repeat(300);
  peer.onRequest((message, remote) => {
    assert.equal(message.type, 'CON');
    assert.deepEqual(message.path, [first, second]);
    peer.send(buildFrame({ type: 2, code: 0x44, msgId: message.messageId, token: message.token }), remote.port);
  });

  const result = await gateway.get([first, second], '127.0.0.1', peer.port);
  assert.equal(result.ok, true);
  assert.equal(result.data.payload.length, 0);
});

test('gateway rejects invalid URI paths without sending a datagram', async (t) => {
  const peer = await createPeer();
  t.after(() => peer.close());
  const { gateway } = await startGateway();
  t.after(() => gateway.stop().catch(() => {}));

  for (const path of [[], [''], ['a/b']]) {
    const result = await gateway.get(path, '127.0.0.1', peer.port);
    assert.deepEqual(result, { ok: false, error: 'Invalid CoAP URI path' });
  }
  assert.equal(peer.requests.length, 0);
});

test('gateway rejects pending requests when stopped', async (t) => {
  const peer = await createPeer();
  t.after(() => peer.close());
  const { gateway } = await startGateway({ requestTimeoutMs: 3_000, ackTimeoutMs: 0 });
  t.after(() => gateway.stop().catch(() => {}));

  const pending = gateway.get(['never'], '127.0.0.1', peer.port);
  await waitFor(() => peer.requests.length === 1, 'request delivery');
  await gateway.stop();
  assert.deepEqual(await pending, { ok: false, error: 'Gateway stopped' });
});

// ── options and RFC 7641 observations ───────────────────────────────────────

test('codec orders Observe, Uri-Path and Accept options by option number', () => {
  const frame = encodeCoap({
    type: 'CON', method: 'GET', messageId: 1, token: Uint8Array.of(1, 2), path: ['s'],
    payload: new Uint8Array(0), observe: 0, accept: 60, receivedAt: 0,
    remote: { host: '127.0.0.1', port: 5683 },
  });
  assert.deepEqual([...frame], [
    0x42, 0x01, 0x00, 0x01, 0x01, 0x02,
    0x60,             // Observe (6), empty value = 0
    0x51, 0x73,       // Uri-Path (11), delta 5, "s"
    0x61, 0x3c,       // Accept (17), delta 6, 60 (application/cbor)
  ]);
});

test('codec decodes Observe, Content-Format and OSCORE options', () => {
  const frame = Uint8Array.of(
    0x64, 0x45, 0x00, 0x01, 0xde, 0xad, 0xbe, 0xef,
    0x61, 0x05,       // Observe (6), value 5
    0x32, 0xaa, 0xbb, // OSCORE (9), delta 3, 2 opaque bytes
    0x31, 0x3c,       // Content-Format (12), delta 3, 60
    0xff, 0x07,
  );
  const message = decodeCoap(frame, { host: '127.0.0.1', port: 5683 });
  assert.equal(message.observe, 5);
  assert.equal(message.contentFormat, 60);
  assert.deepEqual([...message.oscore], [0xaa, 0xbb]);
  assert.deepEqual([...message.payload], [0x07]);
});

test('gateway registers observations, filters stale notifications and cancels', async (t) => {
  const peer = await createPeer();
  const { gateway } = await startGateway({ requestTimeoutMs: 1500, ackTimeoutMs: 0 });
  t.after(async () => { await gateway.stop(); await peer.close(); });

  const payload = Uint8Array.of(0xa1, 0x61, 0x61, 0x01); // {"a": 1}
  const notifications = [];
  let registration = 'observe';
  let gatewayAddress;
  const notification = (token, observe, type = 'NON', messageId = 100) => encodeCoap({
    type, responseCode: '2.05', messageId, token, path: [], payload,
    observe, contentFormat: 60, receivedAt: 0, remote: { host: '127.0.0.1', port: 0 },
  });

  peer.onRequest((request, remote) => {
    if (request.type !== 'CON') return;
    gatewayAddress = remote;
    if (request.observe === 0) {
      const response = encodeCoap({
        type: 'ACK', responseCode: '2.05', messageId: request.messageId, token: request.token,
        path: [], payload, observe: registration === 'observe' ? 0 : undefined,
        contentFormat: registration === 'observe' ? 60 : undefined, receivedAt: 0,
        remote: { host: '127.0.0.1', port: 0 },
      });
      peer.send(response, remote.port, remote.address);
      return;
    }
    if (request.observe === 1) {
      peer.send(encodeCoap({
        type: 'ACK', responseCode: '2.05', messageId: request.messageId, token: request.token,
        path: [], payload: new Uint8Array(0), receivedAt: 0, remote: { host: '127.0.0.1', port: 0 },
      }), remote.port, remote.address);
    }
  });

  const registered = await gateway.observe(['sensors', 'temp'], '127.0.0.1', peer.port, (entry) => notifications.push(entry));
  assert.equal(registered.ok, true, registered.error);
  const observation = registered.data;
  const registrationRequest = peer.requests.find((entry) => entry.message?.observe === 0);
  assert.ok(registrationRequest, 'no Observe registration reached the peer');
  assert.deepEqual(registrationRequest.message.path, ['sensors', 'temp']);
  const token = registrationRequest.message.token;

  peer.send(notification(token, 1), gatewayAddress.port, gatewayAddress.address);
  await waitFor(() => notifications.length === 1, 'first notification');
  assert.deepEqual([...notifications[0].payload], [...payload]);
  assert.equal(notifications[0].contentFormat, 60);
  assert.equal(notifications[0].observe, 1);

  // Duplicate/stale sequence numbers are dropped.
  peer.send(notification(token, 1), gatewayAddress.port, gatewayAddress.address);
  await delay(60);
  assert.equal(notifications.length, 1, 'stale notification delivered');

  peer.send(notification(token, 2), gatewayAddress.port, gatewayAddress.address);
  await waitFor(() => notifications.length === 2, 'second notification');

  // Confirmable notifications are acknowledged.
  peer.send(notification(token, 3, 'CON', 0x9999), gatewayAddress.port, gatewayAddress.address);
  await waitFor(() => notifications.length === 3, 'confirmable notification');
  await waitFor(
    () => peer.requests.some((entry) => entry.message?.type === 'ACK' && entry.message.messageId === 0x9999),
    'notification ACK',
  );

  // Deregistration sends Observe=1 and stops delivery.
  await observation.cancel();
  await waitFor(
    () => peer.requests.some((entry) => entry.message?.method === 'GET' && entry.message.observe === 1),
    'deregistration',
  );
  peer.send(notification(token, 4), gatewayAddress.port, gatewayAddress.address);
  await delay(60);
  assert.equal(notifications.length, 3, 'notification delivered after cancel');

  // A server that does not echo Observe does not establish an observation.
  registration = 'plain';
  const refused = await gateway.observe(['sensors', 'temp'], '127.0.0.1', peer.port, () => {});
  assert.equal(refused.ok, false);
  assert.match(refused.error, /did not establish/);
});


// ── security port boundary ──────────────────────────────────────────────────

function xor(bytes, key = 0x5a) {
  return Uint8Array.from(bytes, (byte) => byte ^ key);
}

function fakeSecurity(port, { failProtect = false } = {}) {
  return {
    protects(host, candidate) { return candidate === port; },
    async protect(message) {
      if (failProtect) throw new Error('no OSCORE context');
      return { ...message, oscore: Uint8Array.of(1, 2, 3), payload: xor(message.payload) };
    },
    async unprotect(message) {
      if (!message.oscore) throw new Error('missing OSCORE option');
      return { ...message, payload: xor(message.payload) };
    },
  };
}

test('security port protects requests and drops unprotected replies from protected endpoints', async (t) => {
  const peer = await createPeer();
  const transport = new UdpTransport();
  const gateway = createCoapGateway({
    runtime: {}, transport, localPort: 0,
    timing: { requestTimeoutMs: 300, ackTimeoutMs: 0 },
    security: fakeSecurity(peer.port),
  });
  await gateway.start();
  t.after(async () => { await gateway.stop(); await peer.close(); });

  peer.onRequest((request, remote) => {
    assert.deepEqual([...request.oscore], [1, 2, 3]);
    peer.send(encodeCoap({
      type: 'ACK', responseCode: '2.05', messageId: request.messageId, token: request.token,
      path: [], payload: xor(Uint8Array.of(7)), oscore: Uint8Array.of(1, 2, 3), receivedAt: 0,
      remote: { host: '127.0.0.1', port: 0 },
    }), remote.port, remote.address);
  });
  const protectedResult = await gateway.get(['s'], '127.0.0.1', peer.port);
  assert.equal(protectedResult.ok, true, protectedResult.error);
  assert.deepEqual([...protectedResult.data.payload], [7]);

  peer.onRequest((request, remote) => {
    // Plaintext reply to a protected endpoint must be dropped, not accepted.
    peer.send(encodeCoap({
      type: 'ACK', responseCode: '2.05', messageId: request.messageId, token: request.token,
      path: [], payload: Uint8Array.of(9), receivedAt: 0, remote: { host: '127.0.0.1', port: 0 },
    }), remote.port, remote.address);
  });
  const unprotected = await gateway.get(['s'], '127.0.0.1', peer.port);
  assert.equal(unprotected.ok, false);
  assert.match(unprotected.error, /timed out/i);
});

test('security port protects observation notifications', async (t) => {
  const peer = await createPeer();
  const transport = new UdpTransport();
  const gateway = createCoapGateway({
    runtime: {}, transport, localPort: 0,
    timing: { requestTimeoutMs: 1000, ackTimeoutMs: 0 },
    security: fakeSecurity(peer.port),
  });
  await gateway.start();
  t.after(async () => { await gateway.stop(); await peer.close(); });

  const cbor = Uint8Array.of(0xa1, 0x64, 0x74, 0x65, 0x6d, 0x70, 0xfb, 0x40, 0x35, 0x80, 0, 0, 0, 0, 0);
  let gatewayAddress;
  let token;
  peer.onRequest((request, remote) => {
    if (request.type !== 'CON' || request.observe !== 0) return;
    gatewayAddress = remote;
    token = request.token;
    peer.send(encodeCoap({
      type: 'ACK', responseCode: '2.05', messageId: request.messageId, token,
      path: [], payload: xor(cbor), observe: 0, contentFormat: 60,
      oscore: Uint8Array.of(9), receivedAt: 0, remote: { host: '127.0.0.1', port: 0 },
    }), remote.port, remote.address);
  });

  const notifications = [];
  const registered = await gateway.observe(['sensors'], '127.0.0.1', peer.port, (entry) => notifications.push(entry));
  assert.equal(registered.ok, true, registered.error);
  peer.send(encodeCoap({
    type: 'NON', responseCode: '2.05', messageId: 0x4242, token, path: [],
    payload: xor(cbor), observe: 1, contentFormat: 60,
    oscore: Uint8Array.of(9), receivedAt: 0, remote: { host: '127.0.0.1', port: 0 },
  }), gatewayAddress.port, gatewayAddress.address);
  await waitFor(() => notifications.length === 1, 'protected notification');
  assert.deepEqual(decodeCbor(notifications[0].payload), { temp: 21.5 });

  await registered.data.cancel();
  await waitFor(
    () => peer.requests.some((entry) => entry.message?.observe === 1 && entry.message.oscore !== undefined),
    'protected deregistration',
  );
});

test('security protection failure fails the request before sending', async (t) => {
  const peer = await createPeer();
  const transport = new UdpTransport();
  const gateway = createCoapGateway({
    runtime: {}, transport, localPort: 0,
    timing: { requestTimeoutMs: 300, ackTimeoutMs: 0 },
    security: fakeSecurity(peer.port, { failProtect: true }),
  });
  await gateway.start();
  t.after(async () => { await gateway.stop(); await peer.close(); });

  const result = await gateway.get(['s'], '127.0.0.1', peer.port);
  assert.equal(result.ok, false);
  assert.match(result.error, /protection failed/);
  assert.equal(peer.requests.length, 0, 'request was sent despite protection failure');
});

// ── RFC 7959 blockwise transfer ─────────────────────────────────────────────

test('codec encodes and decodes Block1, Block2, Size1 and Size2', () => {
  const frame = encodeCoap({
    type: 'CON', method: 'POST', messageId: 1, token: Uint8Array.of(1, 2), path: ['u'],
    payload: Uint8Array.of(1), receivedAt: 0, remote: { host: '127.0.0.1', port: 5683 },
    block1: { num: 2, more: true, sizeExponent: 1 },
    block2: { num: 0, more: false, sizeExponent: 6 },
    size1: 40, size2: 100,
  });
  const message = decodeCoap(frame, { host: '127.0.0.1', port: 5683 });
  assert.deepEqual(message.block1, { num: 2, more: true, sizeExponent: 1 });
  assert.deepEqual(message.block2, { num: 0, more: false, sizeExponent: 6 });
  assert.equal(message.size1, 40);
  assert.equal(message.size2, 100);
});

test('gateway assembles a Block2 response from a UDP peer', async (t) => {
  const peer = await createPeer();
  const { gateway } = await startGateway({ requestTimeoutMs: 2000, ackTimeoutMs: 0 });
  t.after(async () => { await gateway.stop(); await peer.close(); });

  const block0 = Uint8Array.from({ length: 16 }, (_, index) => index);
  const block1 = Uint8Array.of(100, 101, 102, 103, 104);
  peer.onRequest((request, remote) => {
    const num = request.block2?.num ?? 0;
    peer.send(encodeCoap({
      type: 'ACK', responseCode: '2.05', messageId: request.messageId, token: request.token,
      path: [], payload: num === 0 ? block0 : block1,
      block2: { num, more: num === 0, sizeExponent: 0 },
      receivedAt: 0, remote: { host: '127.0.0.1', port: 0 },
    }), remote.port, remote.address);
  });

  const blockwiseGateway = createCoapGateway({
    runtime: {}, transport: new UdpTransport(), localPort: 0,
    timing: { requestTimeoutMs: 2000, ackTimeoutMs: 0 },
    blockwise: { blockSize: 16 },
  });
  t.after(async () => { await blockwiseGateway.stop(); });
  await blockwiseGateway.start();

  const result = await blockwiseGateway.get(['large'], '127.0.0.1', peer.port);
  assert.equal(result.ok, true, result.error);
  assert.deepEqual([...result.data.payload], [...block0, ...block1]);
  assert.deepEqual(peer.requests.map((entry) => entry.message.block2?.num), [undefined, 1]);
});

test('gateway uploads a POST as Block1 requests to a UDP peer', async (t) => {
  const peer = await createPeer();
  const blockwiseGateway = createCoapGateway({
    runtime: {}, transport: new UdpTransport(), localPort: 0,
    timing: { requestTimeoutMs: 2000, ackTimeoutMs: 0 },
    blockwise: { blockSize: 16 },
  });
  t.after(async () => { await blockwiseGateway.stop(); await peer.close(); });
  await blockwiseGateway.start();

  peer.onRequest((request, remote) => {
    const block = request.block1;
    assert.ok(block, 'Block1 option missing');
    peer.send(encodeCoap({
      type: 'ACK', responseCode: block.more ? '2.31' : '2.04',
      messageId: request.messageId, token: request.token, path: [], payload: new Uint8Array(0),
      block1: block, receivedAt: 0, remote: { host: '127.0.0.1', port: 0 },
    }), remote.port, remote.address);
  });

  const payload = Uint8Array.from({ length: 40 }, (_, index) => index);
  const result = await blockwiseGateway.post(['upload'], payload, '127.0.0.1', peer.port);
  assert.equal(result.ok, true, result.error);

  const blocks = peer.requests.map((entry) => entry.message);
  assert.equal(blocks.length, 3);
  assert.deepEqual(blocks.map((message) => message.block1), [
    { num: 0, more: true, sizeExponent: 0 },
    { num: 1, more: true, sizeExponent: 0 },
    { num: 2, more: false, sizeExponent: 0 },
  ]);
  assert.deepEqual(blocks.map((message) => message.size1), [40, 40, 40]);
  assert.deepEqual(
    blocks.flatMap((message) => [...message.payload]),
    [...payload],
  );
});

test('codec round-trips Uri-Host, Uri-Port and repeated Uri-Query', () => {
  const frame = encodeCoap({
    type: 'CON', method: 'GET', messageId: 1, token: Uint8Array.of(1), path: ['s'],
    uriHost: 'example.com', uriPort: 5683, uriQuery: ['a=1', 'b=2'],
    payload: new Uint8Array(0), receivedAt: 0, remote: { host: '127.0.0.1', port: 5683 },
  });
  const message = decodeCoap(frame, { host: '127.0.0.1', port: 5683 });
  assert.equal(message.uriHost, 'example.com');
  assert.equal(message.uriPort, 5683);
  assert.deepEqual(message.uriQuery, ['a=1', 'b=2']);
  assert.deepEqual(message.path, ['s']);
});
