/**
 * Claim signing using WOTS primitives from @totemsdk/core.
 *
 * The caller is responsible for reserving the WOTS key index via
 * @totemsdk/wots-lease before calling signIdentityClaim. This package does
 * NOT depend on @totemsdk/wots-lease.
 */

import { sha3_256 } from '@totemsdk/core';
import {
  wotsSign,
  wotsKeypairFromSeed,
  wotsAddressFromKeypair,
  bytesToHex,
} from '@totemsdk/core';
import { canonicalJson } from './canonical.js';
import type { IdentityClaim, SignedIdentityClaim } from './types.js';

export function claimDigest(claim: IdentityClaim): Uint8Array {
  const canonical = canonicalJson(claim);
  return sha3_256(new TextEncoder().encode(canonical));
}

export async function signIdentityClaim(
  claim: IdentityClaim,
  seed: Uint8Array,
  keyIndex: number,
): Promise<SignedIdentityClaim> {
  const digest = claimDigest(claim);
  const sigBytes = wotsSign(seed, keyIndex, digest);
  const kp = wotsKeypairFromSeed(seed, keyIndex);
  const address = wotsAddressFromKeypair(kp);

  return {
    claim,
    proof: {
      address,
      publicKey: bytesToHex(kp.pk),
      signature: bytesToHex(sigBytes),
    },
  };
}
