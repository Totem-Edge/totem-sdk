/**
 * Claim verification.
 *
 * verifyIdentityClaim recomputes the canonical claim digest from signed.claim
 * using canonicalJson. It does NOT use proof.message as the source of truth —
 * that field is optional debug/display metadata only.
 *
 * The public-key-to-address binding is not checked here because the address
 * derivation from the public key requires internal state only available at
 * signing time. The WOTS signature itself binds the public key to the message;
 * callers who need an address-to-key binding should independently verify that
 * through an identity proof or other trust mechanism.
 */

import { wotsVerifyDigest, hexToBytes } from '@totemsdk/core';
import { claimDigest } from './signing.js';
import type { SignedIdentityClaim, IdentityVerifyResult } from './types.js';

export function verifyIdentityClaim(signed: SignedIdentityClaim): IdentityVerifyResult {
  const { claim, proof } = signed;

  let sigBytes: Uint8Array;
  let pkDigest: Uint8Array;
  try {
    sigBytes = hexToBytes(proof.signature);
    pkDigest = hexToBytes(proof.publicKey);
  } catch (e) {
    return {
      valid: false,
      reason: `hex decode failed: ${String(e)}`,
      signerAddress: proof.address,
    };
  }

  const digest = claimDigest(claim);

  let sigValid: boolean;
  try {
    sigValid = wotsVerifyDigest(sigBytes, digest, pkDigest);
  } catch (e) {
    return {
      valid: false,
      reason: `WOTS verify threw: ${String(e)}`,
      signerAddress: proof.address,
    };
  }

  if (!sigValid) {
    return {
      valid: false,
      reason: 'WOTS signature invalid',
      signerAddress: proof.address,
    };
  }

  return {
    valid: true,
    signerAddress: proof.address,
  };
}
