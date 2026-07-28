/**
 * SECURITY TEST: Mnemonic Generation
 * 
 * Ensures that mnemonic generation in production uses:
 * 1. Cryptographically Secure Pseudo-Random Number Generator (CSPRNG)
 * 2. Full BIP39 2048-word English wordlist
 * 3. 256 bits of entropy (24 words)
 * 4. Valid BIP39 checksums
 */

import { generateMnemonic, validateMnemonic, mnemonicToSeed } from '../src/wallet/mnemonic';
import * as bip39 from 'bip39';

describe('Mnemonic Generation Security', () => {
  describe('BIP39 Compliance', () => {
    test('should generate valid BIP39 mnemonic', () => {
      const mnemonic = generateMnemonic();
      expect(validateMnemonic(mnemonic)).toBe(true);
    });

    test('should generate 24-word mnemonic (256 bits entropy)', () => {
      const mnemonic = generateMnemonic(256);
      const words = mnemonic.split(' ');
      expect(words.length).toBe(24);
    });

    test('should generate 12-word mnemonic when requested (128 bits)', () => {
      const mnemonic = generateMnemonic(128);
      const words = mnemonic.split(' ');
      expect(words.length).toBe(12);
      expect(validateMnemonic(mnemonic)).toBe(true);
    });

    test('all words should be from BIP39 English wordlist', () => {
      const mnemonic = generateMnemonic();
      const words = mnemonic.split(' ');
      const wordlist = bip39.wordlists.english;

      words.forEach(word => {
        expect(wordlist).toContain(word);
      });
    });
  });

  describe('Randomness (CSPRNG)', () => {
    test('should generate different mnemonics on successive calls', () => {
      const mnemonic1 = generateMnemonic();
      const mnemonic2 = generateMnemonic();
      const mnemonic3 = generateMnemonic();

      // All three should be different
      expect(mnemonic1).not.toBe(mnemonic2);
      expect(mnemonic2).not.toBe(mnemonic3);
      expect(mnemonic1).not.toBe(mnemonic3);
    });

    test('should generate unique mnemonics across 100 iterations', () => {
      const mnemonics = new Set<string>();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const mnemonic = generateMnemonic();
        mnemonics.add(mnemonic);
      }

      // All should be unique (no collisions)
      expect(mnemonics.size).toBe(iterations);
    });

    test('should use diverse vocabulary (not just first N words)', () => {
      const mnemonic = generateMnemonic();
      const words = mnemonic.split(' ');
      const wordlist = bip39.wordlists.english;

      // Calculate average position in wordlist
      const positions = words.map(word => wordlist.indexOf(word));
      const avgPosition = positions.reduce((a, b) => a + b, 0) / positions.length;

      // Average should be near middle of wordlist (1024) not near start (0)
      // Allow wide range but reject systematic bias toward first 100 words
      expect(avgPosition).toBeGreaterThan(100);
      expect(avgPosition).toBeLessThan(1900); // Some variance expected
    });
  });

  describe('Seed Derivation', () => {
    test('should derive deterministic seed from mnemonic', async () => {
      const mnemonic = generateMnemonic();
      const seed1 = await mnemonicToSeed(mnemonic, '');
      const seed2 = await mnemonicToSeed(mnemonic, '');

      // Same mnemonic should produce same seed
      expect(Buffer.from(seed1).toString('hex')).toBe(Buffer.from(seed2).toString('hex'));
    });

    test('should produce 64-byte seed', async () => {
      const mnemonic = generateMnemonic();
      const seed = await mnemonicToSeed(mnemonic, '');

      expect(seed.byteLength).toBe(64); // BIP39 produces 512-bit seed
    });

    test('different mnemonics should produce different seeds', async () => {
      const mnemonic1 = generateMnemonic();
      const mnemonic2 = generateMnemonic();

      const seed1 = await mnemonicToSeed(mnemonic1, '');
      const seed2 = await mnemonicToSeed(mnemonic2, '');

      expect(Buffer.from(seed1).toString('hex')).not.toBe(Buffer.from(seed2).toString('hex'));
    });

    test('passphrase should affect seed derivation', async () => {
      const mnemonic = generateMnemonic();
      const seedNoPass = await mnemonicToSeed(mnemonic, '');
      const seedWithPass = await mnemonicToSeed(mnemonic, 'my-passphrase');

      // Same mnemonic with different passphrase = different seed
      expect(Buffer.from(seedNoPass).toString('hex')).not.toBe(Buffer.from(seedWithPass).toString('hex'));
    });
  });

  describe('Known Test Vector Validation', () => {
    // BIP39 official test vector
    test('should validate official BIP39 test vector', () => {
      const testVector = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
      expect(validateMnemonic(testVector)).toBe(true);
    });

    test('should reject invalid checksums', () => {
      const invalidMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon'; // Wrong last word
      expect(validateMnemonic(invalidMnemonic)).toBe(false);
    });

    test('should reject non-BIP39 words', () => {
      const invalidMnemonic = 'notaword abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
      expect(validateMnemonic(invalidMnemonic)).toBe(false);
    });
  });

  describe('Production Implementation Verification', () => {
    test('generateMnemonic should delegate to bip39 library', () => {
      // Spy on bip39.generateMnemonic to ensure we use it
      const spy = jest.spyOn(bip39, 'generateMnemonic');
      
      generateMnemonic(256);
      
      expect(spy).toHaveBeenCalledWith(256);
      spy.mockRestore();
    });

    test('validateMnemonic should delegate to bip39 library', () => {
      const spy = jest.spyOn(bip39, 'validateMnemonic');
      const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
      
      validateMnemonic(testMnemonic);
      
      expect(spy).toHaveBeenCalledWith(testMnemonic);
      spy.mockRestore();
    });

    test('mnemonicToSeed should delegate to bip39 library', async () => {
      const spy = jest.spyOn(bip39, 'mnemonicToSeed');
      const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
      
      await mnemonicToSeed(testMnemonic, '');
      
      expect(spy).toHaveBeenCalledWith(testMnemonic, '');
      spy.mockRestore();
    });
  });
});
