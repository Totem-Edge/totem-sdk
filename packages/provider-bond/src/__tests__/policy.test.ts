import { filterProvidersByPolicy, rankProvidersByPolicy } from '../policy.js';
import { createProviderBondManifest } from '../manifest.js';
import { createEmptyProviderBondRegistryState, registerProvider } from '../registry.js';
import { computeProviderScore } from '../scoring.js';
import { updateProviderScore } from '../registry.js';
import type { EdgeServiceManifest } from '@totemsdk/manifest';
import type { ProviderBondManifest, ProviderPolicy } from '../types.js';

function makeManifest(providerId: string, overrides: Record<string, unknown> = {}): ProviderBondManifest {
  const edgeService: EdgeServiceManifest = {
    type: 'edge-service', serviceId: `svc-${providerId}`, name: 'Test', version: '1.0.0',
    operatorAddress: 'MxRoot', serviceType: 'lookup-provider', description: '',
    capabilities: [], tags: [],
  };
  return createProviderBondManifest({
    edgeService,
    providerBond: { providerId, ...overrides } as any,
  });
}

describe('policy', () => {
  describe('filterProvidersByPolicy', () => {
    it('MINIMA hard collateral passes MINIMA hard policy', () => {
      let state = createEmptyProviderBondRegistryState();
      const manifest = makeManifest('p-1', {
        bondStack: [
          { bondId: 'b-1', asset: 'MINIMA', amount: 1000n, purpose: 'hard-collateral', lockType: 'manual-attestation', status: 'active' },
        ],
      });
      state = registerProvider(state, manifest);
      const policy: ProviderPolicy = { requireMinimaHardCollateral: true };
      const matches = filterProvidersByPolicy(state, policy);
      expect(matches[0].matched).toBe(true);
    });

    it('TOTEM does not satisfy MINIMA hard collateral', () => {
      let state = createEmptyProviderBondRegistryState();
      const manifest = makeManifest('p-1', {
        bondStack: [
          { bondId: 'b-1', asset: 'TOTEM', amount: 1000n, purpose: 'hard-collateral', lockType: 'manual-attestation', status: 'active' },
        ],
      });
      state = registerProvider(state, manifest);
      const policy: ProviderPolicy = { requireMinimaHardCollateral: true };
      const matches = filterProvidersByPolicy(state, policy);
      expect(matches[0].matched).toBe(false);
      expect(matches[0].failures).toContain('No active MINIMA hard-collateral bond');
    });

    it('TOTEM can satisfy service-level policy if accepted', () => {
      let state = createEmptyProviderBondRegistryState();
      const manifest = makeManifest('p-1', {
        bondStack: [
          { bondId: 'b-1', asset: 'TOTEM', amount: 1000n, purpose: 'service-level', lockType: 'manual-attestation', status: 'active' },
        ],
      });
      state = registerProvider(state, manifest);
      const policy: ProviderPolicy = { acceptedAssets: ['TOTEM'], acceptedPurposes: ['service-level'] };
      const matches = filterProvidersByPolicy(state, policy);
      expect(matches[0].matched).toBe(true);
    });

    it('other token cannot satisfy MINIMA hard collateral unless explicitly accepted', () => {
      let state = createEmptyProviderBondRegistryState();
      const manifest = makeManifest('p-1', {
        bondStack: [
          { bondId: 'b-1', asset: 'OTHER', amount: 1000n, purpose: 'hard-collateral', lockType: 'manual-attestation', status: 'active' },
        ],
      });
      state = registerProvider(state, manifest);
      const policy: ProviderPolicy = { requireMinimaHardCollateral: true };
      const matches = filterProvidersByPolicy(state, policy);
      expect(matches[0].matched).toBe(false);
    });

    it('liquidityBondRefs do not count as collateral in v0.1', () => {
      let state = createEmptyProviderBondRegistryState();
      const manifest = makeManifest('p-1', {
        liquidityBondRefs: ['lb-1', 'lb-2'],
      });
      state = registerProvider(state, manifest);
      const policy: ProviderPolicy = { requireActiveBond: true };
      const matches = filterProvidersByPolicy(state, policy);
      expect(matches[0].matched).toBe(false);
      expect(matches[0].failures).toContain('No active bond');
    });
  });

  describe('rankProvidersByPolicy', () => {
    it('ranks matched providers first, then by score', () => {
      const matches = [
        { providerId: 'p-1', provider: {} as any, matched: false, reasons: [], failures: ['x'], score: { score: 90, recommendation: 'recommended' as const, providerId: 'p-1', bondScore: 0, identityScore: 0, reliabilityScore: 0, incidentScore: 0, computedAt: 0, reasons: [] } },
        { providerId: 'p-2', provider: {} as any, matched: true, reasons: ['y'], failures: [], score: { score: 50, recommendation: 'risky' as const, providerId: 'p-2', bondScore: 0, identityScore: 0, reliabilityScore: 0, incidentScore: 0, computedAt: 0, reasons: [] } },
        { providerId: 'p-3', provider: {} as any, matched: true, reasons: ['z'], failures: [], score: { score: 80, recommendation: 'recommended' as const, providerId: 'p-3', bondScore: 0, identityScore: 0, reliabilityScore: 0, incidentScore: 0, computedAt: 0, reasons: [] } },
      ];
      const ranked = rankProvidersByPolicy(matches);
      expect(ranked[0].providerId).toBe('p-3');
      expect(ranked[1].providerId).toBe('p-2');
      expect(ranked[2].providerId).toBe('p-1');
    });
  });
});
