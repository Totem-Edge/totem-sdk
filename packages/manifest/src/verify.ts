/**
 * verifyManifest — verifies a SignedManifest without external state.
 *
 * Steps:
 *   1. Recompute the canonical manifest digest.
 *   2. Verify the serialized TreeSignature against the stored tree-root public
 *      key (signerPublicKey field) using `verifyTreeSignature` (RFC-037).
 *   3. Confirm authorAddress matches the manifest's address field.
 */

import {
  deserializeTreeSignature,
  hexToBytes,
  scriptFromWotsPk,
  scriptToAddress,
  verifyTreeSignature,
} from '@totemsdk/core';
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
    sigValid = verifyTreeSignature(pkDigest, digest, deserializeTreeSignature(sigBytes));
  } catch (e) {
    return { valid: false, reason: `WOTS verify threw: ${String(e)}`, signerAddress: authorAddress };
  }

  if (!sigValid) {
    return { valid: false, reason: 'WOTS signature invalid', signerAddress: authorAddress };
  }

  // The signature proves control of signerPublicKey. The claimed author must be
  // the address derived from that key. Without this check an attacker can sign a
  // manifest that declares a victim address and simply copy that address into
  // the wrapper.
  let derivedAddress: string;
  try {
    derivedAddress = scriptToAddress(scriptFromWotsPk(pkDigest));
  } catch (e) {
    return {
      valid: false,
      reason: `signerPublicKey cannot derive an address: ${String(e)}`,
      signerAddress: authorAddress,
    };
  }

  if (authorAddress !== derivedAddress) {
    return {
      valid: false,
      reason: `authorAddress mismatch: signed by '${derivedAddress}' but wrapper claims '${authorAddress}'`,
      signerAddress: derivedAddress,
    };
  }

  const expectedAddress = manifestAddressField(manifest);
  if (expectedAddress !== derivedAddress) {
    return {
      valid: false,
      reason: `authorAddress mismatch: signed by '${derivedAddress}' but manifest declares '${expectedAddress}'`,
      signerAddress: derivedAddress,
    };
  }

  return { valid: true, signerAddress: derivedAddress };
}
