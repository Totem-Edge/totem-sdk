/**
 * Claim verification.
 *
 * verifyIdentityClaim recomputes the canonical claim digest from signed.claim
 * using canonicalJson. It does NOT use proof.message as the source of truth —
 * that field is optional debug/display metadata only.
 *
 * Security: proof.address is bound to proof.publicKey by re-deriving the
 * expected address from the public key. Any mismatch fails verification,
 * preventing signer-address spoofing.
 */

import { wotsVerifyDigest, hexToBytes, scriptFromWotsPk, scriptToAddress } from '@totemsdk/core';
import { claimDigest } from './signing.js';
import type { SignedIdentityClaim, IdentityVerifyResult } from './types.js';

/**
 * Derive the Minima address from a 32-byte WOTS PKdigest (hex).
 * Returns null if the public key cannot be decoded.
 */
function addressFromPkDigest(publicKeyHex: string): string | null {
  try {
    const pkDigest = hexToBytes(publicKeyHex);
    const script = scriptFromWotsPk(pkDigest);
    return scriptToAddress(script);
  } catch {
    return null;
  }
}

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

  // Bind proof.address to proof.publicKey — derive expected address from the public key
  // and verify it matches proof.address. This prevents signer-address spoofing.
  const expectedAddress = addressFromPkDigest(proof.publicKey);
  if (expectedAddress === null) {
    return {
      valid: false,
      reason: 'could not derive address from proof.publicKey',
      signerAddress: proof.address,
    };
  }
  if (expectedAddress !== proof.address) {
    return {
      valid: false,
      reason: `proof.address '${proof.address}' does not match address derived from proof.publicKey '${expectedAddress}'`,
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
