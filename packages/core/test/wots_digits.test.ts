/**
 * WOTS Winternitz Digit Tests (BouncyCastle Compatible)
 * 
 * With BouncyCastle-compatible refactoring (2026-01):
 * - w=8 means 8 BITS per digit (not base-8)
 * - Each byte of the hash IS one digit (0-255)
 * - L=34 total chains (32 message + 2 checksum)
 * 
 * This matches BouncyCastle's WinternitzOTSignature used by Minima's Winternitz.java
 */
import { describe, it, expect } from 'vitest';
import { toWinternitzDigits } from '../dist/wots';
import { getParamSet } from '../dist/params';

const bytes = (fill: number) => new Uint8Array(Array(32).fill(fill & 0xff));

describe('toWinternitzDigits', () => {
  it('w=8 produces 34 total digits (32 msg + 2 checksum)', () => {
    const h = bytes(0x99);
    const ps = getParamSet();
    const { digits, checksumDigits, total } = toWinternitzDigits(h, ps);
    
    expect(digits.length).toBe(32);
    expect(checksumDigits.length).toBe(2);
    expect(total).toBe(34);
  });

  it('w=8 is deterministic', () => {
    const h = bytes(0x42);
    const ps = getParamSet();
    const a = toWinternitzDigits(h, ps);
    const b = toWinternitzDigits(h, ps);
    
    expect(a.total).toBe(34);
    expect(b.total).toBe(34);
    expect(a.digits).toEqual(b.digits);
    expect(a.checksumDigits).toEqual(b.checksumDigits);
  });

  it('w=8 message digits are each byte of the hash (0-255)', () => {
    const h = bytes(0xff);
    const ps = getParamSet();
    const { digits } = toWinternitzDigits(h, ps);
    
    // Each digit should be the byte value (all 0xff in this case)
    for (const d of digits) {
      expect(d).toBe(0xff);
    }
  });

  it('w=8 checksum is computed correctly (8192 - sum)', () => {
    // With all zeros: sum = 0, checksum = 8192
    const h = bytes(0x00);
    const ps = getParamSet();
    const { digits, checksumDigits } = toWinternitzDigits(h, ps);
    
    const sum = digits.reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
    
    // Checksum = (32 << 8) - sum = 8192 - 0 = 8192 = 0x2000
    // Extracted as 2 digits: [0x00, 0x20] (little-endian extraction)
    // BC extracts: c & 0xff, c >>>= 8 → [0x00, 0x20]
    const checksum = (checksumDigits[1] << 8) | checksumDigits[0];
    expect(checksum).toBe(8192);
  });

  it('w=8 checksum with non-zero hash', () => {
    // With all 0x80 (128): sum = 32 * 128 = 4096, checksum = 8192 - 4096 = 4096
    const h = bytes(0x80);
    const ps = getParamSet();
    const { digits, checksumDigits } = toWinternitzDigits(h, ps);
    
    const sum = digits.reduce((a, b) => a + b, 0);
    expect(sum).toBe(4096);
    
    // Checksum = 8192 - 4096 = 4096 = 0x1000
    const checksum = (checksumDigits[1] << 8) | checksumDigits[0];
    expect(checksum).toBe(4096);
  });

  it('throws error for unsupported w values', () => {
    const h = bytes(0x11);
    const badPs = { ...getParamSet(), w: 16 } as any;
    expect(() => toWinternitzDigits(h, badPs)).toThrow('Only w=8 is supported');
  });
});
