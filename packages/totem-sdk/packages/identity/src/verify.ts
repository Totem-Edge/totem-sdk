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

import { wotsVerifyDigest, hexToBytes, scriptFromWotsPk, scriptToAddress } from '@totemsdk/core';
import { claimDigest } from './signing.js';
import type { SignedIdentityClaim, IdentityVerifyResult } from './types.js';

export function verifyIdentityClaim(signed: SignedIdentityClaim): IdentityVerifyResult {
  const { claim, proof } = signed;

  // Address/public-key binding check:
  // Derive the expected Minima address from the WOTS public-key digest using
  // scriptFromWotsPk + scriptToAddress (same derivation as signIdentityClaim).
  // Rejects claims where an attacker sets proof.address to a privileged address
  // while signing with a different key.
  let pkBytes: Uint8Array;
  try {
    pkBytes = hexToBytes(proof.publicKey);
  } catch (e) {
    return {
      valid: false,
      reason: `publicKey hex decode failed: ${String(e)}`,
      signerAddress: proof.address,
    };
  }
  try {
    const expectedAddress = scriptToAddress(scriptFromWotsPk(pkBytes));
    if (expectedAddress !== proof.address) {
      return {
        valid: false,
        reason: 'public key does not match declared address',
        signerAddress: proof.address,
      };
    }
  } catch (e) {
    return {
      valid: false,
      reason: `address derivation failed: ${String(e)}`,
      signerAddress: proof.address,
    };
  }

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
