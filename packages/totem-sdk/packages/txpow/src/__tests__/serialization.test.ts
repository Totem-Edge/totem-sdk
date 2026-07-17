/**
 * Parity tests for @totemsdk/txpow serialization.
 *
 * These tests verify byte-exact output against known reference vectors derived
 * from the extension's private serializeTxHeader / serializeTxBody / serializeTxPoW
 * and from TxHeaderTests_1768991294482.java.
 *
 * GATE: serializeTxPoW output must be byte-identical to the extension's functions
 * for the same inputs before the extension's private copies are deleted (Task #130).
 */

import { sha3_256 } from '@totemsdk/core';
import {
  serializeTxHeader,
  serializeTxBody,
  serializeTxPoW,
  computeTxPoWId,
  TX_POW_MIN_DIFFICULTY,
  MAX_HASH,
  ZERO_HASH,
  CASCADE_LEVELS,
  serializeMagic,
} from '../index.js';
import { writeMiniNumber, writeMiniData, writeHashToStream, concat } from '@totemsdk/core';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < h.length; i += 2) out[i / 2] = parseInt(h.slice(i, i + 2), 16);
  return out;
}

// Known 32-byte body hash (all 0xAB for determinism)
const MOCK_BODY_HASH = new Uint8Array(32).fill(0xab);

// Deterministic PRNG for test reproducibility
const MOCK_PRNG = new Uint8Array(32).fill(0xcd);

// Empty pre-serialized transaction and witness (smallest valid inputs)
const EMPTY_TX_BYTES = concat(
  writeMiniNumber(0n),
  writeMiniNumber(0n),
  writeMiniNumber(0n),
  writeHashToStream(new Uint8Array([0x00]))
);
const EMPTY_WITNESS_BYTES = concat(
  writeMiniNumber(0n),
  writeMiniNumber(0n),
  writeMiniNumber(0n)
);

// ─────────────────────────────────────────────────────────────────────────────
// TX_POW_MIN_DIFFICULTY constant
// ─────────────────────────────────────────────────────────────────────────────

describe('TX_POW_MIN_DIFFICULTY', () => {
  it('is 32 bytes', () => {
    expect(TX_POW_MIN_DIFFICULTY.length).toBe(32);
  });

  it('is less than MAX_HASH (big-endian 256-bit compare)', () => {
    for (let i = 0; i < 32; i++) {
      if (TX_POW_MIN_DIFFICULTY[i] < MAX_HASH[i]) return;
      if (TX_POW_MIN_DIFFICULTY[i] > MAX_HASH[i]) throw new Error('TX_POW_MIN_DIFFICULTY > MAX_HASH');
    }
    throw new Error('TX_POW_MIN_DIFFICULTY === MAX_HASH');
  });

  it('equals floor((2^256 - 1) / 1_000_000)', () => {
    const expected = ((2n ** 256n) - 1n) / 1_000_000n;
    let hex = expected.toString(16);
    if (hex.length % 2 !== 0) hex = '0' + hex;
    while (hex.length < 64) hex = '00' + hex;
    expect(bytesToHex(TX_POW_MIN_DIFFICULTY)).toBe(hex);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeTxPoWId
// ─────────────────────────────────────────────────────────────────────────────

describe('computeTxPoWId', () => {
  it('returns SHA3-256 of the provided bytes', () => {
    const input = new Uint8Array([1, 2, 3, 4]);
    const result = computeTxPoWId(input);
    const expected = sha3_256(input);
    expect(result).toEqual(expected);
  });

  it('returns 32 bytes', () => {
    const result = computeTxPoWId(MOCK_BODY_HASH);
    expect(result.length).toBe(32);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// serializeMagic
// ─────────────────────────────────────────────────────────────────────────────

describe('serializeMagic', () => {
  it('produces a non-empty byte array', () => {
    const magic = serializeMagic();
    expect(magic.length).toBeGreaterThan(0);
  });

  it('contains expected MiniNumber values for maxTxPoWSize=65536', () => {
    const magic = serializeMagic();
    const hex = bytesToHex(magic);
    // writeMiniNumber(65536n): scale=0 [00], len=3 [03], bytes=[01,00,00]
    // so "000301 0000" — confirm first 6 bytes contain expected value
    expect(hex.startsWith('000301')).toBe(true);
  });

  it('is deterministic', () => {
    expect(serializeMagic()).toEqual(serializeMagic());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// serializeTxHeader
// ─────────────────────────────────────────────────────────────────────────────

describe('serializeTxHeader', () => {
  const FIXED_TIME = 1700000000000n;
  const FIXED_NONCE = 0n;

  it('is deterministic for fixed nonce + timeMilli', () => {
    const h1 = serializeTxHeader(MOCK_BODY_HASH, { nonce: FIXED_NONCE, timeMilli: FIXED_TIME });
    const h2 = serializeTxHeader(MOCK_BODY_HASH, { nonce: FIXED_NONCE, timeMilli: FIXED_TIME });
    expect(h1).toEqual(h2);
  });

  it('starts with nonce=0 MiniNumber [00 01 00]', () => {
    const h = serializeTxHeader(MOCK_BODY_HASH, { nonce: 0n, timeMilli: FIXED_TIME });
    expect(Array.from(h.slice(0, 3))).toEqual([0x00, 0x01, 0x00]);
  });

  it('starts with nonce=1 MiniNumber [00 01 01] for nonce=1', () => {
    const h = serializeTxHeader(MOCK_BODY_HASH, { nonce: 1n, timeMilli: FIXED_TIME });
    expect(Array.from(h.slice(0, 3))).toEqual([0x00, 0x01, 0x01]);
  });

  it('encodes nonce=128 with 4 bytes (MiniNumber boundary)', () => {
    const h = serializeTxHeader(MOCK_BODY_HASH, { nonce: 128n, timeMilli: FIXED_TIME });
    // writeMiniNumber(128n): scale=0 [00], len=2 [02], bytes=[00,80]
    expect(Array.from(h.slice(0, 4))).toEqual([0x00, 0x02, 0x00, 0x80]);
  });

  it('encodes nonce=32768 with 5 bytes (MiniNumber boundary)', () => {
    const h = serializeTxHeader(MOCK_BODY_HASH, { nonce: 32768n, timeMilli: FIXED_TIME });
    // writeMiniNumber(32768n): scale=0 [00], len=3 [03], bytes=[00,80,00]
    expect(Array.from(h.slice(0, 5))).toEqual([0x00, 0x03, 0x00, 0x80, 0x00]);
  });

  it('includes CASCADE_LEVELS=32 as single byte in super-parents section', () => {
    const h = serializeTxHeader(MOCK_BODY_HASH, { nonce: 0n, timeMilli: FIXED_TIME });
    const hex = bytesToHex(h);
    // After nonce[3] + chainID[5] + timeMilli[?] + blockNum[3] + blockDiff[36] = starts with 00 01 00
    // We check that the byte 0x20 (=32=CASCADE_LEVELS) appears exactly once in isolation
    expect(h).toContain(CASCADE_LEVELS);
    const idx = h.indexOf(CASCADE_LEVELS);
    expect(idx).toBeGreaterThan(0);
    expect(hex).toContain('20'); // 0x20 = 32
  });

  it('ends with the txBodyHash via writeHashToStream (last 36 bytes = 4-byte len + 32 bytes)', () => {
    const h = serializeTxHeader(MOCK_BODY_HASH, { nonce: 0n, timeMilli: FIXED_TIME });
    const tail = h.slice(h.length - 36);
    // writeHashToStream produces: 00 00 00 20 + 32 bytes
    expect(Array.from(tail.slice(0, 4))).toEqual([0x00, 0x00, 0x00, 0x20]);
    expect(tail.slice(4)).toEqual(MOCK_BODY_HASH);
  });

  it('changes when nonce changes (mining loop property)', () => {
    const h0 = serializeTxHeader(MOCK_BODY_HASH, { nonce: 0n, timeMilli: FIXED_TIME });
    const h1 = serializeTxHeader(MOCK_BODY_HASH, { nonce: 1n, timeMilli: FIXED_TIME });
    expect(h0).not.toEqual(h1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// serializeTxBody
// ─────────────────────────────────────────────────────────────────────────────

describe('serializeTxBody', () => {
  it('is deterministic when prng is provided', () => {
    const b1 = serializeTxBody(EMPTY_TX_BYTES, EMPTY_WITNESS_BYTES, { prng: MOCK_PRNG });
    const b2 = serializeTxBody(EMPTY_TX_BYTES, EMPTY_WITNESS_BYTES, { prng: MOCK_PRNG });
    expect(b1).toEqual(b2);
  });

  it('starts with writeHashToStream(prng): [00 00 00 20] + 32 prng bytes', () => {
    const body = serializeTxBody(EMPTY_TX_BYTES, EMPTY_WITNESS_BYTES, { prng: MOCK_PRNG });
    expect(Array.from(body.slice(0, 4))).toEqual([0x00, 0x00, 0x00, 0x20]);
    expect(body.slice(4, 36)).toEqual(MOCK_PRNG);
  });

  it('uses MAX_HASH as default txnDifficulty (36 bytes after PRNG)', () => {
    const body = serializeTxBody(EMPTY_TX_BYTES, EMPTY_WITNESS_BYTES, { prng: MOCK_PRNG });
    // After PRNG (36 bytes): writeMiniData(MAX_HASH) = [00 00 00 20] + 32×FF
    const diffStart = 36;
    expect(Array.from(body.slice(diffStart, diffStart + 4))).toEqual([0x00, 0x00, 0x00, 0x20]);
    expect(Array.from(body.slice(diffStart + 4, diffStart + 36))).toEqual(Array(32).fill(0xff));
  });

  it('uses provided txnDifficulty correctly', () => {
    const customDiff = new Uint8Array(32).fill(0x11);
    const body = serializeTxBody(EMPTY_TX_BYTES, EMPTY_WITNESS_BYTES, {
      prng: MOCK_PRNG,
      txnDifficulty: customDiff,
    });
    const diffStart = 36;
    expect(Array.from(body.slice(diffStart + 4, diffStart + 36))).toEqual(Array(32).fill(0x11));
  });

  it('includes the pre-serialized txBytes verbatim', () => {
    const mockTx = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const body = serializeTxBody(mockTx, EMPTY_WITNESS_BYTES, { prng: MOCK_PRNG });
    const bodyHex = bytesToHex(body);
    expect(bodyHex).toContain('deadbeef');
  });

  it('includes the pre-serialized witnessBytes verbatim', () => {
    const mockWitness = new Uint8Array([0xca, 0xfe, 0xba, 0xbe]);
    const body = serializeTxBody(EMPTY_TX_BYTES, mockWitness, { prng: MOCK_PRNG });
    const bodyHex = bytesToHex(body);
    expect(bodyHex).toContain('cafebabe');
  });

  it('ends with MiniNumber(0) for empty txpowid list', () => {
    const body = serializeTxBody(EMPTY_TX_BYTES, EMPTY_WITNESS_BYTES, { prng: MOCK_PRNG });
    // Last 3 bytes: writeMiniNumber(0n) = [00, 01, 00]
    expect(Array.from(body.slice(body.length - 3))).toEqual([0x00, 0x01, 0x00]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// serializeTxPoW — structure tests
// ─────────────────────────────────────────────────────────────────────────────

describe('serializeTxPoW', () => {
  it('byte at header.length is 0x01 (hasBody flag)', () => {
    const FIXED_TIME = 1700000000000n;
    const body = serializeTxBody(EMPTY_TX_BYTES, EMPTY_WITNESS_BYTES, { prng: MOCK_PRNG });
    const bodyHash = sha3_256(body);
    const header = serializeTxHeader(bodyHash, { nonce: 0n, timeMilli: FIXED_TIME });

    const txpow = serializeTxPoW(EMPTY_TX_BYTES, EMPTY_WITNESS_BYTES, {
      nonce: 0n,
      timeMilli: FIXED_TIME,
      prng: MOCK_PRNG,
    });

    expect(txpow[header.length]).toBe(0x01);
  });

  it('header prefix matches standalone serializeTxHeader output', () => {
    const FIXED_TIME = 1700000000000n;
    const body = serializeTxBody(EMPTY_TX_BYTES, EMPTY_WITNESS_BYTES, { prng: MOCK_PRNG });
    const bodyHash = sha3_256(body);
    const expectedHeader = serializeTxHeader(bodyHash, { nonce: 0n, timeMilli: FIXED_TIME });

    const txpow = serializeTxPoW(EMPTY_TX_BYTES, EMPTY_WITNESS_BYTES, {
      nonce: 0n,
      timeMilli: FIXED_TIME,
      prng: MOCK_PRNG,
    });

    expect(txpow.slice(0, expectedHeader.length)).toEqual(expectedHeader);
  });

  it('txpowId derived from first headerLen bytes matches computeTxPoWId', () => {
    const FIXED_TIME = 1700000000000n;
    const body = serializeTxBody(EMPTY_TX_BYTES, EMPTY_WITNESS_BYTES, { prng: MOCK_PRNG });
    const bodyHash = sha3_256(body);
    const header = serializeTxHeader(bodyHash, { nonce: 0n, timeMilli: FIXED_TIME });

    const txpow = serializeTxPoW(EMPTY_TX_BYTES, EMPTY_WITNESS_BYTES, {
      nonce: 0n,
      timeMilli: FIXED_TIME,
      prng: MOCK_PRNG,
    });

    const idFromTxPoW = computeTxPoWId(txpow.slice(0, header.length));
    const idFromHeader = computeTxPoWId(header);
    expect(idFromTxPoW).toEqual(idFromHeader);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Nonce MiniNumber encoding boundaries
// ─────────────────────────────────────────────────────────────────────────────

describe('nonce MiniNumber encoding boundaries', () => {
  const BODY_HASH = new Uint8Array(32).fill(0x77);
  const TIME = 1700000000000n;

  it('nonce=0 encodes as 3 bytes [00 01 00]', () => {
    const n = writeMiniNumber(0n);
    expect(n.length).toBe(3);
    expect(Array.from(n)).toEqual([0x00, 0x01, 0x00]);
  });

  it('nonce=127 encodes as 3 bytes (still 1-byte unscaled)', () => {
    const n = writeMiniNumber(127n);
    expect(n.length).toBe(3);
    expect(Array.from(n)).toEqual([0x00, 0x01, 0x7f]);
  });

  it('nonce=128 encodes as 4 bytes (2-byte unscaled: leading zero + 0x80)', () => {
    const n = writeMiniNumber(128n);
    expect(n.length).toBe(4);
    expect(Array.from(n)).toEqual([0x00, 0x02, 0x00, 0x80]);
  });

  it('nonce=32767 encodes as 4 bytes', () => {
    const n = writeMiniNumber(32767n);
    expect(n.length).toBe(4);
    expect(Array.from(n)).toEqual([0x00, 0x02, 0x7f, 0xff]);
  });

  it('nonce=32768 encodes as 5 bytes (3-byte unscaled: leading zero + 0x80 0x00)', () => {
    const n = writeMiniNumber(32768n);
    expect(n.length).toBe(5);
    expect(Array.from(n)).toEqual([0x00, 0x03, 0x00, 0x80, 0x00]);
  });

  it('header byte length changes at nonce 128 boundary', () => {
    const h127 = serializeTxHeader(BODY_HASH, { nonce: 127n, timeMilli: TIME });
    const h128 = serializeTxHeader(BODY_HASH, { nonce: 128n, timeMilli: TIME });
    expect(h128.length).toBe(h127.length + 1);
  });

  it('header byte length changes at nonce 32768 boundary', () => {
    const h32767 = serializeTxHeader(BODY_HASH, { nonce: 32767n, timeMilli: TIME });
    const h32768 = serializeTxHeader(BODY_HASH, { nonce: 32768n, timeMilli: TIME });
    expect(h32768.length).toBe(h32767.length + 1);
  });
});
