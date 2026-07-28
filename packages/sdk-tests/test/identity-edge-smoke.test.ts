/**
 * Repo-level import smoke test for @totemsdk/identity and @totemsdk/edge.
 *
 * Confirms all required named imports resolve without error from their source,
 * and basic round-trip semantics work across both packages.
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
} from '@totemsdk/identity';

import {
  EDGE_VERSION,
  EdgeCapabilityError,
  createCapabilitySet,
  hasCapability,
  assertCapability,
  edgeCapabilitiesFromTotemCapabilities,
  createEdgeRuntime,
  createEdgeDevice,
  createEdgeReceipt,
  verifyEdgeReceipt,
  createEdgeProviderProfile,
  createEdgeServiceRegistration,
  createEdgeServiceManifest,
  bindEdgeServiceIdentity,
} from '@totemsdk/edge';

import type { EdgeCapability } from '@totemsdk/edge';
import type { IdentityGraph } from '@totemsdk/identity';
import type { TotemCapabilities } from '@totemsdk/connect';
import { wotsKeypairFromSeed, wotsAddressFromKeypair } from '@totemsdk/core';

function deriveAddress(seed: Uint8Array, keyIndex: number): string {
  const kp = wotsKeypairFromSeed(seed, keyIndex);
  return wotsAddressFromKeypair(kp);
}

// ─── @totemsdk/identity — all required exports ────────────────────────────────

describe('@totemsdk/identity — named exports', () => {
  it('IDENTITY_VERSION is 1', () => {
    expect(IDENTITY_VERSION).toBe(1);
  });

  it('exports createIdentityDocument', () => {
    expect(typeof createIdentityDocument).toBe('function');
  });

  it('exports computeIdentityId', () => {
    expect(typeof computeIdentityId).toBe('function');
  });

  it('exports createIdentityClaim', () => {
    expect(typeof createIdentityClaim).toBe('function');
  });

  it('exports createDelegationClaim', () => {
    expect(typeof createDelegationClaim).toBe('function');
  });

  it('exports createPaymentRecipientClaim', () => {
    expect(typeof createPaymentRecipientClaim).toBe('function');
  });

  it('exports createServiceEndpointClaim', () => {
    expect(typeof createServiceEndpointClaim).toBe('function');
  });

  it('exports signIdentityClaim', () => {
    expect(typeof signIdentityClaim).toBe('function');
  });

  it('exports verifyIdentityClaim', () => {
    expect(typeof verifyIdentityClaim).toBe('function');
  });

  it('exports rotateIdentity', () => {
    expect(typeof rotateIdentity).toBe('function');
  });

  it('exports revokeIdentity', () => {
    expect(typeof revokeIdentity).toBe('function');
  });

  it('exports resolveIdentityGraph', () => {
    expect(typeof resolveIdentityGraph).toBe('function');
  });

  it('exports bindManifestToIdentity', () => {
    expect(typeof bindManifestToIdentity).toBe('function');
  });

  it('exports verifyManifestIdentity', () => {
    expect(typeof verifyManifestIdentity).toBe('function');
  });

  it('exports isTotemIdentityDocument', () => {
    expect(typeof isTotemIdentityDocument).toBe('function');
  });

  it('exports isIdentityClaim', () => {
    expect(typeof isIdentityClaim).toBe('function');
  });

  it('exports isSignedIdentityClaim', () => {
    expect(typeof isSignedIdentityClaim).toBe('function');
  });

  it('exports isRotationClaim', () => {
    expect(typeof isRotationClaim).toBe('function');
  });

  it('exports isRevocationClaim', () => {
    expect(typeof isRevocationClaim).toBe('function');
  });
});

// ─── @totemsdk/identity — basic semantics ────────────────────────────────────

describe('@totemsdk/identity — basic semantics', () => {
  it('computeIdentityId returns stable totem:id: URI', () => {
    const id1 = computeIdentityId('device', 'MxROOT');
    const id2 = computeIdentityId('device', 'MxROOT');
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^totem:id:device:[0-9a-f]{64}$/);
  });

  it('createIdentityDocument passes isTotemIdentityDocument guard', () => {
    const doc = createIdentityDocument({
      kind: 'service',
      rootAddress: 'MxSMOKE',
      controllerAddress: 'MxSMOKE',
    });
    expect(isTotemIdentityDocument(doc)).toBe(true);
    expect(doc.id).toMatch(/^totem:id:service:/);
  });

  it('resolveIdentityGraph on empty graph returns active status', () => {
    const doc = createIdentityDocument({
      kind: 'agent',
      rootAddress: 'MxSMOKE2',
      controllerAddress: 'MxSMOKE2',
    });
    const result = resolveIdentityGraph({ document: doc, claims: [] });
    expect(result.resolved?.status).toBe('active');
    expect(result.resolved?.delegates).toHaveLength(0);
  });

  it('forged claim with unauthorized issuer is dropped by resolver', async () => {
    const doc = createIdentityDocument({
      kind: 'agent',
      rootAddress: 'MxROOT',
      controllerAddress: 'MxCTRL',
    });
    const SEED_ATTACKER = new Uint8Array(32).fill(0x99);
    const attackerClaim = createDelegationClaim({
      issuer: 'MxATTACKER',
      subject: doc.id,
      delegatedAddress: 'MxBAD',
      scopes: ['*'],
      issuedAt: 1000,
    });
    const signed = await signIdentityClaim(attackerClaim, SEED_ATTACKER, 0);
    const result = resolveIdentityGraph({ document: doc, claims: [signed] });
    expect(result.resolved?.delegates).toHaveLength(0);
    expect(result.resolved?.authorizedAddresses).toHaveLength(0);
  }, 30000);

  it('verifyIdentityClaim: spoofed proof.address is rejected', async () => {
    const SEED = new Uint8Array(32).fill(0x01);
    const claim = createDelegationClaim({
      issuer: 'MxSOME',
      subject: 'totem:id:device:abc',
      delegatedAddress: 'MxDEL',
      scopes: ['manifest:sign'],
      issuedAt: 1000,
    });
    const signed = await signIdentityClaim(claim, SEED, 0);
    const tampered = {
      ...signed,
      proof: { ...signed.proof, address: 'MxSPOOFED_ADDRESS' },
    };
    const result = verifyIdentityClaim(tampered);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/does not match address derived from proof\.publicKey/);
  }, 30000);
});

// ─── @totemsdk/edge — named exports ──────────────────────────────────────────

describe('@totemsdk/edge — named exports', () => {
  it('EDGE_VERSION is 1', () => {
    expect(EDGE_VERSION).toBe(1);
  });

  it('exports EdgeCapabilityError', () => {
    expect(typeof EdgeCapabilityError).toBe('function');
  });

  it('exports createCapabilitySet', () => {
    expect(typeof createCapabilitySet).toBe('function');
  });

  it('exports hasCapability', () => {
    expect(typeof hasCapability).toBe('function');
  });

  it('exports assertCapability', () => {
    expect(typeof assertCapability).toBe('function');
  });

  it('exports edgeCapabilitiesFromTotemCapabilities', () => {
    expect(typeof edgeCapabilitiesFromTotemCapabilities).toBe('function');
  });

  it('exports createEdgeRuntime', () => {
    expect(typeof createEdgeRuntime).toBe('function');
  });

  it('exports createEdgeDevice', () => {
    expect(typeof createEdgeDevice).toBe('function');
  });

  it('exports createEdgeReceipt', () => {
    expect(typeof createEdgeReceipt).toBe('function');
  });

  it('exports verifyEdgeReceipt', () => {
    expect(typeof verifyEdgeReceipt).toBe('function');
  });

  it('exports createEdgeProviderProfile', () => {
    expect(typeof createEdgeProviderProfile).toBe('function');
  });

  it('exports createEdgeServiceRegistration', () => {
    expect(typeof createEdgeServiceRegistration).toBe('function');
  });

  it('exports createEdgeServiceManifest', () => {
    expect(typeof createEdgeServiceManifest).toBe('function');
  });

  it('exports bindEdgeServiceIdentity', () => {
    expect(typeof bindEdgeServiceIdentity).toBe('function');
  });
});

// ─── @totemsdk/edge — basic semantics ────────────────────────────────────────

describe('@totemsdk/edge — basic semantics', () => {
  it('createCapabilitySet and hasCapability work correctly', () => {
    const set = createCapabilitySet(['wallet:self-custody', 'omnia:channels']);
    expect(hasCapability(set, 'wallet:self-custody')).toBe(true);
    expect(hasCapability(set, 'txpow:local-mining')).toBe(false);
  });

  it('assertCapability throws EdgeCapabilityError for missing capability', () => {
    const set = createCapabilitySet([]);
    expect(() => assertCapability(set, 'omnia:channels' as EdgeCapability)).toThrow(EdgeCapabilityError);
  });

  it('createEdgeReceipt produces stable ID for same inputs', () => {
    const r1 = createEdgeReceipt({ kind: 'payment', payload: { amount: '5' }, issuedAt: 9999 });
    const r2 = createEdgeReceipt({ kind: 'payment', payload: { amount: '5' }, issuedAt: 9999 });
    expect(r1.receiptId).toBe(r2.receiptId);
    expect(r1.receiptId).toMatch(/^edge:receipt:/);
  });

  it('verifyEdgeReceipt returns structured EdgeOperationResult — never a bare boolean', () => {
    const r = createEdgeReceipt({ kind: 'test', payload: {}, issuedAt: 1000 });
    const okResult = verifyEdgeReceipt(r);
    expect(typeof okResult).toBe('object');
    expect(okResult.ok).toBe(true);

    const badResult = verifyEdgeReceipt(null);
    expect(typeof badResult).toBe('object');
    expect(badResult.ok).toBe(false);
    expect(typeof badResult.ok).toBe('boolean');
  });

  it('createEdgeDevice produces device with edge:device: prefix', () => {
    const d = createEdgeDevice({ kind: 'sensor' });
    expect(d.deviceId).toMatch(/^edge:device:/);
    expect(d.kind).toBe('sensor');
  });

  it('createEdgeRuntime exposes hasCapability and assertCapability inline', () => {
    const caps = createCapabilitySet(['wallet:self-custody']);
    const runtime = createEdgeRuntime({ deviceId: 'smoke-test-device', capabilities: caps, ports: {} });
    expect(runtime.version).toBe(EDGE_VERSION);
    expect(runtime.hasCapability('wallet:self-custody')).toBe(true);
    expect(runtime.hasCapability('omnia:channels')).toBe(false);
    expect(() => runtime.assertCapability('omnia:channels')).toThrow(EdgeCapabilityError);
  });

  it('edgeCapabilitiesFromTotemCapabilities maps representative fixture correctly', () => {
    const fixture: TotemCapabilities = {
      version: '4.1.0',
      wallet: { selfCustody: true, wotsTreeKey: true, rootIdentity: false,
        treeKeyDepth: null, maxAddresses: null, seedExport: false, custodyType: 'self' },
      account: { multiAddress: true, accountSwitcher: false },
      chain: { hostedProvider: true, pureMinimaRpc: false, lookupNode: false,
        localProofVerify: false, pearRuntime: false, hyperswarm: false },
      txpow: { localMining: false, progressEvents: false },
      omnia: { channels: true, routing: false, multiHop: false, crossTokenSwap: false,
        factory: false, virtualChannels: false, splicing: false, hyperswarm: false },
      statechain: { supported: false, blindSE: false },
      scripting: { kissvm: true },
      qvac: { paymentIntents: false, explanations: false },
    };
    const set = edgeCapabilitiesFromTotemCapabilities(fixture);
    expect(set.has('wallet:self-custody')).toBe(true);
    expect(set.has('wallet:wots-tree-key')).toBe(true);
    expect(set.has('omnia:channels')).toBe(true);
    expect(set.has('scripting:kissvm')).toBe(true);
    expect(set.has('wallet:root-identity')).toBe(false);
    expect(set.has('statechain:supported')).toBe(false);
  });

  it('no circular import: edge does not leak identity internals', () => {
    const edgeMod = require('@totemsdk/edge');
    expect(edgeMod['resolveIdentityGraph']).toBeUndefined();
    expect(edgeMod['computeIdentityId']).toBeUndefined();
    expect(edgeMod['IDENTITY_VERSION']).toBeUndefined();
  });

  it('createEdgeServiceManifest produces a signed EdgeServiceManifest', async () => {
    const SEED = new Uint8Array(32).fill(7);
    const signerAddr = deriveAddress(SEED, 0);
    const manifest = {
      type: 'edge-service' as const,
      serviceId: 'smoke-svc',
      name: 'Smoke Test Service',
      version: '1.0.0',
      operatorAddress: signerAddr,
      serviceType: 'sensor' as const,
      description: 'smoke test',
      capabilities: [],
      tags: [],
    };
    const signed = await createEdgeServiceManifest(manifest, SEED, 0);
    expect(signed.manifest.type).toBe('edge-service');
    expect(typeof signed.signature).toBe('string');
    expect(signed.authorAddress).toBe(signerAddr);
  }, 30000);

  it('bindEdgeServiceIdentity binds service successfully across packages', async () => {
    const SEED = new Uint8Array(32).fill(11);
    const signerAddr = deriveAddress(SEED, 0);
    const manifest = {
      type: 'edge-service' as const,
      serviceId: 'smoke-bind-svc',
      name: 'Smoke Bind Test',
      version: '1.0.0',
      operatorAddress: signerAddr,
      serviceType: 'sensor' as const,
      description: 'smoke bind test',
      capabilities: [],
      tags: [],
    };
    const signed = await createEdgeServiceManifest(manifest, SEED, 0);
    const doc = createIdentityDocument({
      kind: 'service',
      rootAddress: signed.authorAddress,
      controllerAddress: signed.authorAddress,
    });
    const graph: IdentityGraph = { document: doc, claims: [] };
    const binding = await bindEdgeServiceIdentity(signed, graph);
    expect(binding.valid).toBe(true);
    expect(binding.signerAddress).toBe(signed.authorAddress);
  }, 30000);
});
