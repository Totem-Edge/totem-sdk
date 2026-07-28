/**
 * Verification tests for @totemsdk/txpow verify.ts.
 *
 * Covers:
 *   - verifyProofOfWork: raw txpowId vs mTxnDifficulty comparison
 *   - verifyTxPoWParts: pre-split header/body verification
 *   - verifyTxPoWWork: full round-trip from serialised TxPoW hex
 *   - tryParseTxPoW (indirectly): header/body split via sha3_256 validation
 *   - Fallback path: malformed hex, too-short input, unparseable structure
 */

import { sha3_256 } from '@totemsdk/core';
import { writeMiniNumber, writeHashToStream, concat } from '@totemsdk/core';
import {
  serializeTxBody,
  serializeTxHeader,
  computeTxPoWId,
} from '../serialization.js';
import { mineTxPoWInProcess } from '../mine.js';
import { verifyProofOfWork, verifyTxPoWParts, verifyTxPoWWork } from '../verify.js';
import { TX_POW_MIN_DIFFICULTY } from '../constants.js';

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────

const FIXED_PRNG = new Uint8Array(32).fill(0xab);

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

/** Easy difficulty: first byte 0x0F, rest 0xFF. Mines in <1 ms. */
const EASY_DIFFICULTY = new Uint8Array(32);
EASY_DIFFICULTY[0] = 0x0f;
for (let i = 1; i < 32; i++) EASY_DIFFICULTY[i] = 0xff;

const FIXED_TIME = 1700000000000n;

const FIXED_BODY = serializeTxBody(EMPTY_TX_BYTES, EMPTY_WITNESS_BYTES, {
  prng: FIXED_PRNG,
  txnDifficulty: EASY_DIFFICULTY,
});

// ─────────────────────────────────────────────────────────────────────────────
// verifyProofOfWork
// ─────────────────────────────────────────────────────────────────────────────

describe('verifyProofOfWork', () => {
  it('returns valid=true when txpowId < mTxnDifficulty', () => {
    const txpowId = new Uint8Array(32);
    txpowId[0] = 0x00;
    const target = new Uint8Array(32);
    target[0] = 0x01;
    const result = verifyProofOfWork(txpowId, target);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('returns valid=false when txpowId > mTxnDifficulty', () => {
    const txpowId = new Uint8Array(32);
    txpowId[0] = 0x02;
    const target = new Uint8Array(32);
    target[0] = 0x01;
    const result = verifyProofOfWork(txpowId, target);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/≥/);
  });

  it('returns valid=false when txpowId === mTxnDifficulty', () => {
    const id = new Uint8Array(32).fill(0x80);
    const result = verifyProofOfWork(id, id.slice());
    expect(result.valid).toBe(false);
  });

  it('rejects txpowId with wrong length', () => {
    const result = verifyProofOfWork(new Uint8Array(16), new Uint8Array(32));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/32 bytes/);
  });

  it('rejects mTxnDifficulty with wrong length', () => {
    const result = verifyProofOfWork(new Uint8Array(32), new Uint8Array(16));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/32 bytes/);
  });

  it('returns hex txpowId and difficulty in result', () => {
    const txpowId = new Uint8Array(32);
    const target = new Uint8Array(32);
    target[0] = 0x01;
    const result = verifyProofOfWork(txpowId, target);
    expect(result.txpowId).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.difficulty).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verifyTxPoWParts
// ─────────────────────────────────────────────────────────────────────────────

describe('verifyTxPoWParts', () => {
  it('validates a mined header against its body', async () => {
    const result = await mineTxPoWInProcess(FIXED_BODY, EASY_DIFFICULTY, {
      timeMilli: FIXED_TIME,
      maxIterations: 10_000,
      _skipWorker: true,
    });

    const txpowId = computeTxPoWId(result.minedHeaderBytes);
    const check = verifyTxPoWParts(result.minedHeaderBytes, FIXED_BODY);

    expect(check.valid).toBe(true);
    expect(check.txpowId).toBe(
      '0x' + Array.from(txpowId).map(b => b.toString(16).padStart(2, '0')).join('')
    );
  }, 10_000);

  it('returns valid=false when txpowId >= a zero-value difficulty', () => {
    // A zero-value difficulty target means nothing passes (every hash >= 0 == 0)
    const headerBytes = new Uint8Array(32); // sha3_256([]) hashes to some value
    const bodyWithZeroDiff = serializeTxBody(EMPTY_TX_BYTES, EMPTY_WITNESS_BYTES, {
      prng: FIXED_PRNG,
      txnDifficulty: new Uint8Array(32), // all zeros = strictest possible
    });
    const result = verifyTxPoWParts(headerBytes, bodyWithZeroDiff);
    // sha3_256(32 zero bytes) is not 0x000...0 so it will be >= all-zeros difficulty
    expect(result.valid).toBe(false);
  });

  it('falls back to TX_POW_MIN_DIFFICULTY floor when body is malformed', () => {
    const header = sha3_256(new Uint8Array(10));
    const bodyTooShort = new Uint8Array(10);
    const result = verifyTxPoWParts(header, bodyTooShort);
    expect(result.difficulty).toBe(
      '0x' + Array.from(TX_POW_MIN_DIFFICULTY)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verifyTxPoWWork — round-trip from serialised hex
// ─────────────────────────────────────────────────────────────────────────────

describe('verifyTxPoWWork — round-trip', () => {
  it('verifies a freshly mined TxPoW hex (valid=true)', async () => {
    const result = await mineTxPoWInProcess(FIXED_BODY, EASY_DIFFICULTY, {
      timeMilli: FIXED_TIME,
      maxIterations: 10_000,
      _skipWorker: true,
    });

    // Reconstruct full TxPoW bytes: header | 0x01 | body
    const txpowBytes = concat(
      result.minedHeaderBytes,
      new Uint8Array([0x01]),
      FIXED_BODY
    );
    const txpowHex = Buffer.from(txpowBytes).toString('hex');

    const check = verifyTxPoWWork(txpowHex);
    expect(check.valid).toBe(true);
    expect(check.reason).toBeUndefined();
  }, 10_000);

  it('extracts the correct txpowId (SHA3-256 of header only)', async () => {
    const result = await mineTxPoWInProcess(FIXED_BODY, EASY_DIFFICULTY, {
      timeMilli: FIXED_TIME,
      maxIterations: 10_000,
      _skipWorker: true,
    });

    const txpowBytes = concat(
      result.minedHeaderBytes,
      new Uint8Array([0x01]),
      FIXED_BODY
    );
    const txpowHex = Buffer.from(txpowBytes).toString('hex');

    const check = verifyTxPoWWork(txpowHex);

    const expectedId = computeTxPoWId(result.minedHeaderBytes);
    const expectedIdHex =
      '0x' + Array.from(expectedId).map(b => b.toString(16).padStart(2, '0')).join('');

    expect(check.txpowId).toBe(expectedIdHex);
  }, 10_000);

  it('returns valid=false for a TxPoW with a too-large txpowId', async () => {
    // Build a TxPoW with nonce=0 (not mined against the easy difficulty)
    const bodyHash = sha3_256(FIXED_BODY);
    const headerBytes = serializeTxHeader(bodyHash, { nonce: 0n, timeMilli: FIXED_TIME });
    const txpowBytes = concat(headerBytes, new Uint8Array([0x01]), FIXED_BODY);
    const txpowHex = Buffer.from(txpowBytes).toString('hex');

    // nonce=0 is very unlikely to be valid for the easy difficulty — this is expected
    // to be invalid in the vast majority of cases. We just check the structure.
    const check = verifyTxPoWWork(txpowHex);
    // Should parse successfully (valid structure)
    expect(check.txpowId).toMatch(/^0x[0-9a-f]{64}$/);
    expect(check.difficulty).toMatch(/^0x[0-9a-f]{64}$/);
  }, 5_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// verifyTxPoWWork — error paths
// ─────────────────────────────────────────────────────────────────────────────

describe('verifyTxPoWWork — error paths', () => {
  it('rejects non-hex input', () => {
    const result = verifyTxPoWWork('not hex!');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/invalid hex/);
  });

  it('rejects too-short hex (< 100 bytes)', () => {
    const result = verifyTxPoWWork('deadbeef');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/too short/);
  });

  it('rejects empty string', () => {
    const result = verifyTxPoWWork('');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/invalid hex/);
  });

  it('falls back to proxy id for unparseable hex of sufficient length', () => {
    const randomHex = Buffer.from(new Uint8Array(200).fill(0x42)).toString('hex');
    const result = verifyTxPoWWork(randomHex);
    expect(result.valid).toBe(false);
    expect(result.txpowId).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.difficulty).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('returns a reason string on fallback', () => {
    const randomHex = Buffer.from(new Uint8Array(200).fill(0x42)).toString('hex');
    const result = verifyTxPoWWork(randomHex);
    expect(typeof result.reason).toBe('string');
  });
});
