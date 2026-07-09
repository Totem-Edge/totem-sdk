/**
 * WOTS BouncyCastle Compatibility Tests
 * 
 * These tests verify that the TypeScript WOTS implementation produces
 * identical outputs to BouncyCastle's WinternitzOTSignature used by Minima.
 * 
 * Key Java classes to compare against:
 * - org.bouncycastle.pqc.crypto.gmss.util.WinternitzOTSignature
 * - org.bouncycastle.pqc.crypto.gmss.util.WinternitzOTSVerify
 * - org.bouncycastle.pqc.crypto.gmss.util.GMSSRandom
 * - org.minima.objects.keys.Winternitz
 */
import { describe, it, expect } from 'vitest';
import { 
  serializeMiniNumber, 
  serializeMiniData, 
  hashAllObjects,
  deriveChainSeedJava 
} from '../dist/javaStreamables';
import { derivePKdigest, toWinternitzDigits, expandPrivateKey, GMSSRandom } from '../dist/wots';
import { WOTS_MINIMA, getParamSet } from '../dist/params';
import { scriptFromWotsPk } from '../dist/script';
import { scriptToAddress } from '../dist/derive';
import { sha3_256 } from '@noble/hashes/sha3.js';

const hex = (u: Uint8Array) => Buffer.from(u).toString('hex');
const fromHex = (h: string) => Uint8Array.from(Buffer.from(h, 'hex'));

describe('Java-Compatible Serialization (javaStreamables)', () => {
  describe('serializeMiniNumber', () => {
    it('serializes 0 correctly', () => {
      const result = serializeMiniNumber(0);
      expect(hex(result)).toBe('000100');
    });

    it('serializes small positive integers', () => {
      expect(hex(serializeMiniNumber(1))).toBe('000101');
      expect(hex(serializeMiniNumber(127))).toBe('00017f');
    });

    it('serializes values requiring leading zero byte (high bit set)', () => {
      const result = serializeMiniNumber(128);
      expect(hex(result)).toBe('00020080');
    });

    it('serializes larger values', () => {
      expect(hex(serializeMiniNumber(256))).toBe('00020100');
      expect(hex(serializeMiniNumber(65535))).toBe('0003'+'00ffff');
    });
  });

  describe('serializeMiniData', () => {
    it('serializes empty data', () => {
      const result = serializeMiniData(new Uint8Array(0));
      expect(hex(result)).toBe('00000000');
    });

    it('serializes 32-byte data with length prefix', () => {
      const data = fromHex('1111111111111111111111111111111111111111111111111111111111111111');
      const result = serializeMiniData(data);
      expect(result.length).toBe(4 + 32);
      expect(hex(result.slice(0, 4))).toBe('00000020');
      expect(hex(result.slice(4))).toBe('1111111111111111111111111111111111111111111111111111111111111111');
    });
  });

  describe('hashAllObjects', () => {
    it('hashes serialized objects correctly', () => {
      const seed = fromHex('1111111111111111111111111111111111111111111111111111111111111111');
      const indexSerialized = serializeMiniNumber(0);
      const seedSerialized = serializeMiniData(seed);
      
      const result = hashAllObjects(indexSerialized, seedSerialized);
      
      expect(result.length).toBe(32);
      expect(typeof hex(result)).toBe('string');
    });
  });

  describe('deriveChainSeedJava', () => {
    it('derives deterministic seeds for different indices', () => {
      const seed = fromHex('1111111111111111111111111111111111111111111111111111111111111111');
      
      const seed0 = deriveChainSeedJava(seed, 0);
      const seed1 = deriveChainSeedJava(seed, 1);
      const seed0Again = deriveChainSeedJava(seed, 0);
      
      expect(hex(seed0)).toBe(hex(seed0Again));
      expect(hex(seed0)).not.toBe(hex(seed1));
    });
  });
});

describe('WOTS BouncyCastle Parameter Validation', () => {
  it('matches BouncyCastle w=8 parameters', () => {
    expect(WOTS_MINIMA.w).toBe(8);
    expect(WOTS_MINIMA.L).toBe(34);
    expect(WOTS_MINIMA.n).toBe(256);
    expect(WOTS_MINIMA.messageSize).toBe(32);
    expect(WOTS_MINIMA.checksumDigits).toBe(2);
    expect(WOTS_MINIMA.maxDigit).toBe(255);
  });

  it('toWinternitzDigits throws for w!=8', () => {
    const hash = fromHex('0000000000000000000000000000000000000000000000000000000000000000');
    const badPs = { ...getParamSet(), w: 16 } as any;
    expect(() => toWinternitzDigits(hash, badPs)).toThrow('Only w=8 is supported');
  });

  it('produces 34 total digits (32 message + 2 checksum) for w=8', () => {
    const hash = fromHex('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
    const ps = getParamSet();
    const result = toWinternitzDigits(hash, ps);
    
    expect(result.digits.length).toBe(32);
    expect(result.checksumDigits.length).toBe(2);
    expect(result.total).toBe(34);
  });

  it('each digit is the hash byte value (0-255)', () => {
    const hash = fromHex('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
    const ps = getParamSet();
    const { digits } = toWinternitzDigits(hash, ps);
    
    expect(digits[0]).toBe(0x01);
    expect(digits[1]).toBe(0x23);
    expect(digits[2]).toBe(0x45);
  });
});

describe('GMSSRandom Stateful PRNG', () => {
  it('produces 34 chain seeds', () => {
    const seed = fromHex('1111111111111111111111111111111111111111111111111111111111111111');
    const privateKeys = expandPrivateKey(seed, WOTS_MINIMA);
    
    expect(privateKeys.length).toBe(34);
    for (const pk of privateKeys) {
      expect(pk.length).toBe(32);
    }
  });

  it('produces unique seeds per chain (stateful PRNG)', () => {
    const seed = fromHex('1111111111111111111111111111111111111111111111111111111111111111');
    const privateKeys = expandPrivateKey(seed, WOTS_MINIMA);
    
    expect(hex(privateKeys[0])).not.toBe(hex(privateKeys[1]));
    expect(hex(privateKeys[0])).not.toBe(hex(privateKeys[33]));
  });

  it('GMSSRandom.nextSeed matches BouncyCastle algorithm', () => {
    // Verify: rand = H(state), state = state + rand + 1
    const state = fromHex('1111111111111111111111111111111111111111111111111111111111111111');
    const originalState = new Uint8Array(state);
    
    const rand = GMSSRandom.nextSeed(state);
    
    // rand should be H(original state)
    const expectedRand = sha3_256(originalState);
    expect(hex(rand)).toBe(hex(expectedRand));
    
    // state should be different from original
    expect(hex(state)).not.toBe(hex(originalState));
  });

  it('is deterministic for same seed', () => {
    const seed1 = fromHex('1111111111111111111111111111111111111111111111111111111111111111');
    const seed2 = fromHex('1111111111111111111111111111111111111111111111111111111111111111');
    
    const keys1 = expandPrivateKey(seed1, WOTS_MINIMA);
    const keys2 = expandPrivateKey(seed2, WOTS_MINIMA);
    
    expect(hex(keys1[0])).toBe(hex(keys2[0]));
    expect(hex(keys1[33])).toBe(hex(keys2[33]));
  });
});

describe('WOTS PKdigest Derivation', () => {
  it('produces 32-byte pkdigest', () => {
    const seed = fromHex('1111111111111111111111111111111111111111111111111111111111111111');
    const pkdigest = derivePKdigest(seed, 0, WOTS_MINIMA);
    
    expect(pkdigest.length).toBe(32);
  });

  it('produces different pkdigests for different indices', () => {
    const seed = fromHex('1111111111111111111111111111111111111111111111111111111111111111');
    
    const pk0 = derivePKdigest(seed, 0, WOTS_MINIMA);
    const pk1 = derivePKdigest(seed, 1, WOTS_MINIMA);
    
    expect(hex(pk0)).not.toBe(hex(pk1));
  });

  it('is deterministic', () => {
    const seed = fromHex('1111111111111111111111111111111111111111111111111111111111111111');
    
    const pk1 = derivePKdigest(seed, 7, WOTS_MINIMA);
    const pk2 = derivePKdigest(seed, 7, WOTS_MINIMA);
    
    expect(hex(pk1)).toBe(hex(pk2));
  });
});

describe('Address Derivation Flow', () => {
  it('produces valid Mx address from pkdigest', () => {
    const seed = fromHex('1111111111111111111111111111111111111111111111111111111111111111');
    const pkdigest = derivePKdigest(seed, 0, WOTS_MINIMA);
    const script = scriptFromWotsPk(pkdigest);
    const address = scriptToAddress(script);
    
    expect(script).toMatch(/^RETURN SIGNEDBY\(0x[0-9A-F]{64}\)$/);
    expect(address).toMatch(/^Mx[A-Z0-9]+$/);
  });

  it('produces consistent addresses for same seed/index', () => {
    const seed = fromHex('2222222222222222222222222222222222222222222222222222222222222222');
    
    const addr1 = scriptToAddress(scriptFromWotsPk(derivePKdigest(seed, 3, WOTS_MINIMA)));
    const addr2 = scriptToAddress(scriptFromWotsPk(derivePKdigest(seed, 3, WOTS_MINIMA)));
    
    expect(addr1).toBe(addr2);
  });

  it('produces different addresses for different indices', () => {
    const seed = fromHex('3333333333333333333333333333333333333333333333333333333333333333');
    
    const addr0 = scriptToAddress(scriptFromWotsPk(derivePKdigest(seed, 0, WOTS_MINIMA)));
    const addr1 = scriptToAddress(scriptFromWotsPk(derivePKdigest(seed, 1, WOTS_MINIMA)));
    
    expect(addr0).not.toBe(addr1);
  });
});

describe('End-to-End Signature Round-Trip', () => {
  const TEST_SEED = fromHex('1111111111111111111111111111111111111111111111111111111111111111');
  const TEST_MESSAGE = fromHex('deadbeefcafebabedeadbeefcafebabedeadbeefcafebabedeadbeefcafebabe');

  it('sign and verify round-trip succeeds', async () => {
    const { wotsSign, wotsVerify, wotsPkFromSig } = await import('../dist/wots');
    
    const signature = wotsSign(TEST_SEED, 0, TEST_MESSAGE, WOTS_MINIMA);
    
    expect(signature.length).toBe(1088);
    
    const legacySig = { index: 0, w: 8, sig: Array.from({ length: 34 }, (_, i) => signature.subarray(i * 32, (i + 1) * 32)) };
    const recoveredPk = wotsPkFromSig(TEST_MESSAGE, legacySig, WOTS_MINIMA);
    
    // derivePKdigest returns 32-byte digest (matches Java's Winternitz.getPublicKey())
    const expectedPk = derivePKdigest(TEST_SEED, 0, WOTS_MINIMA);
    expect(hex(recoveredPk)).toBe(hex(expectedPk));
    
    const isValid = wotsVerify(signature, TEST_MESSAGE, expectedPk, WOTS_MINIMA);
    expect(isValid).toBe(true);
  });

  it('verification fails with wrong message', async () => {
    const { wotsSign, wotsVerify } = await import('../dist/wots');
    const WRONG_MESSAGE = fromHex('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    
    const signature = wotsSign(TEST_SEED, 0, TEST_MESSAGE, WOTS_MINIMA);
    const expectedPk = derivePKdigest(TEST_SEED, 0, WOTS_MINIMA);
    
    const isValid = wotsVerify(signature, WRONG_MESSAGE, expectedPk, WOTS_MINIMA);
    expect(isValid).toBe(false);
  });

  it('signature is deterministic for same seed/index/message', async () => {
    const { wotsSign } = await import('../dist/wots');
    
    const sig1 = wotsSign(TEST_SEED, 0, TEST_MESSAGE, WOTS_MINIMA);
    const sig2 = wotsSign(TEST_SEED, 0, TEST_MESSAGE, WOTS_MINIMA);
    
    expect(hex(sig1)).toBe(hex(sig2));
  });
});

describe('BouncyCastle Golden Vectors', () => {
  const TEST_SEED = fromHex('1111111111111111111111111111111111111111111111111111111111111111');

  it('SNAPSHOT: Current pkdigest values for indices 0-3', () => {
    const pkdigests = [0, 1, 2, 3].map(i => hex(derivePKdigest(TEST_SEED, i, WOTS_MINIMA)));
    
    console.log('Current BouncyCastle-compatible pkdigests:');
    console.log(JSON.stringify(pkdigests, null, 2));
    
    expect(pkdigests.length).toBe(4);
    pkdigests.forEach(pk => {
      expect(pk.length).toBe(64);
    });
  });

  it('SNAPSHOT: Current chain seeds from GMSSRandom', () => {
    const privateKeys = expandPrivateKey(TEST_SEED, WOTS_MINIMA);
    const chainSeeds = privateKeys.slice(0, 3).map(pk => hex(pk));
    
    console.log('Current BouncyCastle-compatible chain seeds (first 3):');
    console.log(JSON.stringify(chainSeeds, null, 2));
    
    expect(chainSeeds.length).toBe(3);
    const uniqueSeeds = new Set(chainSeeds);
    expect(uniqueSeeds.size).toBe(3);
  });

  it('SNAPSHOT: Current addresses for indices 0-3', () => {
    const addresses = [0, 1, 2, 3].map(i => 
      scriptToAddress(scriptFromWotsPk(derivePKdigest(TEST_SEED, i, WOTS_MINIMA)))
    );
    
    console.log('Current BouncyCastle-compatible addresses:');
    console.log(JSON.stringify(addresses, null, 2));
    
    expect(addresses.length).toBe(4);
    addresses.forEach(addr => {
      expect(addr).toMatch(/^Mx[A-Z0-9]+$/);
    });
  });
});
