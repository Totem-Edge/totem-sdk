/**
 * @totemsdk/identity — test suite
 */

import {
  IDENTITY_VERSION,
  createIdentityDocument,
  computeIdentityId,
  createIdentityClaim,
  createDelegationClaim,
  createPaymentRecipientClaim,
  createServiceEndpointClaim,
  signIdentityClaim,
  verifyIdentityClaim,
  rotateIdentity,
  revokeIdentity,
  resolveIdentityGraph,
  bindManifestToIdentity,
  verifyManifestIdentity,
  isTotemIdentityDocument,
  isIdentityClaim,
  isSignedIdentityClaim,
  isRotationClaim,
  isRevocationClaim,
} from '../index';
import type {
  IdentityGraph,
  SignedIdentityClaim,
} from '../index';

// We need @totemsdk/manifest to sign manifests for binding tests
import { signManifest } from '@totemsdk/manifest';
import { wotsKeypairFromSeed, wotsAddressFromKeypair } from '@totemsdk/core';

// Generate a deterministic test seed
function testSeed(n: number): Uint8Array {
  const s = new Uint8Array(32);
  s[0] = n & 0xff;
  s[1] = (n >> 8) & 0xff;
  return s;
}

const SEED_A = testSeed(1);
const SEED_B = testSeed(2);

/** Derive the Minima address from a seed + keyIndex without signing */
function deriveAddress(seed: Uint8Array, keyIndex: number): string {
  const kp = wotsKeypairFromSeed(seed, keyIndex);
  return wotsAddressFromKeypair(kp);
}

// ─── Document creation ────────────────────────────────────────────────────────

describe('createIdentityDocument', () => {
  it('creates a document with required fields', () => {
    const doc = createIdentityDocument({
      kind: 'device',
      rootAddress: 'MxROOT',
      controllerAddress: 'MxCTRL',
    });
    expect(doc.kind).toBe('device');
    expect(doc.version).toBe(IDENTITY_VERSION);
    expect(doc.rootAddress).toBe('MxROOT');
    expect(doc.controllerAddress).toBe('MxCTRL');
    expect(typeof doc.createdAt).toBe('number');
    expect(doc.id).toMatch(/^totem:id:device:/);
  });

  it('stable ID — does not include version', () => {
    const id1 = computeIdentityId('device', 'MxROOT');
    const id2 = computeIdentityId('device', 'MxROOT');
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^totem:id:device:/);
  });

  it('different rootAddress produces different ID', () => {
    const id1 = computeIdentityId('device', 'MxROOT1');
    const id2 = computeIdentityId('device', 'MxROOT2');
    expect(id1).not.toBe(id2);
  });
});

// ─── Claim creation ───────────────────────────────────────────────────────────

describe('createIdentityClaim', () => {
  it('creates a claim with deterministic ID', () => {
    const c1 = createIdentityClaim({
      type: 'delegates_to',
      issuer: 'MxA',
      subject: 'totem:id:device:abc',
      object: 'MxB',
      payload: { scopes: ['manifest:sign'] },
      issuedAt: 1000,
    });
    const c2 = createIdentityClaim({
      type: 'delegates_to',
      issuer: 'MxA',
      subject: 'totem:id:device:abc',
      object: 'MxB',
      payload: { scopes: ['manifest:sign'] },
      issuedAt: 1000,
    });
    expect(c1.id).toBe(c2.id);
  });

  it('different payload produces different claim ID', () => {
    const c1 = createIdentityClaim({
      type: 'delegates_to',
      issuer: 'MxA',
      subject: 'totem:id:device:abc',
      object: 'MxB',
      payload: { scopes: ['manifest:sign'] },
      issuedAt: 1000,
    });
    const c2 = createIdentityClaim({
      type: 'delegates_to',
      issuer: 'MxA',
      subject: 'totem:id:device:abc',
      object: 'MxB',
      payload: { scopes: ['claim:issue'] },
      issuedAt: 1000,
    });
    expect(c1.id).not.toBe(c2.id);
  });
});

// ─── Sign → verify round-trip ─────────────────────────────────────────────────

describe('signIdentityClaim / verifyIdentityClaim', () => {
  it('sign then verify returns valid', async () => {
    const claim = createDelegationClaim({
      issuer: 'MxROOT',
      subject: 'totem:id:device:xyz',
      delegatedAddress: 'MxDELEGATE',
      scopes: ['manifest:sign'],
      issuedAt: 1000,
    });
    const signed = await signIdentityClaim(claim, SEED_A, 0);
    const result = verifyIdentityClaim(signed);
    expect(result.valid).toBe(true);
    expect(result.signerAddress).toBeDefined();
  }, 30000);

  it('tampered claim fails verification', async () => {
    const claim = createDelegationClaim({
      issuer: 'MxROOT',
      subject: 'totem:id:device:xyz',
      delegatedAddress: 'MxDELEGATE',
      scopes: ['manifest:sign'],
      issuedAt: 1000,
    });
    const signed = await signIdentityClaim(claim, SEED_A, 0);
    const tampered: SignedIdentityClaim = {
      ...signed,
      claim: { ...signed.claim, issuer: 'MxATTACKER' },
    };
    const result = verifyIdentityClaim(tampered);
    expect(result.valid).toBe(false);
  }, 30000);

  it('proof.message is not used as signing source', async () => {
    const claim = createDelegationClaim({
      issuer: 'MxROOT',
      subject: 'totem:id:device:xyz',
      delegatedAddress: 'MxDELEGATE',
      scopes: ['manifest:sign'],
      issuedAt: 1000,
    });
    const signed = await signIdentityClaim(claim, SEED_A, 0);
    const withFakeMessage: SignedIdentityClaim = {
      ...signed,
      proof: { ...signed.proof, message: 'fake message that was not signed' },
    };
    // Still valid because verifyIdentityClaim ignores proof.message
    const result = verifyIdentityClaim(withFakeMessage);
    expect(result.valid).toBe(true);
  }, 30000);
});

// ─── Resolver ─────────────────────────────────────────────────────────────────

describe('resolveIdentityGraph', () => {
  it('resolves with no claims as active', () => {
    const doc = createIdentityDocument({
      kind: 'agent',
      rootAddress: 'MxROOT',
      controllerAddress: 'MxCTRL',
    });
    const graph: IdentityGraph = { document: doc, claims: [] };
    const result = resolveIdentityGraph(graph);
    expect(result.resolved?.status).toBe('active');
    expect(result.resolved?.delegates).toHaveLength(0);
  });

  it('resolves delegation claim', async () => {
    // Use the actual address derived from SEED_A as rootAddress so the signer matches the issuer
    const rootAddr = deriveAddress(SEED_A, 0);
    const doc = createIdentityDocument({
      kind: 'agent',
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
    const signed = await signIdentityClaim(delClaim, SEED_A, 0);
    const graph: IdentityGraph = { document: doc, claims: [signed] };
    const result = resolveIdentityGraph(graph);
    expect(result.resolved?.delegates).toHaveLength(1);
    expect(result.resolved?.delegates[0].delegatedAddress).toBe('MxDELEGATE');
    expect(result.resolved?.authorizedAddresses).toContain('MxDELEGATE');
  }, 30000);

  it('resolves payment recipient claim', async () => {
    const rootAddr = deriveAddress(SEED_A, 0);
    const doc = createIdentityDocument({
      kind: 'person',
      rootAddress: rootAddr,
      controllerAddress: rootAddr,
    });
    const paymentClaim = createPaymentRecipientClaim({
      issuer: rootAddr,
      subject: doc.id,
      address: 'MxPAY',
      label: 'Main wallet',
      issuedAt: 1000,
    });
    const signed = await signIdentityClaim(paymentClaim, SEED_A, 0);
    const graph: IdentityGraph = { document: doc, claims: [signed] };
    const result = resolveIdentityGraph(graph);
    expect(result.resolved?.paymentRecipients).toHaveLength(1);
    expect(result.resolved?.paymentRecipients[0].address).toBe('MxPAY');
    expect(result.resolved?.paymentRecipients[0].label).toBe('Main wallet');
  }, 30000);

  it('resolves service endpoint claim', async () => {
    const rootAddr = deriveAddress(SEED_A, 0);
    const doc = createIdentityDocument({
      kind: 'service',
      rootAddress: rootAddr,
      controllerAddress: rootAddr,
    });
    const epClaim = createServiceEndpointClaim({
      issuer: rootAddr,
      subject: doc.id,
      endpointType: 'https',
      uri: 'https://api.example.com',
      issuedAt: 1000,
    });
    const signed = await signIdentityClaim(epClaim, SEED_A, 0);
    const graph: IdentityGraph = { document: doc, claims: [signed] };
    const result = resolveIdentityGraph(graph);
    expect(result.resolved?.serviceEndpoints).toHaveLength(1);
    expect(result.resolved?.serviceEndpoints[0].uri).toBe('https://api.example.com');
  }, 30000);

  it('detects revocation', async () => {
    const rootAddr = deriveAddress(SEED_A, 0);
    const doc = createIdentityDocument({
      kind: 'device',
      rootAddress: rootAddr,
      controllerAddress: rootAddr,
    });
    const revClaim = revokeIdentity({
      issuer: rootAddr,
      subject: doc.id,
      reason: 'compromised',
      issuedAt: 2000,
    });
    const signed = await signIdentityClaim(revClaim, SEED_A, 0);
    const graph: IdentityGraph = { document: doc, claims: [signed] };
    const result = resolveIdentityGraph(graph);
    expect(result.resolved?.status).toBe('revoked');
    expect(result.resolved?.revokedAt).toBe(2000);
  }, 30000);

  it('detects rotation', async () => {
    const rootAddr = deriveAddress(SEED_A, 0);
    const doc = createIdentityDocument({
      kind: 'device',
      rootAddress: rootAddr,
      controllerAddress: rootAddr,
    });
    const rotClaim = rotateIdentity({
      issuer: rootAddr,
      subject: doc.id,
      newAddress: 'MxNEWROOT',
      issuedAt: 3000,
    });
    const signed = await signIdentityClaim(rotClaim, SEED_A, 0);
    const graph: IdentityGraph = { document: doc, claims: [signed] };
    const result = resolveIdentityGraph(graph);
    expect(result.resolved?.status).toBe('rotated');
    expect(result.resolved?.rotationTarget).toBe('MxNEWROOT');
  }, 30000);

  it('drops claims from unauthorized issuers', async () => {
    const doc = createIdentityDocument({
      kind: 'agent',
      rootAddress: 'MxROOT',
      controllerAddress: 'MxCTRL',
    });
    const unauthorizedClaim = createDelegationClaim({
      issuer: 'MxATTACKER',
      subject: doc.id,
      delegatedAddress: 'MxBAD',
      scopes: ['*'],
      issuedAt: 1000,
    });
    const signed = await signIdentityClaim(unauthorizedClaim, SEED_B, 0);
    const graph: IdentityGraph = { document: doc, claims: [signed] };
    const result = resolveIdentityGraph(graph);
    expect(result.resolved?.delegates).toHaveLength(0);
    expect(result.resolved?.authorizedAddresses).toHaveLength(0);
  }, 30000);

  it('regression: issuer-spoofing — attacker signs claim but sets issuer=rootAddress → dropped', async () => {
    // Attack scenario: attacker sets claim.issuer = 'MxROOT' (a privileged address they don't control)
    // but signs the claim with their own key (SEED_A). SEED_A's address is NOT 'MxROOT'.
    //
    // verifyIdentityClaim only checks internal proof consistency (signature valid + proof.address
    // is derived from proof.publicKey). It does NOT check claim.issuer === proof.address —
    // that binding is enforced by the resolver.
    // The resolver rejects any claim where signerAddress !== claim.issuer.
    const doc = createIdentityDocument({
      kind: 'agent',
      rootAddress: 'MxROOT',
      controllerAddress: 'MxCTRL',
    });
    const forgedClaim = createDelegationClaim({
      issuer: 'MxROOT', // spoofed — attacker pretends to be root
      subject: doc.id,
      delegatedAddress: 'MxATTACKER_DELEGATE',
      scopes: ['*'],
      issuedAt: 1000,
    });
    // Sign with SEED_A — the attacker's actual key, whose address is NOT 'MxROOT'
    const signed = await signIdentityClaim(forgedClaim, SEED_A, 0);
    // proof.address is cryptographically bound to SEED_A's public key — not 'MxROOT'
    expect(signed.proof.address).not.toBe('MxROOT');
    // verifyIdentityClaim returns valid=true: internal proof is consistent (sig OK, address bound to pk)
    // but signerAddress !== claim.issuer — the resolver uses this gap to reject it
    const vr = verifyIdentityClaim(signed);
    expect(vr.valid).toBe(true);
    expect(vr.signerAddress).not.toBe('MxROOT'); // signer ≠ claimed issuer
    // resolver silently drops it: signerAddress !== claim.issuer
    const graph: IdentityGraph = { document: doc, claims: [signed] };
    const result = resolveIdentityGraph(graph);
    expect(result.resolved?.delegates).toHaveLength(0);
    expect(result.resolved?.authorizedAddresses).toHaveLength(0);
  }, 30000);
});

// ─── Manifest binding ─────────────────────────────────────────────────────────

describe('verifyManifestIdentity / bindManifestToIdentity', () => {
  async function makeEdgeServiceManifest(seed: Uint8Array, keyIndex: number) {
    const signerAddr = deriveAddress(seed, keyIndex);
    const manifest = {
      type: 'edge-service' as const,
      serviceId: 'svc-1',
      name: 'Test Service',
      version: '1.0.0',
      operatorAddress: signerAddr,
      serviceType: 'sensor' as const,
      description: 'test',
      capabilities: [],
      tags: [],
    };
    return signManifest(manifest, seed, keyIndex);
  }

  it('binds EdgeServiceManifest to identity', async () => {
    const signed = await makeEdgeServiceManifest(SEED_A, 0);
    const doc = createIdentityDocument({
      kind: 'service',
      rootAddress: signed.authorAddress,
      controllerAddress: signed.authorAddress,
    });
    const graph: IdentityGraph = { document: doc, claims: [] };
    const binding = await bindManifestToIdentity(signed, graph);
    expect(binding.valid).toBe(true);
    expect(binding.signerAddress).toBe(signed.authorAddress);
  }, 30000);

  it('binds AppManifest to identity via root address', async () => {
    const signerAddr = deriveAddress(SEED_A, 0);
    const appManifest = {
      type: 'app' as const,
      appId: 'app-1',
      name: 'Test App',
      version: '1.0.0',
      authorAddress: signerAddr,
      pearTopicKey: 'pk1',
      price: '0',
      category: ['utility'],
      permissions: [] as any[],
      description: 'test app',
      minTotemVersion: '1.0.0',
    };
    const signed = await signManifest(appManifest, SEED_A, 0);
    const doc = createIdentityDocument({
      kind: 'person',
      rootAddress: signed.authorAddress,
      controllerAddress: signed.authorAddress,
    });
    const graph: IdentityGraph = { document: doc, claims: [] };
    const binding = await bindManifestToIdentity(signed, graph);
    expect(binding.valid).toBe(true);
  }, 30000);

  it('binds CapabilityManifest to identity', async () => {
    const signerAddr = deriveAddress(SEED_A, 0);
    const capManifest = {
      type: 'capability' as const,
      capabilityId: 'cap-1',
      capabilityName: 'Test Cap',
      agentAddress: signerAddr,
      agentIdentityKey: 'ik1',
      description: 'test',
      inputSchema: {},
      outputSchema: {},
      pricePerCall: '0',
      expiresAt: Date.now() + 99999,
      tags: [],
    };
    const signed = await signManifest(capManifest, SEED_A, 0);
    const doc = createIdentityDocument({
      kind: 'agent',
      rootAddress: signed.authorAddress,
      controllerAddress: signed.authorAddress,
    });
    const graph: IdentityGraph = { document: doc, claims: [] };
    const binding = await bindManifestToIdentity(signed, graph);
    expect(binding.valid).toBe(true);
  }, 30000);

  it('binds DAppManifest to identity', async () => {
    const signerAddr = deriveAddress(SEED_A, 0);
    const dappManifest = {
      type: 'dapp' as const,
      dappId: 'dapp-1',
      name: 'Test DApp',
      version: '1.0.0',
      authorAddress: signerAddr,
      contractHash: 'deadbeef',
      abi: [],
      price: '0',
      category: ['defi'],
      description: 'test dapp',
    };
    const signed = await signManifest(dappManifest, SEED_A, 0);
    const doc = createIdentityDocument({
      kind: 'person',
      rootAddress: signed.authorAddress,
      controllerAddress: signed.authorAddress,
    });
    const graph: IdentityGraph = { document: doc, claims: [] };
    const binding = await bindManifestToIdentity(signed, graph);
    expect(binding.valid).toBe(true);
  }, 30000);

  it('fails if manifest signature is invalid', async () => {
    const signed = await makeEdgeServiceManifest(SEED_A, 0);
    const tampered = { ...signed, signature: '00'.repeat(134) };
    const doc = createIdentityDocument({
      kind: 'service',
      rootAddress: signed.authorAddress,
      controllerAddress: signed.authorAddress,
    });
    const graph: IdentityGraph = { document: doc, claims: [] };
    const binding = await bindManifestToIdentity(tampered, graph);
    expect(binding.valid).toBe(false);
    expect(binding.reason).toMatch(/manifest signature invalid/);
  }, 30000);

  it('fails if signer address not associated with identity', async () => {
    const signed = await makeEdgeServiceManifest(SEED_A, 0);
    const doc = createIdentityDocument({
      kind: 'service',
      rootAddress: 'MxCOMPLETELY_DIFFERENT',
      controllerAddress: 'MxCOMPLETELY_DIFFERENT',
    });
    const graph: IdentityGraph = { document: doc, claims: [] };
    const binding = await bindManifestToIdentity(signed, graph);
    expect(binding.valid).toBe(false);
  }, 30000);

  it('rootIdentityProof is silently ignored if no verifier registered', async () => {
    const signed = await makeEdgeServiceManifest(SEED_A, 0);
    const withProof = { ...signed, rootIdentityProof: 'some-serialized-proof' };
    const doc = createIdentityDocument({
      kind: 'service',
      rootAddress: signed.authorAddress,
      controllerAddress: signed.authorAddress,
    });
    const graph: IdentityGraph = { document: doc, claims: [] };
    const binding = await bindManifestToIdentity(withProof, graph);
    expect(binding.valid).toBe(true);
  }, 30000);

  it('regression: manifest signed by controlledAddresses (any scope) must pass binding', async () => {
    // SEED_B is a delegated/controlled address with a non-manifest scope (e.g. 'read').
    // Per spec, controlledAddresses (any scope) are valid manifest signers.
    const rootAddr = deriveAddress(SEED_A, 0);
    const controlledAddr = deriveAddress(SEED_B, 0);

    // Create identity whose root is SEED_A's address
    const doc = createIdentityDocument({
      kind: 'service',
      rootAddress: rootAddr,
      controllerAddress: rootAddr,
    });

    // Root (SEED_A) issues a delegation claim to SEED_B's address with a non-manifest scope
    const delClaim = createDelegationClaim({
      issuer: rootAddr,
      subject: doc.id,
      delegatedAddress: controlledAddr,
      scopes: ['read'],  // NOT manifest:sign — only 'read' scope
      issuedAt: 1000,
    });
    const signedClaim = await signIdentityClaim(delClaim, SEED_A, 0);

    // SEED_B (controlled address) signs the manifest
    const signed = await makeEdgeServiceManifest(SEED_B, 0);
    expect(signed.authorAddress).toBe(controlledAddr);

    const graph: IdentityGraph = { document: doc, claims: [signedClaim] };
    const binding = await bindManifestToIdentity(signed, graph);

    // controlledAddr is in controlledAddresses → binding must succeed
    expect(binding.valid).toBe(true);
    expect(binding.signerAddress).toBe(controlledAddr);
  }, 60000);
});

// ─── Guards ───────────────────────────────────────────────────────────────────

describe('type guards', () => {
  it('isTotemIdentityDocument', () => {
    const doc = createIdentityDocument({
      kind: 'device',
      rootAddress: 'MxA',
      controllerAddress: 'MxA',
    });
    expect(isTotemIdentityDocument(doc)).toBe(true);
    expect(isTotemIdentityDocument(null)).toBe(false);
    expect(isTotemIdentityDocument({ id: 'x' })).toBe(false);
  });

  it('isIdentityClaim', () => {
    const c = createIdentityClaim({
      type: 'delegates_to',
      issuer: 'MxA',
      subject: 'id:x',
      object: 'MxB',
      payload: {},
      issuedAt: 1000,
    });
    expect(isIdentityClaim(c)).toBe(true);
    expect(isIdentityClaim(null)).toBe(false);
  });

  it('isSignedIdentityClaim', async () => {
    const c = createIdentityClaim({
      type: 'delegates_to',
      issuer: 'MxA',
      subject: 'id:x',
      object: 'MxB',
      payload: {},
      issuedAt: 1000,
    });
    const signed = await signIdentityClaim(c, SEED_A, 0);
    expect(isSignedIdentityClaim(signed)).toBe(true);
    expect(isSignedIdentityClaim({ claim: c })).toBe(false);
  }, 30000);
});

// ─── Package root export check ────────────────────────────────────────────────

describe('package root export', () => {
  it('exports IDENTITY_VERSION', () => {
    expect(IDENTITY_VERSION).toBe(1);
  });

  it('exports all required symbols', () => {
    const exports = require('../index');
    const required = [
      'IDENTITY_VERSION',
      'createIdentityDocument',
      'computeIdentityId',
      'createIdentityClaim',
      'createDelegationClaim',
      'createPaymentRecipientClaim',
      'createServiceEndpointClaim',
      'signIdentityClaim',
      'verifyIdentityClaim',
      'rotateIdentity',
      'revokeIdentity',
      'resolveIdentityGraph',
      'bindManifestToIdentity',
      'verifyManifestIdentity',
      'isTotemIdentityDocument',
      'isIdentityClaim',
      'isSignedIdentityClaim',
      'isRotationClaim',
      'isRevocationClaim',
    ];
    for (const sym of required) {
      expect(exports[sym]).toBeDefined();
    }
  });
});
