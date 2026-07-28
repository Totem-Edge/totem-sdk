import { verifyBondProof, assertBondMeetsMinimum, verifyBondStack } from '../bond-proof.js';
import type { BondProofRef, BondProofVerifier } from '../types.js';

describe('bond-proof', () => {
  describe('verifyBondProof', () => {
    it('verifies manual proof', () => {
      const proof: BondProofRef = {
        proofId: 'p-1', bondId: 'b-1', providerId: 'prov-1',
        proofType: 'manual', asset: 'MINIMA', amount: 1000n,
      };
      const result = verifyBondProof(proof);
      expect(result.ok).toBe(true);
    });

    it('verifies declared proof', () => {
      const proof: BondProofRef = {
        proofId: 'p-1', bondId: 'b-1', providerId: 'prov-1',
        proofType: 'declared', asset: 'MINIMA', amount: 1000n,
      };
      const result = verifyBondProof(proof);
      expect(result.ok).toBe(true);
    });

    it('rejects manual proof with zero amount', () => {
      const proof: BondProofRef = {
        proofId: 'p-1', bondId: 'b-1', providerId: 'prov-1',
        proofType: 'manual', asset: 'MINIMA', amount: 0n,
      };
      const result = verifyBondProof(proof);
      expect(result.ok).toBe(false);
      expect(result.code).toBe('BOND_AMOUNT_INSUFFICIENT');
    });

    it('returns REQUIRES_LIVE_VERIFIER for future-live-chain without verifier', () => {
      const proof: BondProofRef = {
        proofId: 'p-1', bondId: 'b-1', providerId: 'prov-1',
        proofType: 'future-live-chain', asset: 'MINIMA', amount: 1000n,
      };
      const result = verifyBondProof(proof);
      expect(result.ok).toBe(false);
      expect(result.code).toBe('REQUIRES_LIVE_VERIFIER');
      expect(result.requiresLiveVerifier).toBe(true);
    });

    it('uses injected verifier when supplied', async () => {
      const verifier: BondProofVerifier = {
        verify: async () => ({ ok: true, code: 'OK' }),
      };
      const proof: BondProofRef = {
        proofId: 'p-1', bondId: 'b-1', providerId: 'prov-1',
        proofType: 'future-live-chain', asset: 'MINIMA', amount: 1000n,
      };
      const result = verifyBondProof(proof, verifier);
      expect(result.ok).toBe(true);
    });

    it('rejects unsupported proof type', () => {
      const proof: BondProofRef = {
        proofId: 'p-1', bondId: 'b-1', providerId: 'prov-1',
        proofType: 'unknown-type' as any, asset: 'MINIMA', amount: 1000n,
      };
      const result = verifyBondProof(proof);
      expect(result.ok).toBe(false);
      expect(result.code).toBe('UNSUPPORTED_PROOF_TYPE');
    });
  });

  describe('assertBondMeetsMinimum', () => {
    it('passes when amount meets minimum', () => {
      const proof: BondProofRef = {
        proofId: 'p-1', bondId: 'b-1', providerId: 'prov-1',
        proofType: 'manual', asset: 'MINIMA', amount: 1000n,
      };
      const result = assertBondMeetsMinimum(proof, 500n);
      expect(result.ok).toBe(true);
    });

    it('rejects insufficient amount', () => {
      const proof: BondProofRef = {
        proofId: 'p-1', bondId: 'b-1', providerId: 'prov-1',
        proofType: 'manual', asset: 'MINIMA', amount: 100n,
      };
      const result = assertBondMeetsMinimum(proof, 500n);
      expect(result.ok).toBe(false);
      expect(result.code).toBe('BOND_AMOUNT_INSUFFICIENT');
    });
  });

  describe('verifyBondStack', () => {
    it('verifies a valid bond stack', () => {
      const result = verifyBondStack({
        bondStack: [
          { bondId: 'b-1', asset: 'MINIMA', amount: 1000n, purpose: 'hard-collateral', lockType: 'manual-attestation', status: 'active' },
        ],
        bondProofs: [
          { proofId: 'p-1', bondId: 'b-1', providerId: 'prov-1', proofType: 'manual', asset: 'MINIMA', amount: 1000n },
        ],
      });
      expect(result.ok).toBe(true);
    });

    it('rejects empty bond stack', () => {
      const result = verifyBondStack({ bondStack: [] });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('BOND_AMOUNT_INSUFFICIENT');
    });
  });
});
