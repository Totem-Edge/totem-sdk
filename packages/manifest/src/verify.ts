/**
 * verifyManifest — verifies a SignedManifest without external state.
 *
 * Steps:
 *   1. Recompute the canonical manifest digest.
 *   2. Verify the WOTS signature against the stored 32-byte PKdigest
 *      (signerPublicKey field) using wotsVerifyDigest.
 *   3. Confirm authorAddress matches the manifest's address field.
 *
 * wotsVerifyDigest is used (rather than wotsVerify) because signerPublicKey
 * stores the 32-byte WOTS PKdigest as returned by wotsKeypairFromSeed.kp.pk.
 * The full 1088-byte key is not stored in SignedManifest to keep it compact.
 */

import { wotsVerifyDigest, hexToBytes } from '@totemsdk/core';
import type { SignedManifest, VerifyResult } from './types.js';
import { manifestDigest } from './sign.js';

function manifestAddressField(manifest: SignedManifest['manifest']): string {
  switch (manifest.type) {
    case 'app':          return manifest.authorAddress;
    case 'capability':   return manifest.agentAddress;
    case 'dapp':         return manifest.authorAddress;
    case 'edge-service': return manifest.operatorAddress;
    default: {
      const _exhaustive: never = manifest;
      throw new Error(`verifyManifest: unknown manifest type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export function verifyManifest(signed: SignedManifest): VerifyResult {
  const { manifest, signature, signerPublicKey, authorAddress } = signed;

  let sigBytes: Uint8Array;
  let pkDigest: Uint8Array;
  try {
    sigBytes = hexToBytes(signature);
    pkDigest = hexToBytes(signerPublicKey);
  } catch (e) {
    return { valid: false, reason: `hex decode failed: ${String(e)}`, signerAddress: authorAddress };
  }

  const digest = manifestDigest(manifest);

  let sigValid: boolean;
  try {
    sigValid = wotsVerifyDigest(sigBytes, digest, pkDigest);
  } catch (e) {
    return { valid: false, reason: `WOTS verify threw: ${String(e)}`, signerAddress: authorAddress };
  }

  if (!sigValid) {
    return { valid: false, reason: 'WOTS signature invalid', signerAddress: authorAddress };
  }

  const expectedAddress = manifestAddressField(manifest);
  if (authorAddress !== expectedAddress) {
    return {
      valid: false,
      reason: `authorAddress mismatch: signed by '${authorAddress}' but manifest declares '${expectedAddress}'`,
      signerAddress: authorAddress,
    };
  }

  return { valid: true, signerAddress: authorAddress };
}
