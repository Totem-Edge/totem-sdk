/**
 * OSCORE (RFC 8613) conformance against the Appendix C test vectors.
 *
 * Only the client role is implemented: requests are protected with the sender
 * context; responses/notifications are verified with the recipient context.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOscoreContext } from '../../../packages/edge-coap/dist/oscore.js';
import { decodeCoap } from '../../../packages/edge-coap/dist/codec.js';

const HOST = '127.0.0.1';
const PORT = 5683;

function bytes(value) {
  return Uint8Array.from(value.toString().replace(/\s+/g, '').match(/../g).map((byte) => parseInt(byte, 16)));
}

function hex(value) {
  return Array.from(value).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function request(overrides = {}) {
  return {
    type: 'CON', method: 'GET', messageId: 0x5d1f,
    token: bytes('00003974'), path: ['tv1'], payload: new Uint8Array(0),
    remote: { host: HOST, port: PORT }, receivedAt: 0,
    ...overrides,
  };
}

const MASTER_SECRET = bytes('0102030405060708090a0b0c0d0e0f10');
const MASTER_SALT = bytes('9e7ca92223786340');

test('test vector 4: client request with an empty sender ID', async () => {
  const context = await createOscoreContext({
    masterSecret: MASTER_SECRET, masterSalt: MASTER_SALT,
    senderId: new Uint8Array(0), recipientId: bytes('01'),
    senderSequenceNumber: 20,
  });
  const protectedMessage = await context.protect(request());
  assert.equal(hex(protectedMessage.oscore), '0914');
  assert.equal(hex(protectedMessage.payload), '612f1092f1776f1c1668b3825e');
  assert.equal(protectedMessage.method, 'POST');
  assert.equal(protectedMessage.path.length, 0, 'path must move into the ciphertext');
});

test('test vector 5: client request with a one-byte sender ID and no salt', async () => {
  const context = await createOscoreContext({
    masterSecret: MASTER_SECRET, senderId: bytes('00'), recipientId: bytes('01'),
    senderSequenceNumber: 20,
  });
  const protectedMessage = await context.protect(request({ messageId: 0x71c3, token: bytes('0000b932') }));
  assert.equal(hex(protectedMessage.oscore), '091400');
  assert.equal(hex(protectedMessage.payload), '4ed339a5a379b0b8bc731fffb0');
});

test('test vector 6: client request with an ID context', async () => {
  const context = await createOscoreContext({
    masterSecret: MASTER_SECRET, masterSalt: MASTER_SALT, idContext: bytes('37cbf3210017a2d3'),
    senderId: new Uint8Array(0), recipientId: bytes('01'),
    senderSequenceNumber: 20,
  });
  const protectedMessage = await context.protect(request({ messageId: 0x2f8e, token: bytes('ef9bbf7a') }));
  assert.equal(hex(protectedMessage.oscore), '19140837cbf3210017a2d3');
  assert.equal(hex(protectedMessage.payload), '72cd7273fd331ac45cffbe55c3');
});

test('test vector 7: server response without Partial IV', async () => {
  const context = await createOscoreContext({
    masterSecret: MASTER_SECRET, masterSalt: MASTER_SALT,
    senderId: new Uint8Array(0), recipientId: bytes('01'),
    senderSequenceNumber: 20,
  });
  await context.protect(request());

  const response = decodeCoap(
    bytes('64445d1f0000397490ffdbaad1e9a7e7b2a813d3c31524378303cdafae119106'),
    { host: HOST, port: PORT },
  );
  const decrypted = await context.unprotect(response);
  assert.equal(decrypted.responseCode, '2.05');
  assert.equal(new TextDecoder().decode(decrypted.payload), 'Hello World!');
  assert.equal(decrypted.oscore, undefined);
});

test('test vector 8: server response with Partial IV and replay rejection', async () => {
  const context = await createOscoreContext({
    masterSecret: MASTER_SECRET, masterSalt: MASTER_SALT,
    senderId: new Uint8Array(0), recipientId: bytes('01'),
    senderSequenceNumber: 20,
  });
  await context.protect(request());

  const frame = bytes('64445d1f00003974920100ff4d4c13669384b67354b2b6175ff4b8658c666a6cf88e');
  const decrypted = await context.unprotect(decodeCoap(frame, { host: HOST, port: PORT }));
  assert.equal(decrypted.responseCode, '2.05');
  assert.equal(new TextDecoder().decode(decrypted.payload), 'Hello World!');

  await assert.rejects(
    () => context.unprotect(decodeCoap(frame, { host: HOST, port: PORT })),
    /replay/i,
  );
});

test('rejects a response whose authentication tag is altered', async () => {
  const context = await createOscoreContext({
    masterSecret: MASTER_SECRET, masterSalt: MASTER_SALT,
    senderId: new Uint8Array(0), recipientId: bytes('01'),
    senderSequenceNumber: 20,
  });
  await context.protect(request());

  const frame = bytes('64445d1f00003974920100ff4d4c13669384b67354b2b6175ff4b8658c666a6cf88e');
  frame[frame.length - 1] ^= 0xff;
  await assert.rejects(
    () => context.unprotect(decodeCoap(frame, { host: HOST, port: PORT })),
    /authentication failed/i,
  );
});

test('protects only configured endpoints', async () => {
  const context = await createOscoreContext({
    masterSecret: MASTER_SECRET, masterSalt: MASTER_SALT,
    senderId: new Uint8Array(0), recipientId: bytes('01'),
    endpoints: [{ host: HOST, port: PORT }],
  });
  assert.equal(context.protects(HOST, PORT), true);
  assert.equal(context.protects(HOST, PORT + 1), false);
});

test('Observe requests use the FETCH outer code', async () => {
  const context = await createOscoreContext({
    masterSecret: MASTER_SECRET, masterSalt: MASTER_SALT,
    senderId: new Uint8Array(0), recipientId: bytes('01'),
  });
  const protectedMessage = await context.protect(request({ path: ['sensors'], observe: 0 }));
  assert.equal(protectedMessage.method, 'FETCH');
  assert.equal(protectedMessage.observe, 0);
});

test('server role reproduces vector 7 from a verified request', async () => {
  const client = await createOscoreContext({
    masterSecret: MASTER_SECRET, masterSalt: MASTER_SALT,
    senderId: new Uint8Array(0), recipientId: bytes('01'),
    senderSequenceNumber: 20,
  });
  const server = await createOscoreContext({
    masterSecret: MASTER_SECRET, masterSalt: MASTER_SALT,
    senderId: bytes('01'), recipientId: new Uint8Array(0),
    senderSequenceNumber: 0,
  });

  const protectedRequest = await client.protect(request());
  const verified = await server.unprotect(protectedRequest);
  assert.equal(verified.method, 'GET');
  assert.deepEqual(verified.path, ['tv1']);

  const response = {
    ...verified,
    type: 'ACK',
    method: undefined,
    responseCode: '2.05',
    path: [],
    payload: new TextEncoder().encode('Hello World!'),
  };
  const protectedResponse = await server.protect(response);
  assert.equal(hex(protectedResponse.oscore), '');
  assert.equal(hex(protectedResponse.payload), 'dbaad1e9a7e7b2a813d3c31524378303cdafae119106');
  assert.equal(protectedResponse.responseCode, '2.04');

  const decrypted = await client.unprotect(protectedResponse);
  assert.equal(decrypted.responseCode, '2.05');
  assert.equal(new TextDecoder().decode(decrypted.payload), 'Hello World!');
});

test('server role protects a notification with a Partial IV', async () => {
  const client = await createOscoreContext({
    masterSecret: MASTER_SECRET, masterSalt: MASTER_SALT,
    senderId: new Uint8Array(0), recipientId: bytes('01'),
    senderSequenceNumber: 20,
  });
  const server = await createOscoreContext({
    masterSecret: MASTER_SECRET, masterSalt: MASTER_SALT,
    senderId: bytes('01'), recipientId: new Uint8Array(0),
    senderSequenceNumber: 0,
  });

  const protectedRequest = await client.protect(request());
  const verified = await server.unprotect(protectedRequest);
  const notification = {
    ...verified,
    type: 'NON',
    method: undefined,
    responseCode: '2.05',
    observe: 1,
    path: [],
    payload: new TextEncoder().encode('Hello World!'),
  };
  const protectedNotification = await server.protect(notification);
  // Fresh Partial IV 0x00, no kid (RFC 8613 §6.1); the inner Observe option is
  // part of the ciphertext, so this is not the option-less vector 8 response.
  assert.equal(hex(protectedNotification.oscore), '0100');
  assert.equal(protectedNotification.responseCode, '2.05');
  assert.equal(protectedNotification.observe, 1);

  const decrypted = await client.unprotect(protectedNotification);
  assert.equal(decrypted.observe, 1);
  assert.equal(new TextDecoder().decode(decrypted.payload), 'Hello World!');
});

test('Uri-Host and Uri-Port stay outer while Uri-Query is protected', async () => {
  const client = await createOscoreContext({
    masterSecret: MASTER_SECRET, masterSalt: MASTER_SALT,
    senderId: new Uint8Array(0), recipientId: bytes('01'),
  });
  const server = await createOscoreContext({
    masterSecret: MASTER_SECRET, masterSalt: MASTER_SALT,
    senderId: bytes('01'), recipientId: new Uint8Array(0),
  });

  const protectedRequest = await client.protect(request({
    path: ['sensors', 'temp'], uriHost: 'example.com', uriPort: 5683, uriQuery: ['a=1', 'b=2'],
  }));
  assert.equal(protectedRequest.uriHost, 'example.com');
  assert.equal(protectedRequest.uriPort, 5683);
  assert.deepEqual(protectedRequest.path, [], 'Uri-Path must be encrypted');

  const verified = await server.unprotect(protectedRequest);
  assert.equal(verified.uriHost, 'example.com');
  assert.equal(verified.uriPort, 5683);
  assert.deepEqual(verified.path, ['sensors', 'temp']);
  assert.deepEqual(verified.uriQuery, ['a=1', 'b=2']);
});
