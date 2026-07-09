/**
 * calibrate.ts — Hash rate measurement and mining cost estimation.
 *
 * calibrateHashRate() measures how many SHA3-256 hashes/sec the current
 * environment can produce. Used by the extension UX to show a warning
 * before starting a mine on slow devices.
 *
 * estimateMiningCost() converts a difficulty target + hash rate into an
 * expected time and confidence label.
 */

import { sha3_256 } from '@noble/hashes/sha3.js';

export interface MiningEstimate {
  expectedHashes: bigint;
  expectedSeconds: number;
  confidence: 'fast' | 'normal' | 'slow';
}

/**
 * Run 100K trial SHA3-256 hashes and return the measured hash rate (hashes/sec).
 *
 * Call once per session and cache the result — the cost is ~50ms on a
 * typical desktop and ~300ms on a mid-range mobile.
 */
export async function calibrateHashRate(): Promise<number> {
  const TRIAL_COUNT = 100_000;
  const data = new Uint8Array(150).fill(0xab);

  const start = typeof performance !== 'undefined'
    ? performance.now()
    : Date.now();

  for (let i = 0; i < TRIAL_COUNT; i++) {
    sha3_256(data);
  }

  const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start;
  return Math.round(TRIAL_COUNT / (elapsed / 1000));
}

/**
 * Given a difficulty target and a measured hash rate, return the expected
 * number of hashes, expected wall-clock time, and a confidence label.
 *
 * expectedHashes ≈ MAX_HASH / txnDifficulty
 *   (geometric distribution: each hash has P(valid) = txnDifficulty / MAX_HASH)
 *
 * Confidence labels:
 *   fast   < 2 s
 *   normal 2 – 15 s
 *   slow   > 15 s
 */
export function estimateMiningCost(
  txnDifficulty: Uint8Array,
  hashRatePerSec: number
): MiningEstimate {
  if (hashRatePerSec <= 0) {
    throw new Error('hashRatePerSec must be positive');
  }

  const diffBigInt = txnDifficulty.reduce(
    (acc, b) => (acc << 8n) | BigInt(b),
    0n
  );

  if (diffBigInt === 0n) {
    return { expectedHashes: 0n, expectedSeconds: 0, confidence: 'fast' };
  }

  const MAX_HASH_BIGINT = (2n ** 256n) - 1n;
  const expectedHashes = MAX_HASH_BIGINT / diffBigInt;

  const expectedSeconds = Number(expectedHashes) / hashRatePerSec;

  let confidence: 'fast' | 'normal' | 'slow';
  if (expectedSeconds < 2) {
    confidence = 'fast';
  } else if (expectedSeconds < 15) {
    confidence = 'normal';
  } else {
    confidence = 'slow';
  }

  return { expectedHashes, expectedSeconds, confidence };
}
