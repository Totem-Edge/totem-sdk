/**
 * @totemsdk/edge — test suite
 */

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
  createEdgeServiceManifest,
  bindEdgeServiceIdentity,
} from '../index';
import type {
  EdgeCapability,
  EdgeCapabilitySet,
  EdgeRuntimePorts,
} from '../index';
import type { TotemCapabilities } from '@totemsdk/connect';
import { createIdentityDocument } from '@totemsdk/identity';
import type { IdentityGraph } from '@totemsdk/identity';
import { wotsKeypairFromSeed, wotsAddressFromKeypair } from '@totemsdk/core';

function deriveAddress(seed: Uint8Array, keyIndex: number): string {
  const kp = wotsKeypairFromSeed(seed, keyIndex);
  return wotsAddressFromKeypair(kp);
}

// ─── Capability set CRUD ──────────────────────────────────────────────────────

describe('createCapabilitySet', () => {
  it('creates a capability set from an array', () => {
    const caps: EdgeCapability[] = ['wallet:self-custody', 'omnia:channels'];
    const set = createCapabilitySet(caps);
    expect(set.size).toBe(2);
    expect(set.has('wallet:self-custody')).toBe(true);
    expect(set.has('omnia:channels')).toBe(true);
  });

  it('hasCapability returns true/false correctly', () => {
    const set = createCapabilitySet(['wallet:self-custody']);
    expect(hasCapability(set, 'wallet:self-custody')).toBe(true);
    expect(hasCapability(set, 'omnia:channels')).toBe(false);
  });
});

// ─── assertCapability typed error ─────────────────────────────────────────────

describe('assertCapability', () => {
  it('does not throw when capability is present', () => {
    const set = createCapabilitySet(['wallet:self-custody']);
    expect(() => assertCapability(set, 'wallet:self-custody')).not.toThrow();
  });

  it('throws EdgeCapabilityError when capability is missing', () => {
    const set = createCapabilitySet([]);
    let caught: unknown;
    try {
      assertCapability(set, 'omnia:channels');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EdgeCapabilityError);
    const err = caught as EdgeCapabilityError;
    expect(err.capability).toBe('omnia:channels');
    expect(err.code).toBe('EDGE_CAPABILITY_MISSING');
  });
});

// ─── edgeCapabilitiesFromTotemCapabilities ────────────────────────────────────

describe('edgeCapabilitiesFromTotemCapabilities', () => {
  const representativeFixture: TotemCapabilities = {
    version: '4.1.0',
    wallet: {
      selfCustody: true,
      wotsTreeKey: true,
      rootIdentity: true,
      treeKeyDepth: 3,
      maxAddresses: 64,
      seedExport: false,
      custodyType: 'self',
    },
    account: {
      multiAddress: true,
      accountSwitcher: true,
    },
    chain: {
      hostedProvider: true,
      pureMinimaRpc: false,
      lookupNode: true,
      localProofVerify: true,
      pearRuntime: false,
      hyperswarm: true,
    },
    txpow: {
      localMining: false,
      progressEvents: true,
    },
    omnia: {
      channels: true,
      routing: true,
      multiHop: false,
      crossTokenSwap: false,
      factory: false,
      virtualChannels: false,
      splicing: false,
      hyperswarm: true,
    },
    statechain: {
      supported: false,
      blindSE: false,
    },
    scripting: {
      kissvm: true,
    },
    qvac: {
      paymentIntents: true,
      explanations: false,
    },
  };

  it('maps wallet.selfCustody to wallet:self-custody', () => {
    const set = edgeCapabilitiesFromTotemCapabilities(representativeFixture);
    expect(set.has('wallet:self-custody')).toBe(true);
  });

  it('maps omnia.channels to omnia:channels', () => {
    const set = edgeCapabilitiesFromTotemCapabilities(representativeFixture);
    expect(set.has('omnia:channels')).toBe(true);
  });

  it('does not include capabilities that are false', () => {
    const set = edgeCapabilitiesFromTotemCapabilities(representativeFixture);
    expect(set.has('txpow:local-mining')).toBe(false);
    expect(set.has('statechain:supported')).toBe(false);
    expect(set.has('wallet:seed-export')).toBe(false);
  });

  it('maps scripting.kissvm to scripting:kissvm', () => {
    const set = edgeCapabilitiesFromTotemCapabilities(representativeFixture);
    expect(set.has('scripting:kissvm')).toBe(true);
  });

  it('round-trips representative fixture and contains expected EdgeCapability values', () => {
    const set = edgeCapabilitiesFromTotemCapabilities(representativeFixture);
    const expected: EdgeCapability[] = [
      'wallet:self-custody',
      'wallet:wots-tree-key',
      'wallet:root-identity',
      'account:multi-address',
      'account:switcher',
      'chain:hosted-provider',
      'chain:lookup-node',
      'chain:local-proof-verify',
      'chain:hyperswarm',
      'txpow:progress-events',
      'omnia:channels',
      'omnia:routing',
      'omnia:hyperswarm',
      'scripting:kissvm',
      'qvac:payment-intents',
    ];
    for (const cap of expected) {
      expect(set.has(cap)).toBe(true);
    }
  });
});

// ─── Runtime with no/mocked ports ────────────────────────────────────────────

describe('createEdgeRuntime', () => {
  it('creates a runtime with no ports', () => {
    const caps = createCapabilitySet(['wallet:self-custody']);
    const runtime = createEdgeRuntime({ deviceId: 'dev-1', capabilities: caps, ports: {} });
    expect(runtime.version).toBe(EDGE_VERSION);
    expect(runtime.deviceId).toBe('dev-1');
    expect(runtime.hasCapability('wallet:self-custody')).toBe(true);
    expect(runtime.hasCapability('omnia:channels')).toBe(false);
  });

  it('creates a runtime with mocked payment port', () => {
    const mockedPayment = {
      async pay() {
        return { ok: true, data: { txpowId: 'tx-abc' } };
      },
    };
    const ports: EdgeRuntimePorts = { payment: mockedPayment };
    const caps = createCapabilitySet(['payment:send']);
    const runtime = createEdgeRuntime({ deviceId: 'dev-2', capabilities: caps, ports });
    expect(runtime.ports.payment).toBe(mockedPayment);
  });

  it('assertCapability throws for missing capability', () => {
    const caps = createCapabilitySet([]);
    const runtime = createEdgeRuntime({ deviceId: 'dev-3', capabilities: caps, ports: {} });
    expect(() => runtime.assertCapability('omnia:channels')).toThrow(EdgeCapabilityError);
  });
});

// ─── Device binding ───────────────────────────────────────────────────────────

describe('createEdgeDevice', () => {
  it('creates a device with unique ID', () => {
    const d1 = createEdgeDevice({ kind: 'sensor' });
    const d2 = createEdgeDevice({ kind: 'sensor' });
    expect(d1.deviceId).toMatch(/^edge:device:/);
    // IDs differ due to different timestamps
    expect(d1.deviceId).not.toBe(d2.deviceId);
  });

  it('stores kind and metadata', () => {
    const d = createEdgeDevice({
      kind: 'robot',
      address: 'MxROBOT',
      identityId: 'totem:id:robot:abc',
      metadata: { model: 'R2D2' },
    });
    expect(d.kind).toBe('robot');
    expect(d.address).toBe('MxROBOT');
    expect(d.identityId).toBe('totem:id:robot:abc');
    expect(d.metadata?.model).toBe('R2D2');
  });
});

// ─── Receipt ID stability ─────────────────────────────────────────────────────

describe('createEdgeReceipt', () => {
  it('creates a receipt with stable ID for same inputs', () => {
    const r1 = createEdgeReceipt({ kind: 'payment', payload: { amount: '10' }, issuedAt: 1000 });
    const r2 = createEdgeReceipt({ kind: 'payment', payload: { amount: '10' }, issuedAt: 1000 });
    expect(r1.receiptId).toBe(r2.receiptId);
  });

  it('different payload produces different receipt ID', () => {
    const r1 = createEdgeReceipt({ kind: 'payment', payload: { amount: '10' }, issuedAt: 1000 });
    const r2 = createEdgeReceipt({ kind: 'payment', payload: { amount: '20' }, issuedAt: 1000 });
    expect(r1.receiptId).not.toBe(r2.receiptId);
  });

  it('includes relatedManifestId when provided', () => {
    const r = createEdgeReceipt({
      kind: 'manifest',
      payload: {},
      relatedManifestId: 'manifest-xyz',
      issuedAt: 1000,
    });
    expect(r.relatedManifestId).toBe('manifest-xyz');
  });
});

// ─── Unsigned receipt verify safety ──────────────────────────────────────────

describe('verifyEdgeReceipt', () => {
  it('returns ok:true for valid receipt', () => {
    const r = createEdgeReceipt({ kind: 'payment', payload: { amount: '5' }, issuedAt: 2000 });
    const result = verifyEdgeReceipt(r);
    expect(result.ok).toBe(true);
    expect(result.data?.receipt.receiptId).toBe(r.receiptId);
  });

  it('returns ok:false for null', () => {
    const result = verifyEdgeReceipt(null);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('INVALID_RECEIPT');
  });

  it('returns ok:false for missing receiptId', () => {
    const result = verifyEdgeReceipt({ kind: 'x', issuedAt: 1, payload: {} });
    expect(result.ok).toBe(false);
  });

  it('never returns a bare boolean', () => {
    const result = verifyEdgeReceipt(null);
    expect(typeof result).toBe('object');
    expect(typeof result.ok).toBe('boolean');
  });
});

// ─── Service manifest creation ────────────────────────────────────────────────

describe('createEdgeServiceManifest', () => {
  const SEED = new Uint8Array(32).fill(42);

  it('creates a signed EdgeServiceManifest', async () => {
    const signerAddr = deriveAddress(SEED, 0);
    const manifest = {
      type: 'edge-service' as const,
      serviceId: 'svc-test',
      name: 'Test Service',
      version: '1.0.0',
      operatorAddress: signerAddr,
      serviceType: 'sensor' as const,
      description: 'test',
      capabilities: [],
      tags: [],
    };
    const signed = await createEdgeServiceManifest(manifest, SEED, 0);
    expect(signed.manifest.type).toBe('edge-service');
    expect(typeof signed.signature).toBe('string');
    expect(typeof signed.authorAddress).toBe('string');
  }, 30000);
});

// ─── bindEdgeServiceIdentity ──────────────────────────────────────────────────

describe('bindEdgeServiceIdentity', () => {
  const SEED = new Uint8Array(32).fill(42);

  it('binds service identity successfully', async () => {
    const signerAddr = deriveAddress(SEED, 0);
    const manifest = {
      type: 'edge-service' as const,
      serviceId: 'svc-bind-test',
      name: 'Bind Test',
      version: '1.0.0',
      operatorAddress: signerAddr,
      serviceType: 'sensor' as const,
      description: 'bind test',
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

// ─── Package root export check ────────────────────────────────────────────────

describe('package root export', () => {
  it('exports EDGE_VERSION', () => {
    expect(EDGE_VERSION).toBe(1);
  });

  it('exports all required symbols', () => {
    const exports = require('../index');
    const required = [
      'EDGE_VERSION',
      'EdgeCapabilityError',
      'createCapabilitySet',
      'hasCapability',
      'assertCapability',
      'edgeCapabilitiesFromTotemCapabilities',
      'createEdgeRuntime',
      'createEdgeDevice',
      'createEdgeReceipt',
      'verifyEdgeReceipt',
      'createEdgeProviderProfile',
      'createEdgeServiceRegistration',
      'createEdgeServiceManifest',
      'bindEdgeServiceIdentity',
    ];
    for (const sym of required) {
      expect(exports[sym]).toBeDefined();
    }
  });
});
