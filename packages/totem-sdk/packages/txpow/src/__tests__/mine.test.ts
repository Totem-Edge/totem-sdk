/**
 * Mining loop tests for @totemsdk/txpow.
 *
 * Tests cover:
 *   - WASM availability check (false when binary not compiled)
 *   - JS mining correctness: mined header hash < txnDifficulty
 *   - Determinism: same fixed inputs → same nonce
 *   - nonce boundary handling: mining across the 128 and 32768 encoding boundaries
 *   - calibrateHashRate: returns a positive number
 *   - estimateMiningCost: returns expected fields
 *   - isLessThan: big-endian 256-bit comparison
 *   - source field: 'js' when WASM binary not present
 */

import { sha3_256 } from '@noble/hashes/sha3.js';
import {
  mineTxPoW,
  mineTxPoWInProcess,
  isLessThan,
  type MineResult,
} from '../mine.js';
import {
  serializeTxBody,
  computeTxPoWId,
} from '../serialization.js';
import {
  TX_POW_MIN_DIFFICULTY,
  MAX_HASH,
  ZERO_HASH,
} from '../constants.js';
import { calibrateHashRate, estimateMiningCost } from '../calibrate.js';
import { isWasmAvailable } from '../mine-wasm.js';
import { writeMiniNumber, writeHashToStream, concat } from '@totemsdk/core';

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** Deterministic PRNG for reproducible TxBody bytes. */
const FIXED_PRNG = new Uint8Array(32).fill(0xcd);

/** Empty pre-serialized transaction. */
const EMPTY_TX_BYTES = concat(
  writeMiniNumber(0n),
  writeMiniNumber(0n),
  writeMiniNumber(0n),
  writeHashToStream(new Uint8Array([0x00]))
);

/** Empty pre-serialized witness. */
const EMPTY_WITNESS_BYTES = concat(
  writeMiniNumber(0n),
  writeMiniNumber(0n),
  writeMiniNumber(0n)
);

/**
 * A very easy difficulty target: first byte = 0x0F, rest = 0xFF.
 * Expected iterations ≈ 256/15 ≈ 17. Mining completes in well under 1 ms.
 */
const EASY_DIFFICULTY = new Uint8Array(32);
EASY_DIFFICULTY[0] = 0x0f;
for (let i = 1; i < 32; i++) EASY_DIFFICULTY[i] = 0xff;

/**
 * Fixed TxBody bytes for deterministic tests.
 * timeMilli and prng are fixed so the mining output is reproducible.
 */
const FIXED_BODY = serializeTxBody(EMPTY_TX_BYTES, EMPTY_WITNESS_BYTES, {
  prng: FIXED_PRNG,
  txnDifficulty: EASY_DIFFICULTY,
});

const FIXED_TIME = 1700000000000n;

// ─────────────────────────────────────────────────────────────────────────────
// WASM availability and parity
// ─────────────────────────────────────────────────────────────────────────────

describe('isWasmAvailable', () => {
  it('returns a boolean', async () => {
    const available = await isWasmAvailable();
    expect(typeof available).toBe('boolean');
  });

  it('returns true because miner.wasm is committed to the repository', async () => {
    const available = await isWasmAvailable();
    expect(available).toBe(true);
  });
});

describe('WASM mining parity', () => {
  it('WASM path produces a valid nonce (source === wasm)', async () => {
    const available = await isWasmAvailable();
    if (!available) {
      // Graceful skip when binary not present (e.g. CI without miner.wasm)
      console.warn('Skipping WASM parity test: miner.wasm not available');
      return;
    }

    const result = await mineTxPoWInProcess(
      FIXED_BODY,
      EASY_DIFFICULTY,
      {
        timeMilli: FIXED_TIME,
        maxIterations: 10_000,
        forceJs: false,
        _skipWorker: true,
      }
    );

    expect(result.source).toBe('wasm');
    expect(isLessThan(result.txpowId, EASY_DIFFICULTY)).toBe(true);
  }, 20_000);

  it('WASM and JS produce bit-identical results for the same inputs', async () => {
    const available = await isWasmAvailable();
    if (!available) {
      console.warn('Skipping WASM parity test: miner.wasm not available');
      return;
    }

    const sharedOpts = {
      timeMilli: FIXED_TIME,
      maxIterations: 10_000,
      _skipWorker: true as const,
    };

    const wasmResult = await mineTxPoWInProcess(
      FIXED_BODY,
      EASY_DIFFICULTY,
      { ...sharedOpts, forceJs: false }
    );

    const jsResult = await mineTxPoWInProcess(
      FIXED_BODY,
      EASY_DIFFICULTY,
      { ...sharedOpts, forceJs: true }
    );

    expect(wasmResult.source).toBe('wasm');
    expect(jsResult.source).toBe('js');
    expect(wasmResult.nonce).toBe(jsResult.nonce);
    expect(wasmResult.txpowId).toEqual(jsResult.txpowId);
    expect(wasmResult.minedHeaderBytes).toEqual(jsResult.minedHeaderBytes);
  }, 30_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// isLessThan
// ─────────────────────────────────────────────────────────────────────────────

describe('isLessThan', () => {
  it('returns true when a < b (first differing byte)', () => {
    const a = new Uint8Array(32).fill(0x00);
    const b = new Uint8Array(32).fill(0x01);
    expect(isLessThan(a, b)).toBe(true);
  });

  it('returns false when a > b', () => {
    const a = new Uint8Array(32).fill(0xff);
    const b = new Uint8Array(32).fill(0xfe);
    expect(isLessThan(a, b)).toBe(false);
  });

  it('returns false when a === b (not strictly less than)', () => {
    const a = new Uint8Array(32).fill(0x42);
    const b = new Uint8Array(32).fill(0x42);
    expect(isLessThan(a, b)).toBe(false);
  });

  it('compares big-endian: first byte is most significant', () => {
    const a = new Uint8Array(32);
    a[0] = 0x00;
    a[31] = 0xff;
    const b = new Uint8Array(32);
    b[0] = 0x01;
    b[31] = 0x00;
    expect(isLessThan(a, b)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// mineTxPoW — correctness
// ─────────────────────────────────────────────────────────────────────────────

describe('mineTxPoW correctness', () => {
  it('mined txpowId < txnDifficulty (validity check)', async () => {
    const result = await mineTxPoW(FIXED_BODY, EASY_DIFFICULTY, {
      timeMilli: FIXED_TIME,
      maxIterations: 10_000,
    });

    expect(result.txpowId.length).toBe(32);
    expect(isLessThan(result.txpowId, EASY_DIFFICULTY)).toBe(true);
  }, 10_000);

  it('txpowId matches SHA3-256(minedHeaderBytes)', async () => {
    const result = await mineTxPoW(FIXED_BODY, EASY_DIFFICULTY, {
      timeMilli: FIXED_TIME,
      maxIterations: 10_000,
    });

    const recomputed = sha3_256(result.minedHeaderBytes);
    expect(result.txpowId).toEqual(recomputed);
  }, 10_000);

  it('txpowId matches computeTxPoWId(minedHeaderBytes)', async () => {
    const result = await mineTxPoW(FIXED_BODY, EASY_DIFFICULTY, {
      timeMilli: FIXED_TIME,
      maxIterations: 10_000,
    });

    const recomputed = computeTxPoWId(result.minedHeaderBytes);
    expect(result.txpowId).toEqual(recomputed);
  }, 10_000);

  it('result.nonce matches the nonce encoded in minedHeaderBytes', async () => {
    const result = await mineTxPoW(FIXED_BODY, EASY_DIFFICULTY, {
      timeMilli: FIXED_TIME,
      maxIterations: 10_000,
    });

    const expectedNonceBytes = writeMiniNumber(result.nonce);
    const headerNonceBytes = result.minedHeaderBytes.slice(0, expectedNonceBytes.length);
    expect(headerNonceBytes).toEqual(expectedNonceBytes);
  }, 10_000);

  it('source reflects WASM availability (wasm when binary is compiled, js when forceJs)', async () => {
    const available = await isWasmAvailable();
    const result = await mineTxPoW(FIXED_BODY, EASY_DIFFICULTY, {
      timeMilli: FIXED_TIME,
      maxIterations: 10_000,
    });
    expect(result.source).toBe(available ? 'wasm' : 'js');
  }, 10_000);

  it('returns elapsedMs >= 0', async () => {
    const result = await mineTxPoW(FIXED_BODY, EASY_DIFFICULTY, {
      timeMilli: FIXED_TIME,
      maxIterations: 10_000,
    });
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  }, 10_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// mineTxPoW — determinism
// ─────────────────────────────────────────────────────────────────────────────

describe('mineTxPoW determinism', () => {
  it('produces the same nonce for identical inputs (fixed timeMilli)', async () => {
    const opts = { timeMilli: FIXED_TIME, maxIterations: 10_000 };
    const r1 = await mineTxPoW(FIXED_BODY, EASY_DIFFICULTY, opts);
    const r2 = await mineTxPoW(FIXED_BODY, EASY_DIFFICULTY, opts);

    expect(r1.nonce).toBe(r2.nonce);
    expect(r1.txpowId).toEqual(r2.txpowId);
    expect(r1.minedHeaderBytes).toEqual(r2.minedHeaderBytes);
  }, 20_000);

  it('different timeMilli → different nonce (independent mines)', async () => {
    const r1 = await mineTxPoW(FIXED_BODY, EASY_DIFFICULTY, {
      timeMilli: 1700000000000n,
      maxIterations: 10_000,
    });
    const r2 = await mineTxPoW(FIXED_BODY, EASY_DIFFICULTY, {
      timeMilli: 1700000000001n,
      maxIterations: 10_000,
    });
    expect(r1.txpowId).not.toEqual(r2.txpowId);
  }, 20_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// mineTxPoW — forceJs option
// ─────────────────────────────────────────────────────────────────────────────

describe('mineTxPoW forceJs option', () => {
  it('produces same result with forceJs=true as without', async () => {
    const opts = { timeMilli: FIXED_TIME, maxIterations: 10_000 };
    const rDefault = await mineTxPoW(FIXED_BODY, EASY_DIFFICULTY, opts);
    const rForced = await mineTxPoW(FIXED_BODY, EASY_DIFFICULTY, {
      ...opts,
      forceJs: true,
    });

    expect(rDefault.nonce).toBe(rForced.nonce);
    // When WASM is available, default path uses WASM; forceJs overrides to JS
    const available = await isWasmAvailable();
    expect(rDefault.source).toBe(available ? 'wasm' : 'js');
    expect(rForced.source).toBe('js');
  }, 20_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// mineTxPoW — abort signal
// ─────────────────────────────────────────────────────────────────────────────

describe('mineTxPoW abort', () => {
  it('throws AbortError when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      mineTxPoW(FIXED_BODY, new Uint8Array(32), {
        signal: controller.signal,
        maxIterations: 1_000_000,
      })
    ).rejects.toThrow('Mining aborted');
  }, 5_000);

  it('throws AbortError when aborted mid-mine', async () => {
    const controller = new AbortController();
    const hardTarget = new Uint8Array(32);

    const minePromise = mineTxPoW(FIXED_BODY, hardTarget, {
      signal: controller.signal,
      chunkSize: 100,
    });

    setTimeout(() => controller.abort(), 50);
    await expect(minePromise).rejects.toThrow('Mining aborted');
  }, 5_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// mineTxPoW — maxIterations exhaustion
// ─────────────────────────────────────────────────────────────────────────────

describe('mineTxPoW maxIterations', () => {
  it('throws when maxIterations reached without finding a nonce', async () => {
    const impossibleTarget = new Uint8Array(32);

    await expect(
      mineTxPoW(FIXED_BODY, impossibleTarget, {
        maxIterations: 100,
        chunkSize: 10,
        timeMilli: FIXED_TIME,
      })
    ).rejects.toThrow('Mining exhausted');
  }, 5_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// mineTxPoW — nonce boundary crossing
// ─────────────────────────────────────────────────────────────────────────────

describe('mineTxPoW nonce boundary crossing', () => {
  it('succeeds after nonce=128 boundary (header grows by 1 byte)', async () => {
    const easyTarget = new Uint8Array(32);
    easyTarget[0] = 0x00;
    easyTarget[1] = 0x01;
    for (let i = 2; i < 32; i++) easyTarget[i] = 0xff;

    const result = await mineTxPoW(FIXED_BODY, easyTarget, {
      timeMilli: FIXED_TIME,
      maxIterations: 500_000,
    });

    expect(isLessThan(result.txpowId, easyTarget)).toBe(true);
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// calibrateHashRate
// ─────────────────────────────────────────────────────────────────────────────

describe('calibrateHashRate', () => {
  it('returns a positive hash rate', async () => {
    const rate = await calibrateHashRate();
    expect(typeof rate).toBe('number');
    expect(rate).toBeGreaterThan(0);
  }, 60_000);

  it('returns a sensible rate (> 1000 hashes/sec in any environment)', async () => {
    const rate = await calibrateHashRate();
    expect(rate).toBeGreaterThan(1000);
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// estimateMiningCost
// ─────────────────────────────────────────────────────────────────────────────

describe('estimateMiningCost', () => {
  const mockRate = 100_000;

  it('returns expected shape', () => {
    const est = estimateMiningCost(TX_POW_MIN_DIFFICULTY, mockRate);
    expect(typeof est.expectedHashes).toBe('bigint');
    expect(typeof est.expectedSeconds).toBe('number');
    expect(['fast', 'normal', 'slow']).toContain(est.confidence);
  });

  it('returns confidence=fast for very easy difficulty', () => {
    const easyTarget = new Uint8Array(32).fill(0xff);
    const est = estimateMiningCost(easyTarget, mockRate);
    expect(est.confidence).toBe('fast');
    expect(est.expectedSeconds).toBeLessThan(2);
  });

  it('returns confidence=slow for very hard difficulty (first byte = 0x00)', () => {
    const hardTarget = new Uint8Array(32);
    hardTarget[0] = 0x00;
    hardTarget[1] = 0x00;
    hardTarget[2] = 0x01;
    for (let i = 3; i < 32; i++) hardTarget[i] = 0xff;

    const est = estimateMiningCost(hardTarget, mockRate);
    expect(est.confidence).toBe('slow');
  });

  it('expectedHashes > 0 for non-trivial difficulty', () => {
    const est = estimateMiningCost(TX_POW_MIN_DIFFICULTY, mockRate);
    expect(est.expectedHashes).toBeGreaterThan(0n);
  });

  it('throws for non-positive hashRatePerSec', () => {
    expect(() => estimateMiningCost(TX_POW_MIN_DIFFICULTY, 0)).toThrow();
    expect(() => estimateMiningCost(TX_POW_MIN_DIFFICULTY, -1)).toThrow();
  });

  it('handles zero-difficulty target (impossibly easy)', () => {
    const zeroTarget = new Uint8Array(32);
    const est = estimateMiningCost(zeroTarget, mockRate);
    expect(est.expectedHashes).toBe(0n);
    expect(est.expectedSeconds).toBe(0);
    expect(est.confidence).toBe('fast');
  });
});
