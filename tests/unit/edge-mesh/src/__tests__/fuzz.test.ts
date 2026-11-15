/**
 * Property and fuzz tests for the edge-mesh wire format (RFC-063 P1/P2).
 *
 * This package is a parser: it accepts bytes from a radio link another party
 * controls. Two invariants matter more than any single case:
 *
 *   1. No byte sequence may throw, allocate without bound, or grow the pending
 *      table past its limit.
 *   2. Any accepted frame must reassemble to exactly what was fragmented.
 *
 * The generator is a seeded PRNG so a failure reproduces from the seed printed
 * in the assertion message.
 */

import {
  Fragmenter,
  FrameTooLargeError,
  InvalidStreamFrameError,
  MAX_PENDING_MESSAGES,
  Reassembler,
  StreamFramer,
  crc16,
  decodeHeader,
  headerRejectReason,
  makeFrame,
  type MeshRejectReason,
} from '../index.js';

/** mulberry32 — small, deterministic, good enough for byte-stream fuzzing. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bytes(next: () => number, length: number): Uint8Array {
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) out[i] = Math.floor(next() * 256);
  return out;
}

/** Build a valid packet for msgId 1, seq 0 of 1, carrying `payload`. */
function packet(payload: Uint8Array): Uint8Array {
  const head = new Uint8Array(11);
  head[0] = 0xb7;
  head[1] = 2;
  head[3] = 0;
  head[4] = 1;
  head[7] = 0;
  head[8] = 1;
  const crc = crc16(payload);
  head[9] = (crc >> 8) & 0xff;
  head[10] = crc & 0xff;
  const out = new Uint8Array(head.length + payload.length);
  out.set(head, 0);
  out.set(payload, head.length);
  return out;
}

describe('edge-mesh fuzz: hostile input never crashes or grows state', () => {
  it('decodeHeader accepts arbitrary bytes without throwing', () => {
    const next = prng(0x5eed);
    for (let i = 0; i < 5000; i++) {
      const buf = bytes(next, Math.floor(next() * 64));
      expect(() => decodeHeader(buf)).not.toThrow();
      expect(() => headerRejectReason(buf)).not.toThrow();
    }
  });

  it('Reassembler.add never throws and respects the pending limit', () => {
    const next = prng(0xf00d);
    const rejects: MeshRejectReason[] = [];
    const r = new Reassembler({ onReject: (reason) => rejects.push(reason) });

    for (let i = 0; i < 20000; i++) {
      const buf = bytes(next, Math.floor(next() * 200));
      expect(() => r.add(buf, i)).not.toThrow();
      expect(r.pending).toBeLessThanOrEqual(MAX_PENDING_MESSAGES);
    }
    // Random bytes are almost all rejected, and every rejection is reported.
    expect(rejects.length).toBeGreaterThan(0);
  });

  it('a forged total cannot make the reassembler allocate past the frame limit', () => {
    const reasons: MeshRejectReason[] = [];
    const r = new Reassembler({ onReject: (x) => reasons.push(x) });
    // 65535 fragments × 4 KiB payload would be 256 MiB if trusted.
    const head = new Uint8Array(11);
    head[0] = 0xb7; head[1] = 2;
    head[3] = 0; head[4] = 2;      // msgId 2
    head[7] = 0xff; head[8] = 0xff; // total = 65535
    for (let seq = 0; seq < 300; seq++) {
      const payload = new Uint8Array(4096).fill(seq & 0xff);
      const p = new Uint8Array(head.length + payload.length);
      p.set(head, 0);
      p[5] = (seq >> 8) & 0xff;
      p[6] = seq & 0xff;
      const crc = crc16(payload);
      p[9] = (crc >> 8) & 0xff;
      p[10] = crc & 0xff;
      p.set(payload, head.length);
      r.add(p, seq);
    }
    // Every slice past MAX_FRAME_BYTES drops the slot instead of growing it, and
    // the drop is reported. The table itself never exceeds one in-flight message.
    expect(reasons).toContain('frame-too-large');
    expect(r.pending).toBeLessThanOrEqual(1);
  });
});

describe('edge-mesh properties: accepted frames are exactly what was sent', () => {
  it('fragment → reassemble is lossless over random payloads and MTUs', () => {
    const next = prng(0xc0ffee);
    for (let i = 0; i < 300; i++) {
      const mtu = 24 + Math.floor(next() * 400);
      const length = Math.floor(next() * 4096);
      const payload = bytes(next, length);
      const packets = new Fragmenter(mtu).fragment(1 + (i % 1000), payload, i % 8);
      const r = new Reassembler();
      let assembled;
      for (const p of packets) assembled = r.add(p, i) ?? assembled;
      expect(assembled).toBeDefined();
      expect(Buffer.from(assembled!.bytes).equals(Buffer.from(payload))).toBe(true);
      expect(assembled!.hops).toBe(i % 8);
    }
  });

  it('rejects a payload bit flip via CRC', () => {
    const payload = new Uint8Array(64).fill(0x41);
    const p = packet(payload);
    p[p.length - 1] ^= 0x01;
    const reasons: MeshRejectReason[] = [];
    const r = new Reassembler({ onReject: (x) => reasons.push(x) });
    expect(r.add(p, 0)).toBeUndefined();
    expect(reasons).toContain('crc');
  });

  it('reports duplicate fragments instead of silently dropping them', () => {
    // Duplicate detection only exists while a frame is incomplete: use a
    // two-fragment frame and repeat the first fragment.
    const payload = new Uint8Array(40).fill(7);
    const packets = new Fragmenter(32).fragment(9, payload, 0);
    expect(packets.length).toBeGreaterThan(1);
    const reasons: MeshRejectReason[] = [];
    const r = new Reassembler({ onReject: (x) => reasons.push(x) });
    expect(r.add(packets[0]!, 0)).toBeUndefined();
    expect(r.add(packets[0]!, 1)).toBeUndefined();
    expect(reasons).toContain('duplicate');
    let assembled;
    for (const packet of packets.slice(1)) assembled = r.add(packet, 2) ?? assembled;
    expect(assembled?.bytes).toEqual(payload);
  });

  it('refuses a frame larger than the MTU can carry', () => {
    const f = new Fragmenter(64);
    const tooBig = new Uint8Array(f.maxFrameBytes() + 1);
    expect(() => f.fragment(1, tooBig)).toThrow(FrameTooLargeError);
  });
});

describe('stream framer fuzz', () => {
  it('arbitrary chunking yields identical frames', () => {
    const next = prng(0xbeef);
    const frames = Array.from({ length: 40 }, (_, i) => makeFrame(i & 0xff, bytes(next, Math.floor(next() * 300))));
    const wire = Buffer.concat(frames);
    const sf = new StreamFramer();
    const got: Uint8Array[] = [];
    let offset = 0;
    while (offset < wire.length) {
      const step = 1 + Math.floor(next() * 64);
      sf.push(wire.subarray(offset, offset + step));
      offset += step;
      for (;;) {
        const frame = sf.next();
        if (!frame) break;
        got.push(frame);
      }
    }
    expect(got).toHaveLength(frames.length);
    for (let i = 0; i < frames.length; i++) {
      expect(Buffer.from(got[i]).equals(Buffer.from(frames[i]))).toBe(true);
    }
  });

  it('rejects an impossible length with a typed error and resets the buffer', () => {
    const sf = new StreamFramer();
    sf.push(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
    expect(() => sf.next()).toThrow(InvalidStreamFrameError);
    expect(sf.buffered).toBe(0);
  });

  it('never throws anything but the typed error on random input', () => {
    const next = prng(0x1234);
    for (let i = 0; i < 2000; i++) {
      const sf = new StreamFramer();
      sf.push(bytes(next, 1 + Math.floor(next() * 32)));
      try {
        sf.next();
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidStreamFrameError);
      }
    }
  });
});
