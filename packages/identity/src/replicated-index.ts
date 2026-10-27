/**
 * RFC-057 Phase 4 — replicated identity claim discovery index.
 *
 * The index stores signed claims only. Writes verify the claim before indexing
 * and every read verifies it again; discovery never upgrades an invalid claim
 * into trusted identity state.
 */

import { verifyIdentityClaim } from './verify.js';
import type { SignedIdentityClaim } from './types.js';

export interface IdentityIndexPort {
  get(key: string): Promise<unknown | null>;
  put(key: string, value: unknown): Promise<void>;
  list?(prefix?: string): AsyncIterable<{ key: string; value: unknown }>;
}

export interface StoredIdentityClaim {
  readonly subject: string;
  readonly claimId: string;
  readonly signed: SignedIdentityClaim;
}

const PREFIX = 'identity:claim:';

function keyFor(subject: string, claimId: string): string {
  return `${PREFIX}${subject}:${claimId}`;
}

export class ReplicatedIdentityClaimIndex {
  constructor(private readonly index: IdentityIndexPort) {}

  async putClaim(signed: SignedIdentityClaim): Promise<boolean> {
    const verification = verifyIdentityClaim(signed);
    if (!verification.valid) return false;
    const { subject, id } = signed.claim;
    if (!subject || !id) throw new Error('identity claim requires subject and id');
    await this.index.put(keyFor(subject, id), { subject, claimId: id, signed });
    return true;
  }

  async claimsFor(subject: string): Promise<SignedIdentityClaim[]> {
    const claims: SignedIdentityClaim[] = [];
    if (!this.index.list) return claims;
    for await (const entry of this.index.list(`${PREFIX}${subject}:`)) {
      const stored = entry.value as StoredIdentityClaim;
      if (verifyIdentityClaim(stored.signed).valid) claims.push(stored.signed);
    }
    return claims;
  }
}
