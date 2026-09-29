/**
 * RFC-020 C5: `validateExternalSignature` must actually verify, and
 * `aggregateSignatures` must never include an unverified signature.
 */
import { wotsKeypairFromSeed, wotsSign, bytesToHex } from '@totemsdk/core';
import { validateExternalSignature, aggregateSignatures } from '../witness-serializer.js';
import type { ExternalSignature } from '../types.js';

const seed = new Uint8Array(32).fill(7);
const kp = wotsKeypairFromSeed(seed, 0);
const digest = new Uint8Array(32).fill(0x11);
const sig = wotsSign(seed, 0, digest);
const pkHex = '0x' + bytesToHex(kp.pk);
const sigHex = '0x' + bytesToHex(sig);

describe('RFC-020 C5: validateExternalSignature / aggregateSignatures', () => {
  it('accepts a real WOTS signature over the digest', () => {
    expect(validateExternalSignature({ publicKey: pkHex, signature: sigHex, signatureType: 'wots' }, digest)).toBe(true);
  });

  it('rejects junk signatures, wrong digests and non-wots types', () => {
    expect(validateExternalSignature({ publicKey: pkHex, signature: '0x' + 'de'.repeat(1088), signatureType: 'wots' }, digest)).toBe(false);
    expect(validateExternalSignature({ publicKey: pkHex, signature: sigHex, signatureType: 'wots' }, new Uint8Array(32).fill(0x22))).toBe(false);
    expect(validateExternalSignature({ publicKey: pkHex, signature: sigHex, signatureType: 'standard' }, digest)).toBe(false);
  });

  it('refuses to aggregate an invalid totem signature', () => {
    expect(() =>
      aggregateSignatures({ publicKey: kp.pk, signature: new Uint8Array(1088) }, [], digest),
    ).toThrow(/invalid/);
  });

  it('drops an unverified external signature but keeps a valid one', () => {
    const good: ExternalSignature = { publicKey: pkHex, signature: sigHex, signatureType: 'wots', validated: true };
    const bad: ExternalSignature = { publicKey: pkHex, signature: '0x' + 'de'.repeat(1088), signatureType: 'wots', validated: true };
    const out = aggregateSignatures({ publicKey: kp.pk, signature: sig }, [good, bad], digest);
    expect(out).toHaveLength(2); // totem + good only
  });
});
