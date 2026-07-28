import {
  verifyProviderManifestIdentity,
  verifyProviderBondAddresses,
  assertProviderControlsAddress,
} from '../identity.js';
import { createProviderBondManifest } from '../manifest.js';
import type { EdgeServiceManifest } from '@totemsdk/manifest';

function makeEdgeService(overrides: Partial<EdgeServiceManifest> = {}): EdgeServiceManifest {
  return {
    type: 'edge-service',
    serviceId: 'svc-1',
    name: 'Test Provider',
    version: '1.0.0',
    operatorAddress: 'MxRoot',
    serviceType: 'lookup-provider',
    description: 'A test provider',
    capabilities: ['lookup'],
    tags: ['test'],
    ...overrides,
  };
}

function makeIdentityGraph(rootAddress: string, controllerAddress?: string, delegates: string[] = []) {
  return {
    document: {
      rootAddress,
      controllerAddress: controllerAddress ?? rootAddress,
    },
    claims: delegates.map((d) => ({
      claim: { type: 'delegates_to', issuer: rootAddress, subject: rootAddress, object: d },
      proof: { address: d },
    })),
  };
}

describe('identity', () => {
  describe('verifyProviderManifestIdentity', () => {
    it('verifies manifest signer is authorised', () => {
      const edgeService = makeEdgeService({ operatorAddress: 'MxRoot' });
      const manifest = createProviderBondManifest({
        edgeService,
        signedEdgeService: { manifest: edgeService, authorAddress: 'MxRoot', signerPublicKey: 'aa'.repeat(32), signedAt: 1000, signature: 'bb'.repeat(1088) } as any,
        providerBond: { providerId: 'p-1' },
      });
      const identityGraph = makeIdentityGraph('MxRoot');
      const result = verifyProviderManifestIdentity({ manifest, identityGraph });
      expect(result.ok).toBe(true);
    });

    it('rejects unauthorised manifest signer', () => {
      const edgeService = makeEdgeService({ operatorAddress: 'MxRoot' });
      const manifest = createProviderBondManifest({
        edgeService,
        signedEdgeService: { manifest: edgeService, authorAddress: 'MxAttacker', signerPublicKey: 'aa'.repeat(32), signedAt: 1000, signature: 'bb'.repeat(1088) } as any,
        providerBond: { providerId: 'p-1' },
      });
      const identityGraph = makeIdentityGraph('MxRoot');
      const result = verifyProviderManifestIdentity({ manifest, identityGraph });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('IDENTITY_NOT_AUTHORISED');
    });

    it('rejects invalid identity graph', () => {
      const edgeService = makeEdgeService();
      const manifest = createProviderBondManifest({
        edgeService,
        providerBond: { providerId: 'p-1' },
      });
      const result = verifyProviderManifestIdentity({ manifest, identityGraph: null });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('IDENTITY_NOT_AUTHORISED');
    });
  });

  describe('verifyProviderBondAddresses', () => {
    it('verifies all addresses are authorised', () => {
      const edgeService = makeEdgeService();
      const manifest = createProviderBondManifest({
        edgeService,
        providerBond: {
          providerId: 'p-1',
          bondOwnerAddress: 'MxRoot',
          probeSignerAddress: 'MxRoot',
        },
      });
      const identityGraph = makeIdentityGraph('MxRoot');
      const result = verifyProviderBondAddresses({ manifest, identityGraph });
      expect(result.ok).toBe(true);
    });

    it('rejects unauthorised bond owner', () => {
      const edgeService = makeEdgeService();
      const manifest = createProviderBondManifest({
        edgeService,
        providerBond: {
          providerId: 'p-1',
          bondOwnerAddress: 'MxAttacker',
        },
      });
      const identityGraph = makeIdentityGraph('MxRoot');
      const result = verifyProviderBondAddresses({ manifest, identityGraph });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('BOND_OWNER_NOT_AUTHORISED');
    });

    it('rejects unauthorised probe signer', () => {
      const edgeService = makeEdgeService();
      const manifest = createProviderBondManifest({
        edgeService,
        providerBond: {
          providerId: 'p-1',
          probeSignerAddress: 'MxAttacker',
        },
      });
      const identityGraph = makeIdentityGraph('MxRoot');
      const result = verifyProviderBondAddresses({ manifest, identityGraph });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('PROBE_SIGNER_NOT_AUTHORISED');
    });

    it('returns structured failure codes not raw boolean', () => {
      const edgeService = makeEdgeService();
      const manifest = createProviderBondManifest({
        edgeService,
        providerBond: {
          providerId: 'p-1',
          bondOwnerAddress: 'MxAttacker',
        },
      });
      const identityGraph = makeIdentityGraph('MxRoot');
      const result = verifyProviderBondAddresses({ manifest, identityGraph });
      expect(typeof result).toBe('object');
      expect(result.ok).toBe(false);
      expect(result.code).toBeDefined();
      expect(result.reason).toBeDefined();
    });
  });

  describe('assertProviderControlsAddress', () => {
    it('returns ok for authorised address', () => {
      const edgeService = makeEdgeService();
      const manifest = createProviderBondManifest({
        edgeService,
        providerBond: { providerId: 'p-1' },
      });
      const identityGraph = makeIdentityGraph('MxRoot');
      const result = assertProviderControlsAddress({ manifest, address: 'MxRoot', identityGraph });
      expect(result.ok).toBe(true);
    });

    it('returns not ok for unauthorised address', () => {
      const edgeService = makeEdgeService();
      const manifest = createProviderBondManifest({
        edgeService,
        providerBond: { providerId: 'p-1' },
      });
      const identityGraph = makeIdentityGraph('MxRoot');
      const result = assertProviderControlsAddress({ manifest, address: 'MxAttacker', identityGraph });
      expect(result.ok).toBe(false);
    });
  });
});
