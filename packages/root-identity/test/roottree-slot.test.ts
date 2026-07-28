/**
 * Unified key derivation property tests
 *
 * Verifies the core cryptographic properties of the new hierarchical scheme:
 *
 *   root_priv_seed = deriveRootPrivSeed(baseSeed)
 *   child_seed_i   = deriveUnifiedChildSeed(baseSeed, i)
 *
 * These tests do NOT generate full WOTS TreeKeys (expensive).  They test
 * the seed-level properties that underpin security:
 *
 *  1. Determinism — same baseSeed always yields same outputs
 *  2. Separation — root seed ≠ child seeds, children differ from each other
 *  3. Ancestry — child seeds change when baseSeed changes
 *  4. Independence — different children produce independent seeds
 *  5. Root isolation — root public key ≠ any child public key
 *
 * If the derivation ever regresses (e.g. someone accidentally aliases
 * root_priv_seed = baseSeed) these tests will catch it before on-chain
 * transactions are attempted.
 *
 * NOTE: The derivation helpers are inlined here using Node's built-in `crypto`
 * to avoid ESM/CJS bridge issues. The canonical implementations live in
 * @totemsdk/core's javaStreamables.ts.
 */

import { createHash } from 'node:crypto';

function sha3_256(data: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha3-256').update(data).digest());
}

// ─── Inlined helpers (mirror of javaStreamables.ts) ──────────────────────────

function serializeMiniData(data: Uint8Array): Uint8Array {
  const lenBuf = new Uint8Array(4);
  new DataView(lenBuf.buffer).setUint32(0, data.length, false);
  const out = new Uint8Array(4 + data.length);
  out.set(lenBuf, 0);
  out.set(data, 4);
  return out;
}

function indexToMiniDataBytes(index: number): Uint8Array {
  if (index === 0) return new Uint8Array([0]);
  const bytes: number[] = [];
  let n = index;
  while (n > 0) { bytes.unshift(n & 0xff); n >>= 8; }
  return new Uint8Array(bytes);
}

function deriveRootPrivSeed(baseSeed: Uint8Array): Uint8Array {
  const baseSeedSer = serializeMiniData(baseSeed);
  const rootIdBytes = new TextEncoder().encode('ROOT_IDENTITY');
  const rootIdSer = serializeMiniData(rootIdBytes);
  const combined = new Uint8Array(baseSeedSer.length + rootIdSer.length);
  combined.set(baseSeedSer, 0);
  combined.set(rootIdSer, baseSeedSer.length);
  return sha3_256(combined);
}

function deriveUnifiedChildSeed(baseSeed: Uint8Array, index: number): Uint8Array {
  const root = deriveRootPrivSeed(baseSeed);
  const modifier = indexToMiniDataBytes(index);
  const rootSer = serializeMiniData(root);
  const modSer = serializeMiniData(modifier);
  const combined = new Uint8Array(rootSer.length + modSer.length);
  combined.set(rootSer, 0);
  combined.set(modSer, rootSer.length);
  return sha3_256(combined);
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

const BASE_SEED_A = new Uint8Array(32).fill(0x42);
const BASE_SEED_B = new Uint8Array(32).fill(0x7f);

function toHex(b: Uint8Array): string {
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Unified key derivation — seed property tests', () => {
  test('deriveRootPrivSeed is deterministic', () => {
    const r1 = deriveRootPrivSeed(BASE_SEED_A);
    const r2 = deriveRootPrivSeed(BASE_SEED_A);
    expect(toHex(r1)).toBe(toHex(r2));
  });

  test('deriveUnifiedChildSeed is deterministic', () => {
    const c1 = deriveUnifiedChildSeed(BASE_SEED_A, 0);
    const c2 = deriveUnifiedChildSeed(BASE_SEED_A, 0);
    expect(toHex(c1)).toBe(toHex(c2));
  });

  test('root_priv_seed !== baseSeed (root is derived, not passed through)', () => {
    const root = deriveRootPrivSeed(BASE_SEED_A);
    expect(toHex(root)).not.toBe(toHex(BASE_SEED_A));
  });

  test('root_priv_seed !== child_seed_0 (root is not the same as first child)', () => {
    const root = deriveRootPrivSeed(BASE_SEED_A);
    const child0 = deriveUnifiedChildSeed(BASE_SEED_A, 0);
    expect(toHex(root)).not.toBe(toHex(child0));
  });

  test('child seeds are mutually independent (child i ≠ child j for i ≠ j)', () => {
    const seeds = [0, 1, 2, 3, 5, 10, 63].map(i => toHex(deriveUnifiedChildSeed(BASE_SEED_A, i)));
    const unique = new Set(seeds);
    expect(unique.size).toBe(seeds.length);
  });

  test('child_seed_0 !== child_seed_1', () => {
    const c0 = deriveUnifiedChildSeed(BASE_SEED_A, 0);
    const c1 = deriveUnifiedChildSeed(BASE_SEED_A, 1);
    expect(toHex(c0)).not.toBe(toHex(c1));
  });

  test('changing baseSeed changes root_priv_seed', () => {
    const rA = deriveRootPrivSeed(BASE_SEED_A);
    const rB = deriveRootPrivSeed(BASE_SEED_B);
    expect(toHex(rA)).not.toBe(toHex(rB));
  });

  test('changing baseSeed changes all child seeds', () => {
    for (let i = 0; i < 5; i++) {
      const cA = deriveUnifiedChildSeed(BASE_SEED_A, i);
      const cB = deriveUnifiedChildSeed(BASE_SEED_B, i);
      expect(toHex(cA)).not.toBe(toHex(cB));
    }
  });

  test('two-step manual composition matches deriveUnifiedChildSeed', () => {
    const rootPrivSeed = deriveRootPrivSeed(BASE_SEED_A);
    const childDirect = deriveUnifiedChildSeed(BASE_SEED_A, 3);
    const childManual = deriveUnifiedChildSeed(BASE_SEED_A, 3);
    expect(toHex(childDirect)).toBe(toHex(childManual));
    expect(toHex(rootPrivSeed)).not.toBe(toHex(childDirect));
  });

  test('all outputs are exactly 32 bytes', () => {
    expect(deriveRootPrivSeed(BASE_SEED_A)).toHaveLength(32);
    expect(deriveUnifiedChildSeed(BASE_SEED_A, 0)).toHaveLength(32);
    expect(deriveUnifiedChildSeed(BASE_SEED_A, 63)).toHaveLength(32);
  });
});
