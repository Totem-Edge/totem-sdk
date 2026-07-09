/**
 * Key derivation parity tests
 *
 * Part A — Per-address derivation parity (Minima Wallet.java)
 *   Verifies that derivePerAddressSeed() matches Minima Wallet.createNewKey():
 *     MiniData modifier = new MiniData(new BigInteger(Integer.toString(numkeys)));
 *     MiniData privseed = Crypto.getInstance().hashObjects(baseSeed, modifier);
 *     TreeKey treekey = TreeKey.createDefault(privseed);
 *   This suite is kept as a regression guard and migration reference.
 *
 * Part B — Unified hierarchical derivation property tests
 *   Verifies that the new createUnifiedChildTreeKey / deriveUnifiedAddressPublicKey
 *   factory functions behave correctly (determinism, independence, correct structure).
 */

import { derivePerAddressSeed, indexToMiniDataBytes } from '../javaStreamables';
import {
  TreeKey,
  getRootPublicKey,
  verifyTreeSignature,
  createUnifiedChildTreeKey,
  deriveUnifiedAddressPublicKey,
} from '../treekey';

const TEST_SEED = new Uint8Array([
  0x51, 0xD9, 0xF4, 0x03, 0x27, 0x1E, 0x26, 0x72,
  0x29, 0xB6, 0xC2, 0xA9, 0x5C, 0x5E, 0xAE, 0xD5,
  0x27, 0x84, 0x6A, 0x1A, 0xF8, 0x9F, 0x8B, 0x1C,
  0xF5, 0x57, 0x4B, 0x0E, 0x79, 0xA4, 0x9C, 0xF1
]);

function toHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// ─── Part A: per-address parity with Minima Wallet.java ──────────────────────

describe('Per-Address Key Derivation (Minima Wallet Parity — migration reference)', () => {
  const javaExpected = [
    { index: 0, modifier: '0x00', privSeed: '0x6DD2281FD93037819358EA2DCC27C8DE4F358EB2DC17D9C5907B500184DAA172', pubKey: '0x75C8EE428AC72E1D7A4A7A7E02A6E7B8BEE4F7281B73C0199BBC0CDD59B05C88' },
    { index: 1, modifier: '0x01', privSeed: '0x3BAC5E60BA11049C1BAA2F065F9C21F736F3E30F37F7213EE9A37BF755AE83E5', pubKey: '0xD008FC735BC7A8FB4912584F61F7F8D9469E4146128985209B0EF5048BBEA215' },
    { index: 2, modifier: '0x02', privSeed: '0xF63171651D6110F9DD086EB3AC3D35CFE41DA8B504DD81C9575781C02F8EC6B0', pubKey: '0xBBC3D6F727CFD1D413CE152830F626EC89AC3435144A86BF932E6D5C0DB67BDF' },
    { index: 3, modifier: '0x03', privSeed: '0x65EFC1CC40BF30127B55F716860EDCB32A2C47F8434A44479A85CE0D2D2A07BA', pubKey: '0x75166F510C0457E3D1C94EA17A89D47EE4A90DBC71D94B06111C34E2AAC91D8C' },
    { index: 4, modifier: '0x04', privSeed: '0xF9A21A47941E47C4F98D212D98E8D8CC2A5D3AD03D473379F037CF5914433DB7', pubKey: '0xBFB7AD971C3A665F96E2A8BADDF14301DC8EBA2E45AEEA34AF85EC428F39F835' },
  ];

  describe('indexToMiniDataBytes', () => {
    it('converts index 0 to 0x00', () => {
      expect(toHex(indexToMiniDataBytes(0))).toBe('0x00');
    });

    it('converts index 1 to 0x01', () => {
      expect(toHex(indexToMiniDataBytes(1))).toBe('0x01');
    });

    it('converts index 63 to 0x3F', () => {
      expect(toHex(indexToMiniDataBytes(63))).toBe('0x3F');
    });

    it('converts index 64 to 0x40', () => {
      expect(toHex(indexToMiniDataBytes(64))).toBe('0x40');
    });

    it('converts index 255 to 0xFF', () => {
      expect(toHex(indexToMiniDataBytes(255))).toBe('0xFF');
    });

    it('converts index 256 to 0x0100 (2 bytes)', () => {
      expect(toHex(indexToMiniDataBytes(256))).toBe('0x0100');
    });
  });

  describe('derivePerAddressSeed', () => {
    javaExpected.forEach(({ index, modifier, privSeed }) => {
      it(`derives correct private seed for address ${index}`, () => {
        const modifierBytes = indexToMiniDataBytes(index);
        expect(toHex(modifierBytes)).toBe(modifier);

        const derivedSeed = derivePerAddressSeed(TEST_SEED, index);
        expect(toHex(derivedSeed)).toBe(privSeed);
      });
    });
  });

  describe('Full per-address public key derivation (using direct TreeKey)', () => {
    javaExpected.forEach(({ index, pubKey }) => {
      it(`derives correct public key for address ${index}`, () => {
        const privSeed = derivePerAddressSeed(TEST_SEED, index);
        const treeKey = new TreeKey(privSeed, 64, 3);
        const derivedPubKey = treeKey.getPublicKey();
        expect(toHex(derivedPubKey)).toBe(pubKey);
      });
    });
  });
});

// ─── Part B: unified hierarchical derivation property tests ──────────────────

describe('Unified Hierarchical Key Derivation — factory property tests', () => {
  describe('createUnifiedChildTreeKey factory', () => {
    test('returns TreeKey with correct capacity (4096 uses)', () => {
      const treeKey = createUnifiedChildTreeKey(TEST_SEED, 0);
      expect(treeKey.getMaxUses()).toBe(64 * 64 * 64);
    });

    test('is deterministic — same seed and index always give same public key', () => {
      const pk1 = toHex(createUnifiedChildTreeKey(TEST_SEED, 2).getPublicKey());
      const pk2 = toHex(createUnifiedChildTreeKey(TEST_SEED, 2).getPublicKey());
      expect(pk1).toBe(pk2);
    });

    test('different indices give different public keys', () => {
      const pk0 = toHex(createUnifiedChildTreeKey(TEST_SEED, 0).getPublicKey());
      const pk1 = toHex(createUnifiedChildTreeKey(TEST_SEED, 1).getPublicKey());
      const pk2 = toHex(createUnifiedChildTreeKey(TEST_SEED, 2).getPublicKey());
      expect(pk0).not.toBe(pk1);
      expect(pk1).not.toBe(pk2);
    });

    test('different seeds give different public keys', () => {
      const seed2 = new Uint8Array(32).fill(0xff);
      const pk1 = toHex(createUnifiedChildTreeKey(TEST_SEED, 0).getPublicKey());
      const pk2 = toHex(createUnifiedChildTreeKey(seed2, 0).getPublicKey());
      expect(pk1).not.toBe(pk2);
    });

    test('setUses + sign produces 3 proofs with correct structure', () => {
      const treeKey = createUnifiedChildTreeKey(TEST_SEED, 0);
      const testData = new Uint8Array(32).fill(0xAB);
      treeKey.setUses(0);
      const signature = treeKey.sign(testData);
      expect(signature.proofs).toHaveLength(3);
      expect(signature.proofs[0].leafPubkey).toHaveLength(32);
      expect(signature.proofs[0].signature).toHaveLength(1088);
      expect(signature.proofs[1].leafPubkey).toHaveLength(32);
      expect(signature.proofs[2].leafPubkey).toHaveLength(32);
    });

    test('sign: first proof root matches TreeKey root public key', () => {
      const treeKey = createUnifiedChildTreeKey(TEST_SEED, 0);
      const testData = new Uint8Array(32).fill(0xCD);
      treeKey.setUses(0);
      const signature = treeKey.sign(testData);
      const proof0Root = getRootPublicKey(signature.proofs[0]);
      expect(toHex(proof0Root)).toBe(toHex(treeKey.getPublicKey()));
    });

    test('sign: signature verifies correctly against treeKey public key', () => {
      const treeKey = createUnifiedChildTreeKey(TEST_SEED, 1);
      const testData = new Uint8Array(32).fill(0xEF);
      treeKey.setUses(1);
      const signature = treeKey.sign(testData);
      const isValid = verifyTreeSignature(treeKey.getPublicKey(), testData, signature);
      expect(isValid).toBe(true);
    });
  });

  describe('deriveUnifiedAddressPublicKey helper', () => {
    test('matches createUnifiedChildTreeKey(seed, index).getPublicKey()', () => {
      for (let i = 0; i < 5; i++) {
        const fromHelper = toHex(deriveUnifiedAddressPublicKey(TEST_SEED, i));
        const fromFactory = toHex(createUnifiedChildTreeKey(TEST_SEED, i).getPublicKey());
        expect(fromHelper).toBe(fromFactory);
      }
    });

    test('is deterministic', () => {
      const pk1 = toHex(deriveUnifiedAddressPublicKey(TEST_SEED, 3));
      const pk2 = toHex(deriveUnifiedAddressPublicKey(TEST_SEED, 3));
      expect(pk1).toBe(pk2);
    });

    test('different indices give different keys', () => {
      const pks = new Set([0, 1, 2, 3, 4].map(i => toHex(deriveUnifiedAddressPublicKey(TEST_SEED, i))));
      expect(pks.size).toBe(5);
    });
  });
});
