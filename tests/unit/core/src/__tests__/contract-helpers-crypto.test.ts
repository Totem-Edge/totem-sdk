/**
 * RFC-031 Fix A: contract-helpers must be Bare-safe. Its SHA-256 (used by
 * HTLCHelper 'sha2' preimages) now comes from @noble/hashes and its randomness
 * from globalThis.crypto — both byte-exact with the previous node:crypto impl.
 */
import { createHash } from 'node:crypto';
import { HTLCHelper } from '../scripts/contract-helpers.js';

const strip = (h: string) => h.replace(/^0x/i, '').toUpperCase();

describe('contract-helpers portable crypto', () => {
  it('HTLCHelper.hashPreimage(sha2) matches node:crypto byte-for-byte', () => {
    for (let i = 0; i < 64; i++) {
      const bytes = Uint8Array.from({ length: i % 64 }, () => Math.floor(Math.random() * 256));
      const pre = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
      const got = strip(HTLCHelper.hashPreimage(pre, 'sha2'));
      const expected = createHash('sha256').update(bytes).digest('hex').toUpperCase();
      expect(got).toBe(expected);
    }
  });

  it('HTLCHelper.generateSecret returns a 32-byte preimage and its SHA3-256 hash', () => {
    const s = HTLCHelper.generateSecret();
    expect(strip(s.preimage)).toHaveLength(64);
    expect(strip(s.hash)).toHaveLength(64);
    expect(strip(s.hash)).toBe(strip(HTLCHelper.hashPreimage(s.preimage, 'sha3')));
  });
});
