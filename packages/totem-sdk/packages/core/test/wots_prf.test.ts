/**
 * WOTS PRF and Parameter Tests (BouncyCastle Compatible)
 * 
 * Validates BouncyCastle-compatible WOTS behavior:
 * - All parameter sets resolve to WOTS_MINIMA (w=8, L=34)
 * - GMSSRandom stateful PRNG for chain seed derivation
 * - PKdigest is deterministic and consistent
 */
import { describe, it, expect } from 'vitest';
import { sha3_256 } from '@noble/hashes/sha3.js';
import { wotsKeypairFromSeed, derivePKdigest, expandPrivateKey, GMSSRandom } from '../dist/wots';
import { WOTS_V1_DEV, WOTS_V2_SPEC, WOTS_MINIMA, getParamSet } from '../dist/params';

const F = (x: Uint8Array) => sha3_256(x);
const iterate = (x: Uint8Array, n: number) => {
  let y = x;
  for (let k = 0; k < n; k++) y = F(y);
  return y;
};

const seed = new Uint8Array(Array(32).fill(0x11));

describe('WOTS BouncyCastle-compatible parameter semantics', () => {
  it('all parameter set aliases resolve to WOTS_MINIMA', () => {
    expect(WOTS_V1_DEV).toBe(WOTS_MINIMA);
    expect(WOTS_V2_SPEC).toBe(WOTS_MINIMA);
    expect(getParamSet()).toBe(WOTS_MINIMA);
  });

  it('WOTS_MINIMA has w=8, L=34 (BouncyCastle-compatible)', () => {
    expect(WOTS_MINIMA.w).toBe(8);
    expect(WOTS_MINIMA.L).toBe(34);
    expect(WOTS_MINIMA.n).toBe(256);
    expect(WOTS_MINIMA.name).toBe('minima');
    expect(WOTS_MINIMA.messageSize).toBe(32);
    expect(WOTS_MINIMA.checksumDigits).toBe(2);
    expect(WOTS_MINIMA.maxDigit).toBe(255);
  });

  it('expandPrivateKey produces 34 chain seeds', () => {
    const privateKeys = expandPrivateKey(seed, WOTS_MINIMA);
    expect(privateKeys.length).toBe(34);
    for (const pk of privateKeys) {
      expect(pk.length).toBe(32);
    }
  });

  it('expandPrivateKey produces unique seeds per chain', () => {
    const privateKeys = expandPrivateKey(seed, WOTS_MINIMA);
    const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
    
    expect(hex(privateKeys[0])).not.toBe(hex(privateKeys[1]));
    expect(hex(privateKeys[0])).not.toBe(hex(privateKeys[33]));
    expect(hex(privateKeys[1])).not.toBe(hex(privateKeys[33]));
  });

  it('GMSSRandom.nextSeed mutates state correctly', () => {
    const state1 = new Uint8Array(seed);
    const state2 = new Uint8Array(seed);
    
    // First call should produce same result
    const rand1 = GMSSRandom.nextSeed(state1);
    const rand2 = GMSSRandom.nextSeed(state2);
    
    expect(Buffer.from(rand1).toString('hex')).toBe(Buffer.from(rand2).toString('hex'));
    expect(Buffer.from(state1).toString('hex')).toBe(Buffer.from(state2).toString('hex'));
    
    // States should be different from original seed
    expect(Buffer.from(state1).toString('hex')).not.toBe(Buffer.from(seed).toString('hex'));
  });

  it('steps per chain reflect 2^w - 1 = 255 for w=8', () => {
    expect(WOTS_MINIMA.maxDigit).toBe(255);
    expect((1 << WOTS_MINIMA.w) - 1).toBe(255);
  });

  it('chain top is computed with 255 iterations', () => {
    const privateKeys = expandPrivateKey(seed, WOTS_MINIMA);
    const top = iterate(privateKeys[0], WOTS_MINIMA.maxDigit);
    expect(top.length).toBe(32);
  });

  it('PKdigest is deterministic for same seed and index', () => {
    const keypair1 = wotsKeypairFromSeed(seed, 0, WOTS_MINIMA);
    const keypair2 = wotsKeypairFromSeed(seed, 0, WOTS_MINIMA);
    
    expect(keypair1.pk.length).toBe(32);
    expect(keypair2.pk.length).toBe(32);
    expect(Buffer.from(keypair1.pk).toString('hex')).toBe(Buffer.from(keypair2.pk).toString('hex'));
  });

  it('PKdigest differs for different key indices', () => {
    const keypair0 = wotsKeypairFromSeed(seed, 0, WOTS_MINIMA);
    const keypair1 = wotsKeypairFromSeed(seed, 1, WOTS_MINIMA);
    
    expect(Buffer.from(keypair0.pk).toString('hex')).not.toBe(Buffer.from(keypair1.pk).toString('hex'));
  });

  it('derivePKdigest matches wotsKeypairFromSeed.pk', () => {
    const pkFromDerive = derivePKdigest(seed, 5, WOTS_MINIMA);
    const pkFromKeypair = wotsKeypairFromSeed(seed, 5, WOTS_MINIMA).pk;
    
    expect(Buffer.from(pkFromDerive).toString('hex')).toBe(Buffer.from(pkFromKeypair).toString('hex'));
  });
});
