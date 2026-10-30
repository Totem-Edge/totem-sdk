/**
 * RFC-008 Phase 1 — SE signature envelope verification (leased one-time leaves).
 *
 * Exercises the client-side gate that replaced the single fixed `sePublicKey`
 * check: a `child` envelope must be authorized by the SE root's `OwnershipProof`
 * and carry a valid one-time signature; a `root` envelope must be the published
 * root identity.
 */

import { bytesToHex } from '@totemsdk/core';
import { verifySeSignatureEnvelope } from '../verify.js';
import type { StateChain, SESignature, SeOwnershipProof } from '../types.js';

const ROOT_PK = 'aa'.repeat(32);
const CHILD_PK = 'bb'.repeat(32);
const CHILD_ADDR = 'child-addr';
const commitment = new Uint8Array(32).fill(9);
const message = bytesToHex(commitment);

const ownershipProof: SeOwnershipProof = {
  rootAddress: 'root-addr',
  rootPublicKey: ROOT_PK,
  childAddresses: [CHILD_ADDR],
  childPublicKeys: [CHILD_PK],
  rootProof: { address: 'root-addr', publicKey: ROOT_PK, signature: '00', message: 'm' },
  timestamp: 't',
};

function chain(overrides: Partial<StateChain> = {}): StateChain {
  return {
    sePublicKey: ROOT_PK,
    seOwnershipProof: ownershipProof,
    ...overrides,
  } as unknown as StateChain;
}

function envelope(overrides: Partial<SESignature> = {}): SESignature {
  return {
    kind: 'child',
    member: 'se',
    childIndex: 0,
    address: CHILD_ADDR,
    publicKey: CHILD_PK,
    signature: '00',
    message,
    proofVersion: 1,
    ...overrides,
  };
}

describe('verifySeSignatureEnvelope (RFC-008)', () => {
  it('rejects a child envelope whose leaf is not in the ownership proof', () => {
    expect(verifySeSignatureEnvelope(envelope({ publicKey: 'cc'.repeat(32) }), commitment, chain())).toBe(false);
  });

  it('rejects a child envelope whose address is not authorized', () => {
    expect(verifySeSignatureEnvelope(envelope({ address: 'other-addr' }), commitment, chain())).toBe(false);
  });

  it('rejects an envelope signed over a different message', () => {
    expect(verifySeSignatureEnvelope(envelope({ message: 'deadbeef' }), commitment, chain())).toBe(false);
  });

  it('rejects a child envelope with no published ownership proof', () => {
    expect(verifySeSignatureEnvelope(envelope(), commitment, chain({ seOwnershipProof: undefined }))).toBe(false);
  });

  it('rejects a root envelope that is not the published root', () => {
    expect(verifySeSignatureEnvelope(envelope({ kind: 'root', publicKey: 'cc'.repeat(32) }), commitment, chain())).toBe(false);
  });

  it('does not accept a member leaf with an invalid one-time signature', () => {
    // Authorization passes, but the bogus signature must still fail closed.
    expect(verifySeSignatureEnvelope(envelope(), commitment, chain())).toBe(false);
  });
});
