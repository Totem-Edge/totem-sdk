import { verifyBondProof, assertBondMeetsMinimum, verifyBondStack } from '../bond-proof.js';
import type { BondProofRef, BondProofVerifier, ProviderBondAssetDeclaration } from '../types.js';

const okVerifier: BondProofVerifier = { verify: async () => ({ ok: true, code: 'OK' }) };

function proof(overrides: Partial<BondProofRef> = {}): BondProofRef {
  return {
    proofId: 'p-1', bondId: 'b-1', providerId: 'prov-1',
    proofType: 'manual', asset: 'MINIMA', amount: 1000n,
    ...overrides,
  };
}

describe('bond-proof', () => {
  describe('verifyBondProof (RFC-020 C4: fail closed without a verifier)', () => {
    it('verifies a manual proof only with an independent verifier', async () => {
      expect((await verifyBondProof(proof(), okVerifier)).ok).toBe(true);
      const noVerifier = await verifyBondProof(proof());
      expect(noVerifier.ok).toBe(false);
      expect(noVerifier.code).toBe('REQUIRES_LIVE_VERIFIER');
    });

    it('verifies a declared proof only with an independent verifier', async () => {
      expect((await verifyBondProof(proof({ proofType: 'declared' }), okVerifier)).ok).toBe(true);
      expect((await verifyBondProof(proof({ proofType: 'declared' }))).ok).toBe(false);
    });

    it('rejects a manual proof with zero amount', async () => {
      const result = await verifyBondProof(proof({ amount: 0n }));
      expect(result.ok).toBe(false);
      expect(result.code).toBe('BOND_AMOUNT_INSUFFICIENT');
    });

    it('requires a live verifier for future-live-chain', async () => {
      const noVerifier = await verifyBondProof(proof({ proofType: 'future-live-chain' }));
      expect(noVerifier.ok).toBe(false);
      expect(noVerifier.code).toBe('REQUIRES_LIVE_VERIFIER');
      expect(noVerifier.requiresLiveVerifier).toBe(true);
      expect((await verifyBondProof(proof({ proofType: 'future-live-chain' }), okVerifier)).ok).toBe(true);
    });

    it('rejects a totem-proof without proof data', async () => {
      const result = await verifyBondProof(proof({ proofType: 'totem-proof' }), okVerifier);
      expect(result.ok).toBe(false);
      expect(result.code).toBe('BOND_PROOF_INVALID');
    });

    it('surfaces a verifier rejection', async () => {
      const rejecting: BondProofVerifier = {
        verify: async () => ({ ok: false, reason: 'forged', code: 'BOND_PROOF_INVALID' }),
      };
      const result = await verifyBondProof(proof(), rejecting);
      expect(result.ok).toBe(false);
      expect(result.code).toBe('BOND_PROOF_INVALID');
    });

    it('rejects an unsupported proof type', async () => {
      const result = await verifyBondProof(proof({ proofType: 'unknown-type' as never }), okVerifier);
      expect(result.ok).toBe(false);
      expect(result.code).toBe('UNSUPPORTED_PROOF_TYPE');
    });
  });

  describe('assertBondMeetsMinimum', () => {
    it('passes when amount meets minimum', () => {
      expect(assertBondMeetsMinimum(proof(), 500n).ok).toBe(true);
    });

    it('rejects insufficient amount', () => {
      const result = assertBondMeetsMinimum(proof({ amount: 100n }), 500n);
      expect(result.ok).toBe(false);
      expect(result.code).toBe('BOND_AMOUNT_INSUFFICIENT');
    });
  });

  describe('verifyBondStack (RFC-020 C4: a proof is required per declaration)', () => {
    const declaration: ProviderBondAssetDeclaration = {
      bondId: 'b-1', asset: 'MINIMA', amount: 1000n,
      purpose: 'hard-collateral', lockType: 'manual-attestation', status: 'active',
    };

    it('verifies a valid bond stack with a proof and verifier', async () => {
      const result = await verifyBondStack({
        bondStack: [declaration],
        bondProofs: [proof()],
        verifier: okVerifier,
      });
      expect(result.ok).toBe(true);
    });

    it('rejects a declaration without an attached proof', async () => {
      const result = await verifyBondStack({ bondStack: [declaration], verifier: okVerifier });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('BOND_PROOF_INVALID');
    });

    it('rejects when no verifier is supplied', async () => {
      const result = await verifyBondStack({ bondStack: [declaration], bondProofs: [proof()] });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('REQUIRES_LIVE_VERIFIER');
    });

    it('rejects an empty bond stack', async () => {
      const result = await verifyBondStack({ bondStack: [] });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('BOND_AMOUNT_INSUFFICIENT');
    });
  });
});
