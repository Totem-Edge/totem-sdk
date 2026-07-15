import { computeProviderScore, computeProviderRecommendation } from '../scoring.js';
import { createProviderBondManifest } from '../manifest.js';
import type { EdgeServiceManifest } from '@totemsdk/manifest';
import type { ProviderBondManifest, BondProofRef, ProbeResult, IncidentRecord } from '../types.js';

function makeManifest(overrides: Record<string, unknown> = {}): ProviderBondManifest {
  const edgeService: EdgeServiceManifest = {
    type: 'edge-service', serviceId: 'svc-1', name: 'Test', version: '1.0.0',
    operatorAddress: 'MxRoot', serviceType: 'lookup-provider', description: '',
    capabilities: [], tags: [],
  };
  return createProviderBondManifest({
    edgeService,
    providerBond: { providerId: 'p-1', ...overrides } as any,
  });
}

describe('scoring', () => {
  describe('computeProviderScore', () => {
    it('scores provider with valid identity and MINIMA bond higher', () => {
      const manifest = makeManifest({
        bondOwnerAddress: 'MxRoot',
        bondStack: [
          { bondId: 'b-1', asset: 'MINIMA', amount: 1000n, purpose: 'hard-collateral', lockType: 'manual-attestation', status: 'active' },
        ],
      });
      const bondProofs: BondProofRef[] = [
        { proofId: 'p-1', bondId: 'b-1', providerId: 'p-1', proofType: 'manual', asset: 'MINIMA', amount: 1000n },
      ];
      const score = computeProviderScore({ provider: manifest, bondProofs, now: 1000 });
      expect(score.score).toBeGreaterThan(70);
      expect(score.bondScore).toBe(100);
      expect(score.identityScore).toBe(100);
    });

    it('scores provider with incidents lower', () => {
      const manifest = makeManifest({
        bondOwnerAddress: 'MxRoot',
        bondStack: [
          { bondId: 'b-1', asset: 'MINIMA', amount: 1000n, purpose: 'hard-collateral', lockType: 'manual-attestation', status: 'active' },
        ],
      });
      const bondProofs: BondProofRef[] = [
        { proofId: 'p-1', bondId: 'b-1', providerId: 'p-1', proofType: 'manual', asset: 'MINIMA', amount: 1000n },
      ];
      const incidents: IncidentRecord[] = [
        { incidentId: 'i-1', providerId: 'p-1', type: 'downtime', severity: 'critical', status: 'open', createdAt: 900 },
      ];
      const scoreWithIncidents = computeProviderScore({ provider: manifest, bondProofs, incidents, now: 1000 });
      const scoreWithout = computeProviderScore({ provider: manifest, bondProofs, now: 1000 });
      expect(scoreWithIncidents.score).toBeLessThan(scoreWithout.score);
    });

    it('scores offline provider as offline/avoid', () => {
      const manifest = makeManifest();
      const score = computeProviderScore({ provider: manifest, now: 1000 });
      expect(score.score).toBeLessThan(40);
      expect(['offline', 'unbonded', 'avoid']).toContain(score.recommendation);
    });

    it('returns deterministic score', () => {
      const manifest = makeManifest({ bondOwnerAddress: 'MxRoot' });
      const s1 = computeProviderScore({ provider: manifest, now: 1000 });
      const s2 = computeProviderScore({ provider: manifest, now: 1000 });
      expect(s1.score).toBe(s2.score);
    });
  });

  describe('computeProviderRecommendation', () => {
    it('recommends high scores', () => {
      expect(computeProviderRecommendation(90)).toBe('recommended');
    });
    it('accepts medium scores', () => {
      expect(computeProviderRecommendation(70)).toBe('acceptable');
    });
    it('flags risky scores', () => {
      expect(computeProviderRecommendation(50)).toBe('risky');
    });
    it('flags avoid scores', () => {
      expect(computeProviderRecommendation(30)).toBe('avoid');
    });
    it('flags unbonded', () => {
      expect(computeProviderRecommendation(10)).toBe('unbonded');
    });
    it('flags offline', () => {
      expect(computeProviderRecommendation(0)).toBe('offline');
    });
  });
});
