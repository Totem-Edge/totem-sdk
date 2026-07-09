import {
  encodeMxRadix32Frame,
  decodeMxRadix32Frame,
  makeMxAddress,
  parseMxAddress
} from '../src/core/utils/minima-base32';
import './setup';

describe('Minima Base32 Encoding', () => {
  
  describe('encodeMxRadix32Frame', () => {
    test('should encode a 32-byte payload to Minima Base32', () => {
      // Test with a known 32-byte value
      const payload = new Uint8Array(32);
      payload.fill(0);
      
      const encoded = encodeMxRadix32Frame(payload);
      
      // Should return a string
      expect(typeof encoded).toBe('string');
      
      // Should use Minima-safe characters (no i, l, o)
      expect(encoded).not.toMatch(/[ilo]/);
      
      // Should start with Mx prefix
      expect(encoded.startsWith('Mx')).toBe(true);
    });

    test('should encode different payloads differently', () => {
      const payload1 = new Uint8Array(32).fill(0);
      const payload2 = new Uint8Array(32).fill(255);
      
      const encoded1 = encodeMxRadix32Frame(payload1);
      const encoded2 = encodeMxRadix32Frame(payload2);
      
      expect(encoded1).not.toBe(encoded2);
    });

    test('encodeMxRadix32Frame accepts any size, but makeMxAddress requires 32 bytes', () => {
      // encodeMxRadix32Frame is a low-level radix-32 encoder, accepts any size
      const smallPayload = new Uint8Array(10);
      expect(() => encodeMxRadix32Frame(smallPayload)).not.toThrow();
      
      // makeMxAddress enforces 32-byte requirement
      expect(() => makeMxAddress(smallPayload)).toThrow(/exactly 32 bytes/);
    });

    test('should encode with checksum validation', () => {
      const payload = new Uint8Array(32);
      // Set a known pattern
      for (let i = 0; i < 32; i++) {
        payload[i] = i;
      }
      
      const encoded = encodeMxRadix32Frame(payload);
      
      // Should be decodable
      expect(() => decodeMxRadix32Frame(encoded)).not.toThrow();
    });
  });

  describe('decodeMxRadix32Frame', () => {
    test('should decode a valid Minima Base32 address', () => {
      const payload = new Uint8Array(32);
      payload.fill(42);
      
      const encoded = encodeMxRadix32Frame(payload);
      const decoded = decodeMxRadix32Frame(encoded);
      
      // Should return the original payload
      expect(decoded).toEqual(payload);
    });

    test('should roundtrip encode/decode correctly', () => {
      const original = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        original[i] = Math.floor(Math.random() * 256);
      }
      
      const encoded = encodeMxRadix32Frame(original);
      const decoded = decodeMxRadix32Frame(encoded);
      
      expect(decoded).toEqual(original);
    });

    test('should decode addresses with or without Mx prefix', () => {
      const payload = new Uint8Array(32).fill(123);
      const address = makeMxAddress(payload);
      
      // parseMxAddress validates the full structure including sentinel and checksum
      const parsed = parseMxAddress(address);
      expect(parsed).toEqual(payload);
      
      // decodeMxRadix32Frame just decodes the base32, handles Mx prefix if present
      const withPrefix = decodeMxRadix32Frame(address);
      const withoutPrefix = decodeMxRadix32Frame(address.slice(2));
      expect(withPrefix).toEqual(withoutPrefix); // both should decode to same result
    });

    test('should detect corrupted data via parseMxAddress checksum validation', () => {
      const payload = new Uint8Array(32).fill(0);
      const address = makeMxAddress(payload);
      
      // Corrupt a character in the middle (will fail checksum validation in parseMxAddress)
      const corrupted = address.slice(0, 10) + 'X' + address.slice(11);
      
      // parseMxAddress validates checksum, decodeMxRadix32Frame does not
      expect(() => parseMxAddress(corrupted)).toThrow();
    });

    test('should handle case-insensitive decoding', () => {
      const payload = new Uint8Array(32).fill(42);
      const encoded = encodeMxRadix32Frame(payload);
      
      // Should decode uppercase (as encoded)
      const decoded1 = decodeMxRadix32Frame(encoded);
      expect(decoded1).toEqual(payload);
      
      // Should also decode lowercase
      const decoded2 = decodeMxRadix32Frame(encoded.toLowerCase());
      expect(decoded2).toEqual(payload);
    });
  });

  describe('makeMxAddress', () => {
    test('should create a valid Mx address from public key digest', () => {
      const pkDigest = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        pkDigest[i] = i * 8;
      }
      
      const address = makeMxAddress(pkDigest);
      
      // Should start with Mx
      expect(address.startsWith('Mx')).toBe(true);
      
      // Should be parseable
      const parsed = parseMxAddress(address);
      expect(parsed).toEqual(pkDigest);
    });

    test('should create different addresses for different digests', () => {
      const digest1 = new Uint8Array(32).fill(1);
      const digest2 = new Uint8Array(32).fill(2);
      
      const addr1 = makeMxAddress(digest1);
      const addr2 = makeMxAddress(digest2);
      
      expect(addr1).not.toBe(addr2);
    });

    test('should be deterministic', () => {
      const digest = new Uint8Array(32);
      digest.fill(123);
      
      const addr1 = makeMxAddress(digest);
      const addr2 = makeMxAddress(digest);
      
      expect(addr1).toBe(addr2);
    });
  });

  describe('parseMxAddress', () => {
    test('should parse a valid Mx address to public key digest', () => {
      const originalDigest = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        originalDigest[i] = i * 3;
      }
      
      const address = makeMxAddress(originalDigest);
      const parsed = parseMxAddress(address);
      
      expect(parsed).toEqual(originalDigest);
    });

    test('should roundtrip makeMxAddress/parseMxAddress', () => {
      const digest = new Uint8Array(32);
      crypto.getRandomValues(digest);
      
      const address = makeMxAddress(digest);
      const parsedBack = parseMxAddress(address);
      
      expect(parsedBack).toEqual(digest);
    });

    test('should throw on invalid address format', () => {
      expect(() => parseMxAddress('invalid')).toThrow();
      expect(() => parseMxAddress('0x1234567890')).toThrow();
      expect(() => parseMxAddress('')).toThrow();
    });
  });

  describe('Minima Character Substitution', () => {
    test('should not contain ambiguous characters i, l, o (case insensitive)', () => {
      const digest = new Uint8Array(32);
      
      // Test 100 random digests
      for (let j = 0; j < 100; j++) {
        crypto.getRandomValues(digest);
        const address = makeMxAddress(digest);
        
        // Should never contain i, l, or o (case insensitive)
        expect(address.toLowerCase()).not.toMatch(/[ilo]/);
      }
    });

    test('should use Minima-safe alphabet with uppercase output', () => {
      const digest = new Uint8Array(32);
      crypto.getRandomValues(digest);
      
      const address = makeMxAddress(digest);
      
      // Should be uppercase after Mx prefix (per spec: uppercased, with swaps)
      const validChars = /^Mx[0-9A-Z]+$/;
      expect(address).toMatch(validChars);
      
      // When lowercased, should only use base32 chars with substitutions (w, y, z instead of i, l, o)
      const lower = address.slice(2).toLowerCase();
      const validLowerChars = /^[0123456789abcdefghjkmnpqrstuvwxyz]+$/;
      expect(lower).toMatch(validLowerChars);
    });
  });

  describe('Edge Cases', () => {
    test('should handle all-zeros digest', () => {
      const zeros = new Uint8Array(32).fill(0);
      const address = makeMxAddress(zeros);
      const parsed = parseMxAddress(address);
      
      expect(parsed).toEqual(zeros);
    });

    test('should handle all-ones digest', () => {
      const ones = new Uint8Array(32).fill(255);
      const address = makeMxAddress(ones);
      const parsed = parseMxAddress(address);
      
      expect(parsed).toEqual(ones);
    });

    test('should handle sequential pattern', () => {
      const sequential = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        sequential[i] = i;
      }
      
      const address = makeMxAddress(sequential);
      const parsed = parseMxAddress(address);
      
      expect(parsed).toEqual(sequential);
    });
  });
});
