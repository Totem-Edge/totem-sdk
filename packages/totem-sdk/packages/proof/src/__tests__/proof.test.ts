/**
 * @totemsdk/proof — test suite
 */

import {
  canonicalJson,
  computeProofId,
  hashProofPayload,
  hashEvidence,
  toHex,
  createProof,
  signProof,
  verifyProofSignature,
  verifyProofPayload,
  verifyProof,
  createAnchorCommitment,
  attachAnchor,
  verifyAnchorRef,
  createManifestProof,
  verifyManifestProof,
  createIdentityProof,
  verifyIdentityProof,
} from '../index';
import type { UnsignedProof, SignedProof, EvidenceRef } from '../index';

import { signManifest } from '@totemsdk/manifest';
import {
  signIdentityClaim,
  createDelegationClaim,
  createIdentityDocument,
} from '@totemsdk/identity';
import { wotsKeypairFromSeed, wotsAddressFromKeypair } from '@totemsdk/core';

function testSeed(n: number): Uint8Array {
  const s = new Uint8Array(32);
  s[0] = n & 0xff;
  s[1] = (n >> 8) & 0xff;
  return s;
}

const SEED_A = testSeed(1);
const SEED_B = testSeed(2);

function deriveAddress(seed: Uint8Array, keyIndex: number): string {
  const kp = wotsKeypairFromSeed(seed, keyIndex);
  return wotsAddressFromKeypair(kp);
}

// ─── 1. canonicalJson is stable across different key orderings ─────────────────

describe('canonicalJson', () => {
  it('produces identical output regardless of key insertion order', () => {
    const a = canonicalJson({ z: 1, a: 2, m: 3 });
    const b = canonicalJson({ m: 3, z: 1, a: 2 });
    const c = canonicalJson({ a: 2, m: 3, z: 1 });
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a).toBe('{"a":2,"m":3,"z":1}');
  });

  it('handles nested objects recursively', () => {
    const a = canonicalJson({ b: { y: 1, x: 2 }, a: 3 });
    const b = canonicalJson({ a: 3, b: { x: 2, y: 1 } });
    expect(a).toBe(b);
  });

  it('handles arrays (preserves order)', () => {
    const a = canonicalJson({ items: [3, 1, 2] });
    const b = canonicalJson({ items: [3, 1, 2] });
    expect(a).toBe(b);
    expect(a).toBe('{"items":[3,1,2]}');
  });
});

// ─── 2. computeProofId is deterministic ───────────────────────────────────────

describe('computeProofId', () => {
  it('returns the same ID for the same input', () => {
    const core = {
      kind: 'attestation' as const,
      subject: { id: 'subj-1', kind: 'device' },
      issuer: 'MxISSUER',
      issuedAt: 1000,
    };
    const id1 = computeProofId(core);
    const id2 = computeProofId(core);
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^totem:proof:/);
  });

  it('returns different IDs for different subjects', () => {
    const core1 = {
      kind: 'attestation' as const,
      subject: { id: 'subj-1', kind: 'device' },
      issuer: 'MxISSUER',
      issuedAt: 1000,
    };
    const core2 = {
      kind: 'attestation' as const,
      subject: { id: 'subj-2', kind: 'device' },
      issuer: 'MxISSUER',
      issuedAt: 1000,
    };
    expect(computeProofId(core1)).not.toBe(computeProofId(core2));
  });
});

// ─── 3. Wrapper metadata does not affect proofId ──────────────────────────────

describe('proofId immutability to wrapper metadata', () => {
  it('adding anchor/signature fields to a wrapper does not change proofId', () => {
    const proof = createProof({
      kind: 'attestation',
      subject: { id: 'subj-1', kind: 'device' },
      issuer: 'MxISSUER',
      issuedAt: 1000,
    });
    const proofId = proof.proofId;

    // Simulate wrapping with external metadata (as done by SignedProof)
    const wrapper = {
      ...proof,
      signature: { address: 'Mx...', publicKey: 'pk', signature: 'sig' },
      anchor: { provider: 'test', hash: 'abc123' },
      rootIdentityProof: 'some-proof-string',
    };

    // The proofId in the unsigned proof is unchanged
    expect(wrapper.proofId).toBe(proofId);
  });
});

// ─── 4. createProof produces a valid UnsignedProof ────────────────────────────

describe('createProof', () => {
  it('produces a UnsignedProof with all required fields', () => {
    const proof = createProof({
      kind: 'ownership',
      subject: { id: 'subj-2', kind: 'sensor', address: 'MxADDR' },
      issuer: 'MxISSUER',
      issuedAt: 5000,
      payload: { ref: 'extra' },
    });
    expect(proof.proofId).toMatch(/^totem:proof:/);
    expect(proof.kind).toBe('ownership');
    expect(proof.subject.id).toBe('subj-2');
    expect(proof.issuer).toBe('MxISSUER');
    expect(proof.issuedAt).toBe(5000);
    expect(proof.payload).toEqual({ ref: 'extra' });
  });

  it('defaults issuedAt to approximately now', () => {
    const before = Date.now();
    const proof = createProof({
      kind: 'custom',
      subject: { id: 'x', kind: 'y' },
      issuer: 'MxZ',
    });
    const after = Date.now();
    expect(proof.issuedAt).toBeGreaterThanOrEqual(before);
    expect(proof.issuedAt).toBeLessThanOrEqual(after);
  });

  it('includes evidence when provided', () => {
    const ev: EvidenceRef = { id: 'ev-1', kind: 'hash', hash: 'deadbeef' };
    const proof = createProof({
      kind: 'attestation',
      subject: { id: 'x', kind: 'y' },
      issuer: 'MxZ',
      evidence: [ev],
    });
    expect(proof.evidence).toHaveLength(1);
    expect(proof.evidence![0].id).toBe('ev-1');
  });
});

// ─── 5. sign → verifyProof round-trip ─────────────────────────────────────────

describe('signProof / verifyProof round-trip', () => {
  it('sign then verifyProof returns { valid: true }', async () => {
    const proof = createProof({
      kind: 'attestation',
      subject: { id: 'subj-rt', kind: 'device' },
      issuer: deriveAddress(SEED_A, 0),
      issuedAt: 1000,
    });
    const signed = signProof(proof, SEED_A, 0);
    const result = verifyProof(signed);
    expect(result.valid).toBe(true);
    expect(result.signerAddress).toBeDefined();
  }, 30000);
});

// ─── 6. Tampered subject fails verifyProofSignature ───────────────────────────

describe('verifyProofSignature tamper detection', () => {
  it('mutated subject.id fails signature verification', async () => {
    const proof = createProof({
      kind: 'attestation',
      subject: { id: 'original-subject', kind: 'device' },
      issuer: deriveAddress(SEED_A, 0),
      issuedAt: 1000,
    });
    const signed = signProof(proof, SEED_A, 0);

    const tampered: SignedProof = {
      ...signed,
      subject: { ...signed.subject, id: 'tampered-subject' },
    };

    expect(verifyProofSignature(tampered)).toBe(false);
  }, 30000);
});

// ─── 7. verifyProofPayload detects expired proof ──────────────────────────────

describe('verifyProofPayload', () => {
  it('returns false when expiresAt is in the past', async () => {
    const proof = createProof({
      kind: 'attestation',
      subject: { id: 'subj-exp', kind: 'device' },
      issuer: deriveAddress(SEED_A, 0),
      issuedAt: 1000,
      expiresAt: 1001, // already expired
    });
    const signed = signProof(proof, SEED_A, 0);
    expect(verifyProofPayload(signed)).toBe(false);
  }, 30000);

  it('returns true when expiresAt is in the future', async () => {
    const proof = createProof({
      kind: 'attestation',
      subject: { id: 'subj-future', kind: 'device' },
      issuer: deriveAddress(SEED_A, 0),
      issuedAt: 1000,
      expiresAt: Date.now() + 99999999,
    });
    const signed = signProof(proof, SEED_A, 0);
    expect(verifyProofPayload(signed)).toBe(true);
  }, 30000);
});

// ─── 8. verifyProof returns expired:true for expired proof ────────────────────

describe('verifyProof expiry', () => {
  it('returns { valid: false, expired: true } for expired proof', async () => {
    const proof = createProof({
      kind: 'attestation',
      subject: { id: 'subj-exp2', kind: 'device' },
      issuer: deriveAddress(SEED_A, 0),
      issuedAt: 1000,
      expiresAt: 1001, // past
    });
    const signed = signProof(proof, SEED_A, 0);
    const result = verifyProof(signed);
    expect(result.valid).toBe(false);
    expect(result.expired).toBe(true);
  }, 30000);
});

// ─── 9. signature.message field is ignored during verification ────────────────

describe('signature.message is ignored', () => {
  it('adding a wrong signature.message does not affect verifyProof result', async () => {
    const proof = createProof({
      kind: 'attestation',
      subject: { id: 'subj-msg', kind: 'device' },
      issuer: deriveAddress(SEED_A, 0),
      issuedAt: 1000,
    });
    const signed = signProof(proof, SEED_A, 0);

    const withFakeMessage: SignedProof = {
      ...signed,
      signature: { ...signed.signature, message: 'fake message that was never signed' },
    };

    const result = verifyProof(withFakeMessage);
    expect(result.valid).toBe(true);
  }, 30000);
});

// ─── 10. createAnchorCommitment is deterministic ──────────────────────────────

describe('createAnchorCommitment', () => {
  it('produces the same commitment for the same proof', async () => {
    const proof = createProof({
      kind: 'attestation',
      subject: { id: 'subj-anc', kind: 'device' },
      issuer: deriveAddress(SEED_A, 0),
      issuedAt: 1000,
    });
    const signed = signProof(proof, SEED_A, 0);
    const c1 = createAnchorCommitment(signed);
    const c2 = createAnchorCommitment(signed);
    expect(c1).toBe(c2);
    expect(typeof c1).toBe('string');
    expect(c1.length).toBeGreaterThan(0);
  }, 30000);

  it('produces different commitments for different proofs', async () => {
    const proof1 = createProof({
      kind: 'attestation',
      subject: { id: 'subj-anc-1', kind: 'device' },
      issuer: deriveAddress(SEED_A, 0),
      issuedAt: 1000,
    });
    const proof2 = createProof({
      kind: 'attestation',
      subject: { id: 'subj-anc-2', kind: 'device' },
      issuer: deriveAddress(SEED_A, 0),
      issuedAt: 1000,
    });
    const signed1 = signProof(proof1, SEED_A, 0);
    const signed2 = signProof(proof2, SEED_A, 0);
    expect(createAnchorCommitment(signed1)).not.toBe(createAnchorCommitment(signed2));
  }, 30000);
});

// ─── 11. attachAnchor preserves proofId ───────────────────────────────────────

describe('attachAnchor', () => {
  it('preserves proofId after attaching anchor', async () => {
    const proof = createProof({
      kind: 'attestation',
      subject: { id: 'subj-anch', kind: 'device' },
      issuer: deriveAddress(SEED_A, 0),
      issuedAt: 1000,
    });
    const signed = signProof(proof, SEED_A, 0);
    const commitment = createAnchorCommitment(signed);
    const anchored = attachAnchor(signed, {
      provider: 'test-provider',
      hash: commitment,
      txId: 'tx-abc',
    });

    expect(anchored.proofId).toBe(signed.proofId);
    expect(anchored.anchor).toBeDefined();
    expect(anchored.anchor!.provider).toBe('test-provider');
    expect(verifyAnchorRef(anchored, anchored.anchor!)).toBe(true);
  }, 30000);
});

// ─── 12. verifyManifestProof delegates to verifyManifest ──────────────────────

describe('verifyManifestProof', () => {
  it('returns valid when manifest and proof are both valid', async () => {
    const signerAddr = deriveAddress(SEED_A, 0);
    const manifest = {
      type: 'edge-service' as const,
      serviceId: 'svc-proof-test',
      name: 'Proof Test Service',
      version: '1.0.0',
      operatorAddress: signerAddr,
      serviceType: 'verifier' as const,
      description: 'test',
      capabilities: [],
      tags: [],
    };
    const signedManifest = await signManifest(manifest, SEED_A, 0);

    const unsignedProof = createManifestProof({
      subject: { id: signedManifest.authorAddress, kind: 'manifest' },
      issuer: signerAddr,
      manifestId: 'manifest-id-1',
      issuedAt: 1000,
    });
    const signedProof = signProof(unsignedProof, SEED_A, 1);

    const result = verifyManifestProof(signedProof, signedManifest);
    expect(result.valid).toBe(true);
  }, 30000);

  it('returns invalid when manifest signature is tampered', async () => {
    const signerAddr = deriveAddress(SEED_A, 0);
    const manifest = {
      type: 'edge-service' as const,
      serviceId: 'svc-proof-test-2',
      name: 'Test',
      version: '1.0.0',
      operatorAddress: signerAddr,
      serviceType: 'verifier' as const,
      description: 'test',
      capabilities: [],
      tags: [],
    };
    const signedManifest = await signManifest(manifest, SEED_A, 0);
    const tampered = { ...signedManifest, signature: '00'.repeat(134) };

    const unsignedProof = createManifestProof({
      subject: { id: 'x', kind: 'manifest' },
      issuer: signerAddr,
      manifestId: 'manifest-id-2',
    });
    const signedProof = signProof(unsignedProof, SEED_A, 1);

    const result = verifyManifestProof(signedProof, tampered);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/manifest signature invalid/);
  }, 30000);
});

// ─── 13. verifyIdentityProof delegates to verifyIdentityClaim ─────────────────

describe('verifyIdentityProof', () => {
  it('returns valid when identity claim and proof are both valid', async () => {
    const rootAddr = deriveAddress(SEED_B, 0);
    const doc = createIdentityDocument({
      kind: 'device',
      rootAddress: rootAddr,
      controllerAddress: rootAddr,
    });
    const delClaim = createDelegationClaim({
      issuer: rootAddr,
      subject: doc.id,
      delegatedAddress: 'MxDELEGATE',
      scopes: ['manifest:sign'],
      issuedAt: 1000,
    });
    const signedClaim = await signIdentityClaim(delClaim, SEED_B, 0);

    const unsignedProof = createIdentityProof({
      subject: { id: doc.id, kind: 'identity' },
      issuer: rootAddr,
      identityId: doc.id,
      issuedAt: 1000,
    });
    const signedProof = signProof(unsignedProof, SEED_B, 1);

    const result = verifyIdentityProof(signedProof, signedClaim);
    expect(result.valid).toBe(true);
  }, 30000);

  it('returns invalid when identity claim is tampered', async () => {
    const rootAddr = deriveAddress(SEED_B, 0);
    const doc = createIdentityDocument({
      kind: 'device',
      rootAddress: rootAddr,
      controllerAddress: rootAddr,
    });
    const delClaim = createDelegationClaim({
      issuer: rootAddr,
      subject: doc.id,
      delegatedAddress: 'MxDELEGATE',
      scopes: ['manifest:sign'],
      issuedAt: 1000,
    });
    const signedClaim = await signIdentityClaim(delClaim, SEED_B, 0);
    const tamperedClaim = {
      ...signedClaim,
      claim: { ...signedClaim.claim, issuer: 'MxATTACKER' },
    };

    const unsignedProof = createIdentityProof({
      subject: { id: doc.id, kind: 'identity' },
      issuer: rootAddr,
      identityId: doc.id,
    });
    const signedProof = signProof(unsignedProof, SEED_B, 1);

    const result = verifyIdentityProof(signedProof, tamperedClaim);
    expect(result.valid).toBe(false);
  }, 30000);
});

// ─── 14. All named exports are present in the root index ──────────────────────

describe('root index exports', () => {
  it('exports all expected names', () => {
    const mod = require('../index');

    const expectedFunctions = [
      'toHex',
      'canonicalJson',
      'computeProofId',
      'hashProofPayload',
      'hashEvidence',
      'createProof',
      'signProof',
      'verifyProofSignature',
      'verifyProofPayload',
      'verifyProof',
      'createAnchorCommitment',
      'attachAnchor',
      'verifyAnchorRef',
      'createManifestProof',
      'verifyManifestProof',
      'createIdentityProof',
      'verifyIdentityProof',
    ];

    for (const name of expectedFunctions) {
      expect(typeof mod[name]).toBe('function');
    }
  });
});
