/**
 * RFC-031 Fix A: contract-helpers must be Bare-safe. Its SHA-256 (used by
 * HTLCHelper 'sha2' preimages) now comes from @noble/hashes and its randomness
 * from globalThis.crypto — both byte-exact with the previous node:crypto impl.
 */
import { createHash } from 'node:crypto';
import { HTLCHelper } from '../scripts/contract-helpers.js';
import { createHTLCDescriptor } from '../scripts/types.js';

const strip = (h: string) => h.replace(/^0x/i, '').toUpperCase();

const OWNER = '0x' + '11'.repeat(32);
const RECIPIENT = '0x' + '22'.repeat(32);
const PREIMAGE = '0x' + '33'.repeat(32);
const HASHLOCK = '0x' + '44'.repeat(32);

const kiss = (h: string) => '0x' + strip(h);

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

  it('HTLC claim branch is time-bounded to the refund branch (RFC-069 §6 invariant 5)', () => {
    const { script } = HTLCHelper.createHTLC(OWNER, RECIPIENT, HASHLOCK, 1000n, 'sha3');
    expect(script).toBe(
      `IF @BLOCK GT 1000 THEN RETURN SIGNEDBY(${kiss(OWNER)}) ENDIF RETURN (SIGNEDBY(${kiss(RECIPIENT)}) AND SHA3(STATE(1)) EQ ${kiss(HASHLOCK)})`,
    );
    // The legacy template's claim branch had no upper bound; it must not return.
    expect(script).not.toContain('@BLOCK GT 1000 AND SIGNEDBY');
  });

  it('HTLC descriptor and helper emit the same script', () => {
    const { script, address } = HTLCHelper.createHTLC(OWNER, RECIPIENT, HASHLOCK, 1000n, 'sha3');
    const desc = createHTLCDescriptor(address, OWNER, RECIPIENT, HASHLOCK, 1000n, false, PREIMAGE);
    expect(desc.script).toBe(script);
    expect(desc.stateVariables).toEqual([{ port: 1, value: PREIMAGE, type: 'hex' }]);
  });

  it('HTLC sha2 variant uses SHA2 and stays time-bounded', () => {
    const { script } = HTLCHelper.createHTLC(OWNER, RECIPIENT, HASHLOCK, 1000n, 'sha2');
    expect(script).toContain('SHA2(STATE(1))');
    expect(script).toContain('IF @BLOCK GT 1000 THEN RETURN SIGNEDBY(');
  });
});
