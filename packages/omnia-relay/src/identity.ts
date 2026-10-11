/**
 * Channel participant identity verification (RFC-037 Amendment A).
 *
 * A wallet's Omnia identity is anchored to its root identity
 * (`@totemsdk/root-identity`): `partyId` is the `@totemsdk/identity` id derived
 * from the root address, while the channel signing key is a per-address child
 * TreeKey. The link is proven by an `OwnershipProof` the root key signs over the
 * child public key(s). This module verifies that binding; the root key never
 * enters the on-chain channel script.
 *
 * Identity is optional during the RFC-037 migration: a participant without an
 * `identity` block is accepted (`valid: true`) so existing channels keep working.
 */

import { UnifiedIdentityWallet } from '@totemsdk/root-identity';
import type { OwnershipProof } from '@totemsdk/root-identity';
import { computeIdentityId } from '@totemsdk/identity';
import type { ChannelParticipant } from '@totemsdk/omnia';

/** Identity kind for a self-custody wallet (`@totemsdk/identity`). */
export const WALLET_IDENTITY_KIND = 'person' as const;

export interface IdentityVerificationResult {
  valid: boolean;
  errors: string[];
}

/** Strip `0x` and lower-case for format-agnostic comparison. */
function normalizeHex(value: string): string {
  return value.replace(/^0x/i, '').toLowerCase();
}

/**
 * Verify a channel participant's root-identity anchor (RFC-037-A).
 *
 * Fails closed: any malformed proof, mismatch, or missing child key ⇒ invalid.
 * A participant without `identity` is valid (identity is optional).
 */
export function verifyChannelParticipantIdentity(
  participant: ChannelParticipant,
): IdentityVerificationResult {
  const identity = participant.identity;
  if (!identity) return { valid: true, errors: [] };

  const errors: string[] = [];
  try {
    const proof = identity.ownershipProof as OwnershipProof;

    if (!UnifiedIdentityWallet.verifyOwnershipProof(proof)) {
      errors.push('ownership proof is invalid');
    }
    if (normalizeHex(proof.rootAddress) !== normalizeHex(identity.rootAddress)) {
      errors.push('ownership proof rootAddress does not match identity');
    }
    if (normalizeHex(proof.rootPublicKey) !== normalizeHex(identity.rootPublicKey)) {
      errors.push('ownership proof rootPublicKey does not match identity');
    }

    const childKeys = proof.childPublicKeys.map(normalizeHex);
    if (!childKeys.includes(normalizeHex(participant.publicKeyDigest))) {
      errors.push('participant channel key is not listed in the ownership proof');
    }

    const expectedId = computeIdentityId(WALLET_IDENTITY_KIND, identity.rootAddress);
    if (identity.id !== expectedId) {
      errors.push('identity id does not match computeIdentityId(rootAddress)');
    }
  } catch (err) {
    errors.push(`identity verification error: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { valid: errors.length === 0, errors };
}
