/**
 * RFC-037 Amendment A — channel participant identity verification.
 *
 * partyId = root-identity id; the channel key (publicKeyDigest) is a child
 * address; the root identity signs an ownership proof binding them.
 */

import { UnifiedIdentityWallet } from '@totemsdk/root-identity';
import { computeIdentityId } from '@totemsdk/identity';
import type { ChannelParticipant } from '@totemsdk/omnia';
import { verifyChannelParticipantIdentity, WALLET_IDENTITY_KIND } from '../identity.js';

const wallet = new UnifiedIdentityWallet(new Uint8Array(32).fill(11), 64);
const rootAddress = wallet.getRootAddress();
const rootPublicKey = wallet.getRootPublicKey();
const identityId = computeIdentityId(WALLET_IDENTITY_KIND, rootAddress);

function participantFor(childIndex: number, overrides: Partial<ChannelParticipant> = {}): ChannelParticipant {
  const proof = wallet.proveOwnership([childIndex]);
  return {
    partyId: identityId,
    publicKeyDigest: '0x' + wallet.getChildPublicKey(childIndex).toLowerCase(),
    addressIndex: childIndex,
    identity: { id: identityId, rootAddress, rootPublicKey, ownershipProof: proof },
    ...overrides,
  };
}

describe('verifyChannelParticipantIdentity (RFC-037-A)', () => {
  it('accepts a participant bound to the root identity', () => {
    const result = verifyChannelParticipantIdentity(participantFor(0));
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('accepts a participant with no identity (migration)', () => {
    const result = verifyChannelParticipantIdentity({
      partyId: 'x',
      publicKeyDigest: '0x' + 'ab'.repeat(32),
      addressIndex: 0,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects a channel key not listed in the ownership proof', () => {
    const p = participantFor(0);
    p.publicKeyDigest = '0x' + 'cd'.repeat(32);
    const result = verifyChannelParticipantIdentity(p);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/not listed/);
  });

  it('rejects a mismatched identity id', () => {
    const p = participantFor(0);
    p.identity = { ...p.identity!, id: computeIdentityId(WALLET_IDENTITY_KIND, '0xDEAD') };
    const result = verifyChannelParticipantIdentity(p);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/identity id/);
  });

  it('rejects a tampered ownership proof', () => {
    const p = participantFor(0);
    p.identity = {
      ...p.identity!,
      ownershipProof: { ...p.identity!.ownershipProof, rootPublicKey: 'ab'.repeat(32) },
    };
    const result = verifyChannelParticipantIdentity(p);
    expect(result.valid).toBe(false);
  });
});
