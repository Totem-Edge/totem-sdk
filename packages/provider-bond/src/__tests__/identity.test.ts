import { signManifest } from '@totemsdk/manifest';
import type { EdgeServiceManifest } from '@totemsdk/manifest';
import { wotsAddressFromKeypair, wotsKeypairFromSeed } from '@totemsdk/core';
import {
  verifyProviderManifestIdentity,
  verifyProviderBondAddresses,
  assertProviderControlsAddress,
} from '../identity.js';
import { createProviderBondManifest } from '../manifest.js';

const SEED_ROOT = new Uint8Array(32).fill(1);
const SEED_ATTACKER = new Uint8Array(32).fill(9);
const rootAddr = wotsAddressFromKeypair(wotsKeypairFromSeed(SEED_ROOT, 0));
const attackerAddr = wotsAddressFromKeypair(wotsKeypairFromSeed(SEED_ATTACKER, 0));

function makeEdgeService(overrides: Partial<EdgeServiceManifest> = {}): EdgeServiceManifest {
  return {
    type: 'edge-service',
    serviceId: 'svc-1',
    name: 'Test Provider',
    version: '1.0.0',
    operatorAddress: rootAddr,
    serviceType: 'lookup-provider',
    description: 'A test provider',
    capabilities: ['lookup'],
    tags: ['test'],
    ...overrides,
  };
}

function graph(rootAddress: string, delegates: string[] = []) {
  return {
    document: { rootAddress, controllerAddress: rootAddress },
    // RFC-020 C4: unsigned claims are NOT trusted — these carry no valid signature.
    claims: delegates.map((d) => ({
      claim: { type: 'delegates_to', issuer: rootAddress, subject: rootAddress, object: d },
      proof: { address: d },
    })),
  };
}

describe('identity (RFC-020 C4)', () => {
  describe('verifyProviderManifestIdentity', () => {
    it('verifies a real, authorised manifest signer', async () => {
      const edgeService = makeEdgeService({ operatorAddress: rootAddr });
      const signed = await signManifest(edgeService, SEED_ROOT, 0);
      const manifest = createProviderBondManifest({ edgeService, signedEdgeService: signed, providerBond: { providerId: 'p-1' } });
      const result = verifyProviderManifestIdentity({ manifest, identityGraph: graph(rootAddr) });
      expect(result.ok).toBe(true);
    });

    it('rejects an unauthorised manifest signer', async () => {
      const edgeService = makeEdgeService({ operatorAddress: attackerAddr });
      const signed = await signManifest(edgeService, SEED_ATTACKER, 0);
      const manifest = createProviderBondManifest({ edgeService, signedEdgeService: signed, providerBond: { providerId: 'p-1' } });
      const result = verifyProviderManifestIdentity({ manifest, identityGraph: graph(rootAddr) });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('IDENTITY_NOT_AUTHORISED');
    });

    it('rejects an invalid/absent identity graph', () => {
      const edgeService = makeEdgeService();
      const manifest = createProviderBondManifest({ edgeService, providerBond: { providerId: 'p-1' } });
      const result = verifyProviderManifestIdentity({ manifest, identityGraph: null });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('IDENTITY_NOT_AUTHORISED');
    });
  });

  describe('verifyProviderBondAddresses', () => {
    function manifestWithBond(providerBond: Record<string, unknown>) {
      return createProviderBondManifest({
        edgeService: makeEdgeService(),
        providerBond: { providerId: 'p-1', ...providerBond } as never,
      });
    }

    it('accepts root-controlled addresses', () => {
      const manifest = manifestWithBond({ bondOwnerAddress: rootAddr, probeSignerAddress: rootAddr });
      expect(verifyProviderBondAddresses({ manifest, identityGraph: graph(rootAddr) }).ok).toBe(true);
    });

    it('rejects an unauthorised bond owner', () => {
      const manifest = manifestWithBond({ bondOwnerAddress: attackerAddr });
      const result = verifyProviderBondAddresses({ manifest, identityGraph: graph(rootAddr) });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('BOND_OWNER_NOT_AUTHORISED');
    });

    it('does not trust an unsigned delegation claim (forged identity graph)', () => {
      const manifest = manifestWithBond({ probeSignerAddress: attackerAddr });
      // The graph claims attacker is delegated, but the claim has no valid signature.
      const result = verifyProviderBondAddresses({ manifest, identityGraph: graph(rootAddr, [attackerAddr]) });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('PROBE_SIGNER_NOT_AUTHORISED');
    });
  });

  describe('assertProviderControlsAddress', () => {
    it('ok for a root-controlled address, not ok otherwise', () => {
      const manifest = createProviderBondManifest({ edgeService: makeEdgeService(), providerBond: { providerId: 'p-1' } });
      expect(assertProviderControlsAddress({ manifest, address: rootAddr, identityGraph: graph(rootAddr) }).ok).toBe(true);
      expect(assertProviderControlsAddress({ manifest, address: attackerAddr, identityGraph: graph(rootAddr) }).ok).toBe(false);
    });
  });
});
