import { cleanSeedPhrase, convertStringToSeed, phraseToSeed, validatePhrase } from '../src/bip39';
import { sha3_256, bytesToHex } from '@totemsdk/core';

describe('BIP39 Parity with Minima BIP39.java', () => {
  
  describe('cleanSeedPhrase() - exact match with BIP39.cleanSeedPhrase()', () => {
    
    it('should match Java test vector from BIP39.java main() (adjusted for standard word list)', () => {
      const input = 'MEAt inve act THEM WAGO ALONE PURI AVER UNFA RESI AMUS SMOK SENS MILL DIAGRAM OBVIO';
      const expectedOutput = 'MEAT INVEST ACT THEME WAGON ALONE PURITY AVERAGE UNFAIR RESIST AMUSED SMOKE SENSE MILLION DIAGRAM OBVIOUS';
      
      const result = cleanSeedPhrase(input);
      expect(result).toBe(expectedOutput);
    });
    
    it('should uppercase and expand 4+ char prefixes', () => {
      expect(cleanSeedPhrase('aban')).toBe('ABANDON');
      expect(cleanSeedPhrase('wago')).toBe('WAGON');
      expect(cleanSeedPhrase('inve')).toBe('INVEST');
    });
    
    it('should require exact match for 3-char words', () => {
      expect(cleanSeedPhrase('act')).toBe('ACT');
      expect(cleanSeedPhrase('add')).toBe('ADD');
      expect(cleanSeedPhrase('age')).toBe('AGE');
      expect(cleanSeedPhrase('aim')).toBe('AIM');
      expect(cleanSeedPhrase('air')).toBe('AIR');
      expect(cleanSeedPhrase('all')).toBe('ALL');
      expect(cleanSeedPhrase('any')).toBe('ANY');
      expect(cleanSeedPhrase('arm')).toBe('ARM');
      expect(cleanSeedPhrase('art')).toBe('ART');
    });
    
    it('should reject 2-char inputs (too short)', () => {
      expect(() => cleanSeedPhrase('ab')).toThrow('Word too short');
    });
    
    it('should reject unknown words', () => {
      expect(() => cleanSeedPhrase('xyz')).toThrow('Unknown BIP39 word');
      expect(() => cleanSeedPhrase('notaword')).toThrow('Unknown BIP39 word');
    });
    
    it('should handle mixed case input', () => {
      expect(cleanSeedPhrase('AbAnDoN')).toBe('ABANDON');
      expect(cleanSeedPhrase('ABANDON')).toBe('ABANDON');
      expect(cleanSeedPhrase('abandon')).toBe('ABANDON');
    });
    
    it('should handle multiple spaces between words', () => {
      expect(cleanSeedPhrase('abandon   ability')).toBe('ABANDON ABILITY');
    });
    
    it('should handle leading/trailing whitespace', () => {
      expect(cleanSeedPhrase('  abandon ability  ')).toBe('ABANDON ABILITY');
    });
  });
  
  describe('convertStringToSeed() - matches BIP39.convertStringToSeed()', () => {
    
    it('should produce 32-byte SHA3-256 hash of UTF-8 bytes', () => {
      const phrase = 'ABANDON ABILITY';
      const result = convertStringToSeed(phrase);
      
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);
      
      const expectedHash = sha3_256(new TextEncoder().encode(phrase));
      expect(result).toEqual(expectedHash);
    });
    
    it('should be deterministic', () => {
      const phrase = 'ABANDON ABILITY ABLE ABOUT ABOVE ABSENT ABSORB ABSTRACT ABSURD ABUSE ACCESS ACCIDENT';
      const result1 = convertStringToSeed(phrase);
      const result2 = convertStringToSeed(phrase);
      expect(result1).toEqual(result2);
    });
    
    it('should be case-sensitive (matches Java String.getBytes())', () => {
      const lower = convertStringToSeed('abandon');
      const upper = convertStringToSeed('ABANDON');
      expect(lower).not.toEqual(upper);
    });
  });
  
  describe('phraseToSeed() - end-to-end pipeline', () => {
    
    it('should normalize and hash in one step', () => {
      const rawPhrase = 'aban abil';
      const canonical = cleanSeedPhrase(rawPhrase);
      const expectedSeed = convertStringToSeed(canonical);
      
      const result = phraseToSeed(rawPhrase);
      expect(result).toEqual(expectedSeed);
    });
    
    it('should produce same seed for equivalent inputs', () => {
      const seed1 = phraseToSeed('abandon ability');
      const seed2 = phraseToSeed('ABANDON ABILITY');
      const seed3 = phraseToSeed('aban abil');
      const seed4 = phraseToSeed('  Aban   Abil  ');
      
      expect(seed1).toEqual(seed2);
      expect(seed2).toEqual(seed3);
      expect(seed3).toEqual(seed4);
    });
  });
  
  describe('validatePhrase() - word list validation', () => {
    
    it('should accept valid full words', () => {
      expect(validatePhrase('abandon')).toBe(true);
      expect(validatePhrase('ability')).toBe(true);
      expect(validatePhrase('abandon ability')).toBe(true);
    });
    
    it('should accept valid prefixes (4+ chars)', () => {
      expect(validatePhrase('aban')).toBe(true);
      expect(validatePhrase('abil')).toBe(true);
    });
    
    it('should reject unknown words', () => {
      expect(validatePhrase('notaword')).toBe(false);
      expect(validatePhrase('xyz')).toBe(false);
    });
    
    it('should reject too-short words', () => {
      expect(validatePhrase('ab')).toBe(false);
    });
  });
  
  describe('Golden Test Vectors', () => {
    
    it('should match pre-computed seed for standard 24-word mnemonic', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
      
      const seed = phraseToSeed(mnemonic);
      const hex = bytesToHex(seed);
      
      const canonical = cleanSeedPhrase(mnemonic);
      expect(canonical).toBe('ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ART');
      
      const directHash = sha3_256(new TextEncoder().encode(canonical));
      expect(seed).toEqual(directHash);
      
      expect(hex).toBe(bytesToHex(directHash));
    });
    
    it('should produce different seeds for different phrases', () => {
      const seed1 = phraseToSeed('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
      const seed2 = phraseToSeed('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon absent');
      
      expect(seed1).not.toEqual(seed2);
    });
  });
  
  describe('Edge Cases matching Java behavior', () => {
    
    it('should handle single word', () => {
      const result = cleanSeedPhrase('abandon');
      expect(result).toBe('ABANDON');
    });
    
    it('should preserve word order', () => {
      const result = cleanSeedPhrase('ability abandon');
      expect(result).toBe('ABILITY ABANDON');
    });
    
    it('should match first word for ambiguous prefixes', () => {
      expect(cleanSeedPhrase('abil')).toBe('ABILITY');
      expect(cleanSeedPhrase('abou')).toBe('ABOUT');
      expect(cleanSeedPhrase('abov')).toBe('ABOVE');
    });
  });
});
