/**
 * Edge-mesh integration qualification (RFC-063 P2).
 *
 * Runs against the BUILT package, not the sources, so it proves the artifact we
 * publish: conformance vectors, a multi-hop relay with duplicate suppression and
 * a hop budget, and an independent CRC cross-check.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
  Fragmenter,
  Reassembler,
  StoreAndForward,
  VirtualLink,
  MeshError,
  FrameTooLargeError,
  MtuTooSmallError,
  InvalidStreamFrameError,
  StreamFramer,
  crc16,
} from '../../../packages/edge-mesh/dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const vectors = JSON.parse(
  readFileSync(resolve(root, 'packages/edge-mesh/test-vectors/mesh-v1.json'), 'utf8'),
);

test('conformance: crc16 vectors match', () => {
  for (const vector of vectors.crc16) {
    const data = Uint8Array.from(Buffer.from(vector.hex, 'hex'));
    assert.equal(crc16(data), vector.value, `crc16(${vector.hex})`);
  }
});

test('conformance: fragmentation vectors reproduce byte-for-byte', () => {
  for (const vector of vectors.fragmentation) {
    const frame = Uint8Array.from(Buffer.from(vector.frameHex, 'hex'));
    const packets = new Fragmenter(vector.mtu).fragment(vector.msgId, frame, vector.hops);
    assert.deepEqual(
      packets.map((p) => Buffer.from(p).toString('hex')),
      vector.packetsHex,
      `${vector.name}: fragments`,
    );

    const assembler = new Reassembler();
    let assembled;
    for (const packet of packets) assembled = assembler.add(packet, 0) ?? assembled;
    assert.ok(assembled, `${vector.name}: reassembled`);
    assert.equal(Buffer.from(assembled.bytes).toString('hex'), vector.frameHex, `${vector.name}: bytes`);
    assert.equal(assembled.hops, vector.hops, `${vector.name}: hops`);
  }
});

test('relay: two relays, duplicate suppression and a hop budget', () => {
  const aToB = new VirtualLink(96);
  const bToC = new VirtualLink(96);

  const frame = new Uint8Array(400);
  for (let i = 0; i < frame.length; i++) frame[i] = (i * 31) & 0xff;

  // Hop A → B: fragment and deliver.
  const packets = new Fragmenter(aToB.mtu).fragment(7, frame, 0);
  for (const packet of packets) aToB.send(packet);

  const store = new StoreAndForward(64 * 1024, 4, 60_000);
  const assembler = new Reassembler();
  let hops = 0;
  for (;;) {
    const packet = aToB.receive();
    if (!packet) break;
    const assembled = assembler.add(packet, 1);
    if (assembled) {
      assert.equal(Buffer.from(assembled.bytes).equals(Buffer.from(frame)), true);
      assert.equal(store.add(assembled.bytes, assembled.hops + 1, 1), true, 'accepted once');
      assert.equal(store.add(assembled.bytes, assembled.hops + 1, 1), false, 'duplicate suppressed');
      hops = assembled.hops + 1;
    }
  }
  assert.equal(hops, 1);

  // Hop B → C: re-fragment what the store released, carrying the incremented hop.
  const released = store.take(2);
  assert.equal(released.length, 1);
  for (const packet of new Fragmenter(bToC.mtu).fragment(7, released[0].frame, released[0].hops)) {
    bToC.send(packet);
  }
  const atC = new Reassembler();
  let delivered;
  for (;;) {
    const packet = bToC.receive();
    if (!packet) break;
    delivered = atC.add(packet, 2) ?? delivered;
  }
  assert.ok(delivered);
  // The relay stores/forwards with hops+1; reassembly reports the header it
  // received, so C sees 1 (B saw 0). Hop growth is the relay's job, not the
  // framer's.
  assert.equal(delivered.hops, 1);
  assert.equal(Buffer.from(delivered.bytes).equals(Buffer.from(frame)), true);

  // Hop budget: a frame already at maxHops is refused, not forwarded forever.
  const exhausted = new StoreAndForward(64 * 1024, 4, 60_000);
  assert.equal(exhausted.add(frame, 5, 0), false);
});

test('integration: the published surface exposes typed errors', () => {
  assert.ok(new FrameTooLargeError(2, 1) instanceof MeshError);
  assert.equal(new FrameTooLargeError(2, 1).code, 'frame-too-large');
  assert.equal(new MtuTooSmallError(14).code, 'mtu-too-small');
  assert.equal(new InvalidStreamFrameError(0).code, 'invalid-stream-frame');

  const framer = new StreamFramer();
  framer.push(Uint8Array.from([0, 0, 0, 0]));
  assert.throws(() => framer.next(), InvalidStreamFrameError);
});

test('integration: crc16 agrees with an independent bitwise implementation', () => {
  // CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, no reflection, xorout 0.
  const reference = (data) => {
    let crc = 0xffff;
    for (const byte of data) {
      crc ^= byte << 8;
      for (let bit = 0; bit < 8; bit++) {
        crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
      }
    }
    return crc;
  };
  let seed = 123456789;
  for (let i = 0; i < 500; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const data = Uint8Array.from({ length: seed % 64 }, () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed & 0xff;
    });
    assert.equal(crc16(data), reference(data));
  }
});
