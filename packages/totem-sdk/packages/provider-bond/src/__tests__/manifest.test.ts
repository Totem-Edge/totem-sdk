import {
  createProviderBondManifest,
  computeProviderBondExtensionHash,
  computeProviderBondManifestHash,
  verifyProviderBondManifest,
  assertManifestNotExpired,
} from '../manifest.js';
import type { EdgeServiceManifest } from '@totemsdk/manifest';

function makeEdgeService(overrides: Partial<EdgeServiceManifest> = {}): EdgeServiceManifest {
  return {
    type: 'edge-service',
    serviceId: 'svc-1',
    name: 'Test Provider',
    version: '1.0.0',
    operatorAddress: 'MxTest123',
    serviceType: 'lookup-provider',
    description: 'A test provider',
    capabilities: ['lookup'],
    tags: ['test'],
    ...overrides,
  };
}

describe('manifest', () => {
  describe('createProviderBondManifest', () => {
    it('creates a provider bond manifest', () => {
      const edgeService = makeEdgeService();
      const manifest = createProviderBondManifest({
        edgeService,
        providerBond: { providerId: 'p-1' },
      });
      expect(manifest.edgeServiceManifestId).toBeDefined();
      expect(manifest.edgeService).toBe(edgeService);
      expect(manifest.providerBond.providerId).toBe('p-1');
    });
  });

  describe('computeProviderBondExtensionHash', () => {
    it('computes a stable hash', () => {
      const ext = { providerId: 'p-1', bondId: 'b-1' };
      const h1 = computeProviderBondExtensionHash(ext);
      const h2 = computeProviderBondExtensionHash(ext);
      expect(h1).toBe(h2);
      expect(h1.length).toBe(66); // 0x + 64 hex chars
    });

    it('produces different hashes for different extensions', () => {
      const h1 = computeProviderBondExtensionHash({ providerId: 'p-1' });
      const h2 = computeProviderBondExtensionHash({ providerId: 'p-2' });
      expect(h1).not.toBe(h2);
    });

    it('ignores extensionHash field in computation', () => {
      const ext = { providerId: 'p-1', extensionHash: 'abc' };
      const h1 = computeProviderBondExtensionHash(ext);
      const h2 = computeProviderBondExtensionHash({ providerId: 'p-1' });
      expect(h1).toBe(h2);
    });
  });

  describe('computeProviderBondManifestHash', () => {
    it('computes a stable hash', () => {
      const edgeService = makeEdgeService();
      const manifest = createProviderBondManifest({
        edgeService,
        providerBond: { providerId: 'p-1' },
      });
      const h1 = computeProviderBondManifestHash(manifest);
      const h2 = computeProviderBondManifestHash(manifest);
      expect(h1).toBe(h2);
    });
  });

  describe('verifyProviderBondManifest', () => {
    it('returns ok for valid manifest without signature', () => {
      const edgeService = makeEdgeService();
      const manifest = createProviderBondManifest({
        edgeService,
        providerBond: { providerId: 'p-1' },
      });
      const result = verifyProviderBondManifest({ manifest });
      expect(result.ok).toBe(true);
    });

    it('detects expired manifest', () => {
      const edgeService = makeEdgeService({ expiresAt: 1000 });
      const manifest = createProviderBondManifest({
        edgeService,
        providerBond: { providerId: 'p-1' },
      });
      const result = verifyProviderBondManifest({ manifest, now: 2000 });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('MANIFEST_EXPIRED');
    });

    it('detects extension hash mismatch', () => {
      const edgeService = makeEdgeService();
      const manifest = createProviderBondManifest({
        edgeService,
        providerBond: { providerId: 'p-1', extensionHash: 'deadbeef' },
      });
      const result = verifyProviderBondManifest({ manifest });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('BOND_EXTENSION_HASH_MISMATCH');
    });
  });

  describe('assertManifestNotExpired', () => {
    it('does not throw for non-expired manifest', () => {
      const edgeService = makeEdgeService();
      const manifest = createProviderBondManifest({
        edgeService,
        providerBond: { providerId: 'p-1' },
      });
      expect(() => assertManifestNotExpired(manifest, 1000)).not.toThrow();
    });

    it('throws for expired manifest', () => {
      const edgeService = makeEdgeService({ expiresAt: 1000 });
      const manifest = createProviderBondManifest({
        edgeService,
        providerBond: { providerId: 'p-1' },
      });
      expect(() => assertManifestNotExpired(manifest, 2000)).toThrow('Manifest has expired');
    });
  });
});
